import logging
import os

from celery import Celery

from app.core.config import settings
from app.services.dna_extractor import extract_behavioral_dna
from app.services.laravel_callback import notify_job_complete
from app.services.pinecone_client import search, upsert_records
from app.services.twin_trainer import TwinTrainer

logger = logging.getLogger(__name__)

celery_app = Celery("twin", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.broker_connection_timeout = 3
celery_app.conf.broker_connection_retry_on_startup = False
celery_app.conf.broker_transport_options = {
    "socket_connect_timeout": 2,
    "socket_timeout": 2,
}

# Dev local sem Redis: defina CELERY_TASK_ALWAYS_EAGER=true no ambiente do ai-engine
if os.getenv("CELERY_TASK_ALWAYS_EAGER", "").lower() in ("1", "true", "yes"):
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True


def _messages_for_dna(tenant_id: str, twin_id: str, sample_messages: list[dict] | None = None) -> list[dict]:
    if sample_messages:
        return sample_messages
    hits = search(tenant_id, twin_id, "msgs", "estilo comunicação", top_k=100)
    return [{"role": "user", "body": h.get("chunk_text", "")} for h in hits if h.get("chunk_text")]


def _build_reindex_records(job_id: str, messages: list[dict]) -> list[dict]:
    records = []
    for i, m in enumerate(messages):
        body = m.get("body", m.get("chunk_text", ""))
        if not body:
            continue
        role = m.get("role", "user")
        if role != "user":
            continue
        msg_id = m.get("message_id", f"reindex_{job_id}_{i}")
        channel = m.get("channel", m.get("source", "reindex"))
        records.append({
            "_id": msg_id,
            "chunk_text": body[:8000],
            "message_id": msg_id,
            "role": "user",
            "contact_id": m.get("contact", m.get("contact_id", "unknown")),
            "source": channel,
            "channel": channel,
            "is_user_message": True,
        })
    return records


@celery_app.task
def extract_dna_task(tenant_id: str, twin_id: str, job_id: str, sample_messages: list[dict] | None = None):
    try:
        messages = _messages_for_dna(tenant_id, twin_id, sample_messages)
        payload = extract_behavioral_dna(messages)
        notify_job_complete(
            job_id,
            "training",
            tenant_id,
            twin_id,
            "completed",
            result={"version": payload["version"], "payload": payload},
        )
        return payload
    except Exception as exc:
        notify_job_complete(
            job_id,
            "training",
            tenant_id,
            twin_id,
            "failed",
            error=str(exc),
        )
        raise


@celery_app.task
def ingest_batch_task(
    tenant_id: str,
    twin_id: str,
    batch_id: str,
    source: str,
    content_b64: str,
    channel: str | None = None,
):
    from app.services.ingest_service import process_ingest_batch

    try:
        return process_ingest_batch(
            tenant_id, twin_id, batch_id, source, content_b64, channel
        )
    except Exception as exc:
        notify_job_complete(
            batch_id,
            "import_batch",
            tenant_id,
            twin_id,
            "failed",
            error=str(exc),
        )
        raise


@celery_app.task
def batch_train_task(
    tenant_id: str,
    twin_id: str,
    job_id: str,
    messages: list[dict] | None = None,
):
    """Batch upsert trainer feedback items into Pinecone."""
    try:
        items = messages or []
        normalized = []
        for m in items:
            normalized.append({
                "tenant_id": m.get("tenant_id", tenant_id),
                "twin_id": m.get("twin_id", twin_id),
                "input": m.get("input", m.get("input_text", "")),
                "output": m.get("output", m.get("output_text", m.get("accepted_text", ""))),
                "metadata": m.get("metadata"),
            })
        result = TwinTrainer().process_batch(normalized)
        notify_job_complete(
            job_id,
            "training",
            tenant_id,
            twin_id,
            "completed",
            result=result,
        )
        return result
    except Exception as exc:
        notify_job_complete(
            job_id,
            "training",
            tenant_id,
            twin_id,
            "failed",
            error=str(exc),
        )
        raise


@celery_app.task
def reindex_task(
    tenant_id: str,
    twin_id: str,
    job_id: str,
    messages: list[dict] | None = None,
):
    """
    Re-upsert messages into Pinecone msgs namespace.
    If messages list is provided (e.g. from Laravel callback), uses it directly.
    Otherwise re-fetches existing vectors from Pinecone and re-upserts them.
    """
    try:
        if messages:
            records = _build_reindex_records(job_id, messages)
            source = "provided_messages"
        else:
            logger.info(
                "reindex_task: no messages for %s/%s — re-fetching from Pinecone msgs namespace",
                tenant_id,
                twin_id,
            )
            hits = search(tenant_id, twin_id, "msgs", "mensagens conversa estilo", top_k=500)
            records = _build_reindex_records(
                job_id,
                [{"body": h.get("chunk_text", ""), **h} for h in hits if h.get("chunk_text")],
            )
            source = "pinecone_refetch"

        count = upsert_records(tenant_id, twin_id, "msgs", records) if records else 0
        result = {
            "status": "completed",
            "job_id": job_id,
            "reindexed": True,
            "upserted_count": count,
            "source": source,
        }
        notify_job_complete(
            job_id,
            "training",
            tenant_id,
            twin_id,
            "completed",
            result=result,
        )
        return result
    except Exception as exc:
        notify_job_complete(
            job_id,
            "training",
            tenant_id,
            twin_id,
            "failed",
            error=str(exc),
        )
        raise
