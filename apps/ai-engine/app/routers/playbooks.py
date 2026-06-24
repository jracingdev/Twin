from fastapi import APIRouter
from pydantic import BaseModel

from app.services.pinecone_client import upsert_records

router = APIRouter()


class PlaybookItem(BaseModel):
    id: str
    intent: str
    template: str
    vertical: str = "autopecas"


class PlaybookSyncRequest(BaseModel):
    tenant_id: str
    twin_id: str
    playbooks: list[PlaybookItem]


@router.post("/playbooks/sync")
def sync_playbooks(body: PlaybookSyncRequest) -> dict:
    records = [
        {
            "_id": f"pb_manual_{p.id}",
            "chunk_text": p.template,
            "intent": p.intent,
            "vertical": p.vertical,
            "source": "mysql",
        }
        for p in body.playbooks
    ]
    count = upsert_records(body.tenant_id, body.twin_id, "seller", records)
    return {"synced": count, "total": len(records)}
