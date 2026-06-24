from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.dna_evolution import compare_dna_versions, incremental_dna_update
from app.services.dna_extractor import extract_behavioral_dna
from app.services.pinecone_client import search

router = APIRouter()


class DnaRequest(BaseModel):
    tenant_id: str
    twin_id: str
    messages: list[dict] | None = None


class DnaCompareRequest(BaseModel):
    old_payload: dict
    new_payload: dict


class DnaIncrementalRequest(BaseModel):
    tenant_id: str
    twin_id: str
    existing_payload: dict
    messages: list[dict]


@router.post("/dna/extract")
def extract_dna(req: DnaRequest):
    messages = req.messages or []
    if not messages:
        hits = search(req.tenant_id, req.twin_id, "msgs", "conversa estilo comunicação", top_k=50)
        messages = [
            {"role": "user", "body": h.get("chunk_text", "")}
            for h in hits
            if h.get("chunk_text")
        ]
    payload = extract_behavioral_dna(messages)
    return {"version": payload["version"], "payload": payload}


@router.post("/dna/compare")
def compare_dna(req: DnaCompareRequest):
    result = compare_dna_versions(req.old_payload, req.new_payload)
    return result


@router.post("/dna/incremental")
def incremental_dna(req: DnaIncrementalRequest):
    updated = incremental_dna_update(req.existing_payload, req.messages)
    return {"version": updated.get("version", "2.0.0"), "payload": updated}
