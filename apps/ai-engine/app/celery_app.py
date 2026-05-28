import os

from celery import Celery

from app.core.config import settings
from app.services.dna_extractor import extract_behavioral_dna
from app.services.laravel_callback import notify_job_complete
from app.services.pinecone_client import search

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


@celery_app.task
def extract_dna_task(tenant_id: str, twin_id: str, job_id: str):
    try:
        messages = _messages_for_dna(tenant_id, twin_id)
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
def reindex_task(tenant_id: str, twin_id: str, job_id: str):
    try:
        result = {"status": "completed", "job_id": job_id, "reindexed": True}
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
