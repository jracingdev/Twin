from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.rag_engine import RAGEngine

router = APIRouter()
engine = RAGEngine()


class SuggestRequest(BaseModel):
    tenant_id: str
    twin_id: str
    text: str
    contact_id: str | None = None
    intensity: int = Field(default=2, ge=1, le=4)
    seller_mode: bool = False
    dna: dict | None = None


@router.post("/respond/suggest")
def suggest(req: SuggestRequest):
    return engine.suggest(
        req.tenant_id,
        req.twin_id,
        req.text,
        req.dna,
        req.intensity,
        req.contact_id,
        req.seller_mode,
    )
