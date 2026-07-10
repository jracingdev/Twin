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
    owner_name: str | None = None,
) -> dict:
    raw = base64.b64decode(content_b64)
    source = source.lower()
    if source not in VALID_SOURCES:
        raise ValueError(f"Fonte de importação não suportada: {source}")

    default_channel = channel or (source if source not in ("zip", "json", "csv") else None)
    messages = parse_export(
        source, raw, default_channel=default_channel, owner_name=owner_name or None
    )

    records = []
    db_messages = []
    user_count = 0
    contact_count = 0
    for i, m in enumerate(messages):
        body = m.body[:8000]
        msg_channel = m.channel or source

        if m.role == "user":
            user_count += 1
            # Style corpus: mark as twin/self so live RAG never filters by customer UUID.
            records.append({
                "_id": f"{batch_id}_{i}",
                "chunk_text": body,
                "message_id": f"{batch_id}_{i}",
                "role": m.role,
                "contact_id": "self",
                "speaker": m.contact or "unknown",
                "source": msg_channel,
                "channel": msg_channel,
                "is_user_message": True,
            })
        else:
            contact_count += 1

        if len(db_messages) < 2000:
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
            "vertical": p.get("vertical", "general"),
        }
        for i, p in enumerate(playbooks)
    ]
    upsert_records(tenant_id, twin_id, "seller", seller_records)

    channels_found = sorted({m.channel for m in messages if m.channel})

    truncated = len(messages) > 2000 or len(records) > 2000
    warning = None
    if truncated:
        warning = (
            f"Import truncado em 2000 mensagens "
            f"(total parseado: {len(messages)}; indexáveis user: {len(records)})."
        )
    if owner_name is None and source in ("whatsapp", "zip") and user_count and contact_count == 0:
        hint = (
            "Nenhum owner_name informado e não foi possível separar vendedor/cliente. "
            "Reimporte com o nome do vendedor (como aparece no export) para um clone fiel."
        )
        warning = f"{warning} {hint}" if warning else hint

    result = {
        "batch_id": batch_id,
        "total_messages": len(messages),
        "processed_messages": count,
        "indexed_user_messages": min(len(records), 2000),
        "seller_messages": user_count,
        "contact_messages": contact_count,
        "owner_name": owner_name,
        "messages": db_messages,
        "playbooks": [
            {
                "intent": p.get("intent", "general"),
                "template": p.get("template", ""),
                "vertical": p.get("vertical", "general"),
                "variables": p.get("variables", []),
            }
            for p in playbooks[:20]
        ],
        "channels": channels_found,
        "truncated": truncated,
    }
    if warning:
        result["warning"] = warning

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
