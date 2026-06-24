from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.rag_engine import DEFAULT_CONFIDENCE_THRESHOLD, RAGEngine

router = APIRouter()
engine = RAGEngine()


class ConversationTurn(BaseModel):
    role: str
    text: str


class ReplaySimulateRequest(BaseModel):
    tenant_id: str
    twin_id: str
    input: str
    dna: dict | None = None
    conversation_history: list[ConversationTurn] | None = None
    intensity: int = Field(default=2, ge=1, le=4)
    seller_mode: bool = False
    contact_id: str | None = None
    session_id: str | None = None
    confidence_threshold: float = Field(default=DEFAULT_CONFIDENCE_THRESHOLD, ge=0.0, le=1.0)
    push_working_memory: bool = False


@router.post("/replay/simulate")
def simulate(req: ReplaySimulateRequest):
    history = None
    if req.conversation_history:
        history = [t.model_dump() for t in req.conversation_history]
    return engine.simulate(
        req.tenant_id,
        req.twin_id,
        req.input,
        req.dna,
        req.intensity,
        req.contact_id,
        req.seller_mode,
        req.session_id,
        req.confidence_threshold,
        conversation_history=history,
        push_working_memory=req.push_working_memory,
    )
