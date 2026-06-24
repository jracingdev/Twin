import logging
import threading

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import redis

from app.celery_app import batch_train_task, extract_dna_task, reindex_task
from app.core.config import settings
from app.services.twin_trainer import TwinTrainer

router = APIRouter()
logger = logging.getLogger(__name__)
trainer = TwinTrainer()


class TrainRequest(BaseModel):
    job_id: str
    tenant_id: str
    twin_id: str
    type: str
    messages: list[dict] | None = None


class TrainBatchItem(BaseModel):
    input: str
    output: str
    twin_id: str
    tenant_id: str
    metadata: dict | None = None


class TrainBatchRequest(BaseModel):
    items: list[TrainBatchItem]
    job_id: str | None = None
    async_mode: bool = False


def _redis_available() -> bool:
    try:
        client = redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
        client.ping()
        return True
    except Exception:
        return False


def _dispatch(
    task,
    tenant_id: str,
    twin_id: str,
    job_id: str,
    *,
    messages: list[dict] | None = None,
) -> None:
    from app.celery_app import celery_app

    if celery_app.conf.task_always_eager:
        # Em modo eager (dev sem Redis), a task é síncrona e chamaria o Laravel
        # de volta enquanto o Laravel está esperando esta resposta — deadlock.
        # Rodamos em background thread para liberar a resposta HTTP primeiro.
        def _run():
            try:
                if messages is not None:
                    task(tenant_id, twin_id, job_id, messages)
                else:
                    task(tenant_id, twin_id, job_id)
            except Exception:
                logger.exception("Background task %s failed", task.name)

        threading.Thread(target=_run, daemon=True).start()
        return

    if not _redis_available():
        raise HTTPException(
            status_code=503,
            detail=(
                "Redis indisponível. Inicie Redis (porta 6379) e o worker: "
                "celery -A app.celery_app worker -l info. "
                "Em dev sem Redis, use CELERY_TASK_ALWAYS_EAGER=true."
            ),
        )

    try:
        args = [tenant_id, twin_id, job_id]
        if messages is not None:
            args.append(messages)
        task.apply_async(args=args, expires=3600)
    except Exception as exc:
        logger.exception("Failed to enqueue task %s", task.name)
        raise HTTPException(
            status_code=503,
            detail=f"Não foi possível enfileirar o job: {exc}",
        ) from exc


@router.post("/train/batch")
def train_batch(req: TrainBatchRequest):
    items = [i.model_dump() for i in req.items]
    if req.async_mode and req.job_id:
        _dispatch(
            batch_train_task,
            req.items[0].tenant_id if req.items else "",
            req.items[0].twin_id if req.items else "",
            req.job_id,
            messages=items,
        )
        return {"job_id": req.job_id, "status": "queued", "items": len(items)}
    return trainer.process_batch(items)


@router.post("/train/trigger")
def trigger_train(req: TrainRequest):
    if req.type == "dna_extract":
        _dispatch(extract_dna_task, req.tenant_id, req.twin_id, req.job_id, messages=req.messages)
    elif req.type in ("reindex", "incremental"):
        _dispatch(reindex_task, req.tenant_id, req.twin_id, req.job_id, messages=req.messages)
    elif req.type in ("batch_train", "trainer"):
        if not req.messages:
            raise HTTPException(status_code=422, detail="messages obrigatório para batch_train")
        _dispatch(batch_train_task, req.tenant_id, req.twin_id, req.job_id, messages=req.messages)
    else:
        raise HTTPException(status_code=422, detail="Tipo de job inválido")
    return {"job_id": req.job_id, "status": "queued"}


@router.get("/jobs/{job_id}")
def job_status(job_id: str):
    return {"job_id": job_id, "status": "unknown"}
