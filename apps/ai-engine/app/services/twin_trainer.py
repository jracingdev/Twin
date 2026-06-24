"""Twin Trainer — batch upsert of accepted Q&A pairs into Pinecone for continuous learning."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

from app.services.pinecone_client import upsert_records


def _record_id(item: dict[str, Any], index: int) -> str:
    meta = item.get("metadata") or {}
    if meta.get("id"):
        return str(meta["id"])
    if meta.get("suggestion_id"):
        return f"trainer_{meta['suggestion_id']}"
    digest = hashlib.sha256(
        f"{item['tenant_id']}:{item['twin_id']}:{item['input']}:{item['output']}:{index}".encode()
    ).hexdigest()[:16]
    return f"trainer_{digest}"


class TwinTrainer:
    def process_batch(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        if not items:
            return {"indexed": 0, "twins": []}

        grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
        for i, item in enumerate(items):
            key = (item["tenant_id"], item["twin_id"])
            grouped.setdefault(key, []).append((i, item))

        twins_result: list[dict[str, Any]] = []
        total_indexed = 0

        for (tenant_id, twin_id), batch in grouped.items():
            records: list[dict[str, Any]] = []
            for index, item in batch:
                meta = item.get("metadata") or {}
                accepted_at = meta.get("accepted_at") or datetime.now(timezone.utc).isoformat()
                record_id = _record_id(item, index)
                records.append({
                    "_id": record_id,
                    "chunk_text": item["output"][:8000],
                    "message_id": record_id,
                    "role": "assistant",
                    "input_text": item["input"][:8000],
                    "source": "trainer",
                    "accepted_at": accepted_at,
                    "is_user_message": False,
                    **{k: v for k, v in meta.items() if k not in ("id", "accepted_at")},
                })

            count = upsert_records(tenant_id, twin_id, "msgs", records)
            total_indexed += count
            twins_result.append({
                "tenant_id": tenant_id,
                "twin_id": twin_id,
                "indexed": count,
            })

        return {"indexed": total_indexed, "twins": twins_result}
