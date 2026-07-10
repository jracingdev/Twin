import json
from typing import Any

import redis

from app.core.config import settings
from app.services.pinecone_client import search, upsert_records


def _redis() -> redis.Redis:
    return redis.from_url(settings.redis_url, decode_responses=True)


class MemoryService:
    """Memória hierárquica: L1 Redis, L2/L3 Pinecone + episódica."""

    def working_set(self, session_id: str) -> list[dict]:
        raw = _redis().get(f"wm:{session_id}")
        return json.loads(raw) if raw else []

    def push_working(self, session_id: str, message: dict, limit: int = 20) -> None:
        items = self.working_set(session_id)
        items.append(message)
        _redis().setex(f"wm:{session_id}", 3600, json.dumps(items[-limit:]))

    def retrieve_context(
        self,
        tenant_id: str,
        twin_id: str,
        query: str,
        contact_id: str | None = None,
        top_k: int = 8,
        *,
        style_only: bool = False,
    ) -> dict[str, Any]:
        """Retrieve style corpus + optional contact memories.

        Style messages (namespace msgs) are NEVER filtered by live contact_id:
        import indexes seller lines as contact_id=self, while channel webhooks
        pass MySQL customer UUIDs — filtering would return zero style hits.
        """
        # Seller writing style: global twin corpus (no contact filter).
        msgs = search(tenant_id, twin_id, "msgs", query, top_k=top_k, filter_meta=None)
        mem = search(tenant_id, twin_id, "memory", query, top_k=5)

        contacts: list = []
        if contact_id and not style_only:
            contacts = search(
                tenant_id,
                twin_id,
                "contacts",
                query,
                top_k=3,
                filter_meta={"contact_id": {"$eq": contact_id}},
            )

        return {"messages": msgs, "memories": mem, "contacts": contacts}

    def upsert_memory(self, tenant_id: str, twin_id: str, record: dict) -> None:
        upsert_records(tenant_id, twin_id, "memory", [record])
