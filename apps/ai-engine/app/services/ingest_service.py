import base64

from twin_parsers import parse_export

from app.services.laravel_callback import notify_job_complete
from app.services.pinecone_client import upsert_records
from app.services.seller_engine import SellerEngine

seller = SellerEngine()

VALID_SOURCES = frozenset({
    "whatsapp",
    "telegram",
    "instagram",
    "facebook",
    "messenger",
    "email",
    "json",
    "csv",
    "zip",
})


def process_ingest_batch(
    tenant_id: str,
    twin_id: str,
    batch_id: str,
    source: str,
    content_b64: str,
    channel: str | None = None,
) -> dict:
    raw = base64.b64decode(content_b64)
    source = source.lower()
    if source not in VALID_SOURCES:
        raise ValueError(f"Fonte de importação não suportada: {source}")

    default_channel = channel or (source if source not in ("zip", "json", "csv") else None)
    messages = parse_export(source, raw, default_channel=default_channel)

    records = []
    db_messages = []
    for i, m in enumerate(messages):
        if m.role != "user":
            continue
        body = m.body[:8000]
        msg_channel = m.channel or source
        records.append({
            "_id": f"{batch_id}_{i}",
            "chunk_text": body,
            "message_id": f"{batch_id}_{i}",
            "role": m.role,
            "contact_id": m.contact or "unknown",
            "source": msg_channel,
            "channel": msg_channel,
            "is_user_message": True,
        })
        if len(db_messages) < 500:
            db_messages.append({
                "role": m.role,
                "body": body,
                "contact": m.contact or "unknown",
                "channel": msg_channel,
            })

    count = upsert_records(tenant_id, twin_id, "msgs", records[:2000])

    playbooks = seller.extract_playbooks(
        [{"body": m.body, "role": m.role} for m in messages if m.role == "user"]
    )
    seller_records = [
        {
            "_id": f"pb_{batch_id}_{i}",
            "chunk_text": p["template"],
            "intent": p["intent"],
        }
        for i, p in enumerate(playbooks)
    ]
    upsert_records(tenant_id, twin_id, "seller", seller_records)

    channels_found = sorted({m.channel for m in messages if m.channel})

    result = {
        "batch_id": batch_id,
        "total_messages": len(messages),
        "processed_messages": count,
        "indexed_user_messages": len(records),
        "messages": db_messages,
        "channels": channels_found,
    }

    notify_job_complete(
        batch_id,
        "import_batch",
        tenant_id,
        twin_id,
        "completed",
        total_messages=result["total_messages"],
        processed_messages=result["processed_messages"],
        messages=db_messages,
        result=result,
    )

    return result
