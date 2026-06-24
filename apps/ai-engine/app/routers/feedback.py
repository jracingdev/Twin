from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.pinecone_client import upsert_records

router = APIRouter()


class FeedbackSyncRequest(BaseModel):
    tenant_id: str
    twin_id: str
    suggestion_id: str
    input_text: str
    accepted_text: str


class FeedbackUpsertRequest(BaseModel):
    tenant_id: str
    twin_id: str
    suggestion_id: str
    input_text: str
    output_text: str
    original_suggestion: str | None = None
    accepted_at: str | None = None
    metadata: dict | None = None


def _feedback_record(
    suggestion_id: str,
    input_text: str,
    output_text: str,
    *,
    accepted_at: str | None = None,
    extra: dict | None = None,
) -> dict:
    ts = accepted_at or datetime.now(timezone.utc).isoformat()
    record = {
        "_id": f"fb_{suggestion_id}",
        "chunk_text": output_text[:8000],
        "message_id": f"fb_{suggestion_id}",
        "role": "assistant",
        "input_text": input_text[:8000],
        "source": "feedback",
        "accepted_at": ts,
        "is_user_message": False,
    }
    if extra:
        record.update({k: v for k, v in extra.items() if k not in record})
    return record


@router.post("/feedback/sync")
def sync_feedback(req: FeedbackSyncRequest):
    record = _feedback_record(req.suggestion_id, req.input_text, req.accepted_text)
    upsert_records(req.tenant_id, req.twin_id, "msgs", [record])
    return {"status": "ok", "indexed": 1}


@router.post("/feedback/upsert")
def upsert_feedback(req: FeedbackUpsertRequest):
    """Upsert accepted feedback — works even when output equals the original suggestion."""
    was_edited = (
        req.original_suggestion is not None
        and req.output_text.strip() != req.original_suggestion.strip()
    )
    record = _feedback_record(
        req.suggestion_id,
        req.input_text,
        req.output_text,
        accepted_at=req.accepted_at,
        extra=req.metadata,
    )
    upsert_records(req.tenant_id, req.twin_id, "msgs", [record])
    return {
        "status": "ok",
        "indexed": 1,
        "was_edited": was_edited,
        "accepted_unchanged": not was_edited,
    }
