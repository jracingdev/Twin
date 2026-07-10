import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings
from app.services.ingest_service import process_ingest_batch

logger = logging.getLogger(__name__)

router = APIRouter()


class IngestRequest(BaseModel):
    tenant_id: str
    twin_id: str
    batch_id: str
    source: str
    content: str
    channel: str | None = None
    owner_name: str | None = None


def _use_celery() -> bool:
    return settings.celery_ingest


@router.post("/ingest/batch")
def ingest_batch(req: IngestRequest):
    if _use_celery():
        try:
            from app.celery_app import ingest_batch_task

            ingest_batch_task.delay(
                req.tenant_id,
                req.twin_id,
                req.batch_id,
                req.source,
                req.content,
                req.channel,
                req.owner_name,
            )
            return {
                "batch_id": req.batch_id,
                "status": "queued",
                "async": True,
            }
        except Exception as exc:
            logger.warning("Celery ingest enqueue failed, falling back to sync: %s", exc)

    try:
        return process_ingest_batch(
            req.tenant_id,
            req.twin_id,
            req.batch_id,
            req.source,
            req.content,
            req.channel,
            req.owner_name,
        )
    except Exception as exc:
        from app.services.laravel_callback import notify_job_complete

        notify_job_complete(
            req.batch_id,
            "import_batch",
            req.tenant_id,
            req.twin_id,
            "failed",
            error=str(exc),
        )
        raise
