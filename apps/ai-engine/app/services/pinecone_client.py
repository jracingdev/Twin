from typing import Any

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

_pc_index = None
_pc_unavailable = False


def get_index():
    global _pc_index, _pc_unavailable
    if _pc_unavailable:
        return None
    if _pc_index is None:
        if not settings.pinecone_api_key:
            return None
        try:
            from pinecone import Pinecone

            pc = Pinecone(api_key=settings.pinecone_api_key)
            _pc_index = pc.Index(settings.pinecone_index)
        except Exception as exc:
            logger.warning("Pinecone indisponível (ingest continua sem indexação): %s", exc)
            _pc_unavailable = True
            return None
    return _pc_index


def namespace(tenant_id: str, twin_id: str, kind: str) -> str:
    return f"t_{tenant_id}_tw_{twin_id}_{kind}"


def upsert_records(tenant_id: str, twin_id: str, kind: str, records: list[dict[str, Any]]) -> int:
    index = get_index()
    if index is None:
        return len(records)
    ns = namespace(tenant_id, twin_id, kind)
    index.upsert_records(namespace=ns, records=records)
    return len(records)


def search(
    tenant_id: str,
    twin_id: str,
    kind: str,
    query_text: str,
    top_k: int = 8,
    filter_meta: dict | None = None,
) -> list[dict]:
    index = get_index()
    if index is None:
        return []
    ns = namespace(tenant_id, twin_id, kind)
    q: dict = {
        "inputs": {"text": query_text},
        "top_k": top_k,
    }
    if filter_meta:
        q["filter"] = filter_meta
    result = index.search_records(namespace=ns, query=q)
    hits = result.get("result", {}).get("hits", [])
    return [h.get("fields", h) for h in hits]


def delete_twin_namespaces(tenant_id: str, twin_id: str) -> None:
    index = get_index()
    if index is None:
        return
    for kind in ("msgs", "memory", "seller", "contacts"):
        try:
            index.delete_namespace(namespace=namespace(tenant_id, twin_id, kind))
        except Exception:
            pass


def ensure_index_exists() -> dict:
    if not settings.pinecone_api_key:
        return {"status": "skipped", "reason": "no API key"}
    from pinecone import Pinecone, ServerlessSpec

    pc = Pinecone(api_key=settings.pinecone_api_key)
    existing = [i.name for i in pc.list_indexes()]
    if settings.pinecone_index in existing:
        return {"status": "exists", "name": settings.pinecone_index}
    pc.create_index_for_model(
        name=settings.pinecone_index,
        cloud="aws",
        region="us-east-1",
        embed={"model": settings.embed_model, "field_map": {"text": "chunk_text"}},
    )
    return {"status": "created", "name": settings.pinecone_index}
