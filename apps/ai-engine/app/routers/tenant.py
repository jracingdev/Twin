from fastapi import APIRouter
from pydantic import BaseModel

from app.services.pinecone_client import delete_twin_namespaces, ensure_index_exists

router = APIRouter()


class PurgeRequest(BaseModel):
    tenant_id: str
    twin_id: str


@router.delete("/tenant/purge")
def purge_tenant(req: PurgeRequest):
    delete_twin_namespaces(req.tenant_id, req.twin_id)
    return {"status": "purged", "twin_id": req.twin_id}


@router.post("/pinecone/setup")
def pinecone_setup():
    return ensure_index_exists()
