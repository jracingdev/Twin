from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.rag_engine import DEFAULT_CONFIDENCE_THRESHOLD, RAGEngine

router = APIRouter()
engine = RAGEngine()


class SuggestRequest(BaseModel):
    tenant_id: str
    twin_id: str
    text: str
    contact_id: str | None = None
    session_id: str | None = None
    intensity: int = Field(default=2, ge=1, le=4)
    seller_mode: bool = False
    dna: dict | None = None
    confidence_threshold: float = Field(default=DEFAULT_CONFIDENCE_THRESHOLD, ge=0.0, le=1.0)


class SimilarityRequest(BaseModel):
    text_a: str
    text_b: str


class ExplainRequest(BaseModel):
    input_text: str
    suggestion_text: str
    dna: dict | None = None
    retrieved_chunks: list[dict] | None = None
    similarity_breakdown: dict | None = None


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
        req.session_id,
        req.confidence_threshold,
    )


@router.post("/respond/explain")
def explain(req: ExplainRequest):
    return engine.explain(
        req.input_text,
        req.suggestion_text,
        req.dna,
        req.retrieved_chunks,
        req.similarity_breakdown,
    )


@router.post("/respond/similarity")
def similarity(req: SimilarityRequest):
    a = set(req.text_a.lower().split())
    b = set(req.text_b.lower().split())
    if not a and not b:
        return {"score": 1.0}
    if not a or not b:
        return {"score": 0.0}
    intersection = len(a & b)
    union = len(a | b)
    return {"score": round(intersection / union, 4) if union else 0.0}
