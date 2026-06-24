from typing import Any

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Limite do Pinecone para upsert_records em índices com embedding integrado
UPSERT_BATCH_SIZE = 96

_pc_index = None
_pc_unavailable = False


def _connect_index(pc: Any):
    if settings.pinecone_index_host:
        host = settings.pinecone_index_host.removeprefix("https://").removeprefix("http://")
        return pc.Index(host=host)
    if hasattr(pc, "index"):
        return pc.index(settings.pinecone_index)
    return pc.Index(settings.pinecone_index)


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
            _pc_index = _connect_index(pc)
        except Exception as exc:
            logger.warning("Pinecone indisponível (ingest continua sem indexação): %s", exc)
            _pc_unavailable = True
            return None
    return _pc_index


def namespace(tenant_id: str, twin_id: str, kind: str) -> str:
    return f"t_{tenant_id}_tw_{twin_id}_{kind}"


def _hits_from_response(response: Any) -> list[dict]:
    if hasattr(response, "result") and hasattr(response.result, "hits"):
        out: list[dict] = []
        for hit in response.result.hits:
            fields = dict(hit.fields) if getattr(hit, "fields", None) else {}
            if getattr(hit, "id", None):
                fields.setdefault("_id", hit.id)
            if getattr(hit, "score", None) is not None:
                fields["score"] = hit.score
            out.append(fields)
        return out
    if isinstance(response, dict):
        hits = response.get("result", {}).get("hits", [])
        return [h.get("fields", h) if isinstance(h, dict) else h for h in hits]
    return []


def upsert_records(tenant_id: str, twin_id: str, kind: str, records: list[dict[str, Any]]) -> int:
    if not records:
        return 0
    index = get_index()
    if index is None:
        return len(records)
    if not hasattr(index, "upsert_records"):
        raise RuntimeError(
            "pinecone SDK >= 6 é necessário para índices com embedding integrado. "
            "Execute: pip install 'pinecone>=6.0.0' no venv do ai-engine."
        )
    ns = namespace(tenant_id, twin_id, kind)
    total = 0
    for offset in range(0, len(records), UPSERT_BATCH_SIZE):
        batch = records[offset : offset + UPSERT_BATCH_SIZE]
        index.upsert_records(namespace=ns, records=batch)
        total += len(batch)
    return total


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

    try:
        if hasattr(index, "search"):
            kwargs: dict[str, Any] = {
                "namespace": ns,
                "top_k": top_k,
                "inputs": {"text": query_text},
            }
            if filter_meta:
                kwargs["filter"] = filter_meta
            return _hits_from_response(index.search(**kwargs))

        query: dict[str, Any] = {
            "inputs": {"text": query_text},
            "top_k": top_k,
        }
        if filter_meta:
            query["filter"] = filter_meta
        return _hits_from_response(index.search_records(namespace=ns, query=query))
    except Exception as exc:
        logger.warning(
            "Pinecone search falhou (tenant=%s twin=%s kind=%s): %s",
            tenant_id,
            twin_id,
            kind,
            exc,
        )
        return []


def delete_twin_namespaces(tenant_id: str, twin_id: str) -> None:
    index = get_index()
    if index is None:
        return
    for kind in ("msgs", "memory", "seller", "contacts"):
        try:
            ns = namespace(tenant_id, twin_id, kind)
            if hasattr(index, "delete_namespace"):
                index.delete_namespace(namespace=ns)
        except Exception:
            pass


def ensure_index_exists() -> dict:
    if not settings.pinecone_api_key:
        return {"status": "skipped", "reason": "no API key"}

    from pinecone import Pinecone

    pc = Pinecone(api_key=settings.pinecone_api_key)
    name = settings.pinecone_index

    try:
        if hasattr(pc, "has_index") and pc.has_index(name):
            return {"status": "exists", "name": name}
        existing = {idx.name for idx in pc.list_indexes()}
        if name in existing:
            return {"status": "exists", "name": name}
    except Exception as exc:
        if settings.pinecone_index_host:
            return {
                "status": "exists",
                "name": name,
                "host": settings.pinecone_index_host,
                "note": "host configurado manualmente",
            }
        return {"status": "error", "reason": str(exc)}

    create = getattr(pc, "create_index_for_model", None)
    if create is None:
        return {
            "status": "missing",
            "name": name,
            "hint": "Crie o índice no console Pinecone (integrated embeddings) ou pip install 'pinecone>=6'.",
        }

    create(
        name=name,
        cloud="aws",
        region="us-east-1",
        embed={"model": settings.embed_model, "field_map": {"text": "chunk_text"}},
    )
    return {"status": "created", "name": name}
