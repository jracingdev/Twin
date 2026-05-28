from fastapi import APIRouter
from pydantic import BaseModel

from app.services.memory_service import MemoryService

router = APIRouter()
memory = MemoryService()


class MemoryUpsert(BaseModel):
    tenant_id: str
    twin_id: str
    record: dict


@router.post("/memory/upsert")
def upsert_memory(req: MemoryUpsert):
    memory.upsert_memory(req.tenant_id, req.twin_id, req.record)
    return {"status": "ok"}
