import os

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.ingest_service import process_ingest_batch

router = APIRouter()


class IngestRequest(BaseModel):
    tenant_id: str
    twin_id: str
    batch_id: str
    source: str
    content: str
    channel: str | None = None


def _use_celery() -> bool:
    return os.getenv("CELERY_INGEST", "").lower() in ("1", "true", "yes")


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
            )
            return {
                "batch_id": req.batch_id,
                "status": "queued",
                "async": True,
            }
        except Exception:
            pass

    try:
        return process_ingest_batch(
            req.tenant_id,
            req.twin_id,
            req.batch_id,
            req.source,
            req.content,
            req.channel,
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
