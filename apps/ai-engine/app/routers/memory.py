from fastapi import APIRouter
from pydantic import BaseModel

from app.services.entity_extractor import extract_from_pair, extract_from_pairs
from app.services.memory_service import MemoryService

router = APIRouter()
memory = MemoryService()


class MemoryUpsert(BaseModel):
    tenant_id: str
    twin_id: str
    record: dict


class MessagePair(BaseModel):
    input: str
    output: str | None = None


class MemoryExtractRequest(BaseModel):
    tenant_id: str
    twin_id: str
    input_text: str | None = None
    output_text: str | None = None
    message_pairs: list[MessagePair] | None = None


@router.post("/memory/upsert")
def upsert_memory(req: MemoryUpsert):
    memory.upsert_memory(req.tenant_id, req.twin_id, req.record)
    return {"status": "ok"}


@router.post("/memory/extract")
def extract_entities(req: MemoryExtractRequest):
    if req.message_pairs:
        pairs = [p.model_dump() for p in req.message_pairs]
        result = extract_from_pairs(pairs)
    elif req.input_text:
        result = extract_from_pair(req.input_text, req.output_text)
    else:
        result = {"products": [], "objections": [], "topics": [], "suggested_edges": []}
    return {
        "tenant_id": req.tenant_id,
        "twin_id": req.twin_id,
        **result,
    }
