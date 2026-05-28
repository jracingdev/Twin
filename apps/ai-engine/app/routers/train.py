import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import redis

from app.celery_app import extract_dna_task, reindex_task
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


class TrainRequest(BaseModel):
    job_id: str
    tenant_id: str
    twin_id: str
    type: str


def _redis_available() -> bool:
    try:
        client = redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
        client.ping()
        return True
    except Exception:
        return False


def _dispatch(task, tenant_id: str, twin_id: str, job_id: str) -> None:
    from app.celery_app import celery_app

    if not celery_app.conf.task_always_eager and not _redis_available():
        raise HTTPException(
            status_code=503,
            detail=(
                "Redis indisponível. Inicie Redis (porta 6379) e o worker: "
                "celery -A app.celery_app worker -l info. "
                "Em dev sem Redis, use CELERY_TASK_ALWAYS_EAGER=true."
            ),
        )

    try:
        task.apply_async(args=[tenant_id, twin_id, job_id], expires=3600)
    except Exception as exc:
        logger.exception("Failed to enqueue task %s", task.name)
        raise HTTPException(
            status_code=503,
            detail=f"Não foi possível enfileirar o job: {exc}",
        ) from exc


@router.post("/train/trigger")
def trigger_train(req: TrainRequest):
    if req.type == "dna_extract":
        _dispatch(extract_dna_task, req.tenant_id, req.twin_id, req.job_id)
    elif req.type in ("reindex", "incremental"):
        _dispatch(reindex_task, req.tenant_id, req.twin_id, req.job_id)
    else:
        raise HTTPException(status_code=422, detail="Tipo de job inválido")
    return {"job_id": req.job_id, "status": "queued"}


@router.get("/jobs/{job_id}")
def job_status(job_id: str):
    return {"job_id": job_id, "status": "unknown"}
