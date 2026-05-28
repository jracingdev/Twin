from fastapi import APIRouter
from pydantic import BaseModel

from app.services.dna_extractor import extract_behavioral_dna
from app.services.pinecone_client import search

router = APIRouter()


class DnaRequest(BaseModel):
    tenant_id: str
    twin_id: str
    messages: list[dict] | None = None


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
