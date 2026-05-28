"""Parser para exportações JSON da Meta (Instagram, Facebook, Messenger)."""

from datetime import datetime, timezone

from twin_parsers.base import ParsedMessage

SKIP_TYPES = frozenset({
    "call",
    "share",
    "unsend",
    "thread_name",
    "subscribe",
    "unsubscribe",
})


def _parse_timestamp_ms(ts: int | float | str | None) -> datetime:
    if ts is None:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        ms = int(ts)
        return datetime.utcfromtimestamp(ms / 1000.0)
    except (TypeError, ValueError):
        return datetime.now(timezone.utc).replace(tzinfo=None)


def _message_body(msg: dict) -> str:
    content = msg.get("content") or msg.get("message") or ""
    if isinstance(content, str):
        return content.strip()
    return ""


def _infer_role(sender: str, owner_name: str | None, participants: list[str]) -> str:
    sender = (sender or "").strip()
    if owner_name and sender.lower() == owner_name.lower():
        return "user"
    if len(participants) == 1 and participants[0].lower() == sender.lower():
        return "user"
    return "contact"


def parse_meta_thread(
    data: dict,
    channel: str,
    owner_name: str | None = None,
    file_hint: str = "",
) -> list[ParsedMessage]:
    """Converte um ficheiro message_N.json de export Meta numa lista de mensagens."""
    messages = data.get("messages", [])
    participants = [
        p.get("name", p.get("username", ""))
        for p in data.get("participants", [])
        if isinstance(p, dict)
    ]
    participants = [str(p).strip() for p in participants if p]

    hint = file_hint.lower()
    if "instagram" in hint and channel not in ("instagram",):
        channel = "instagram"
    elif "messenger" in hint and channel not in ("messenger",):
        channel = "messenger"
    elif ("facebook" in hint or "/inbox/" in hint) and channel not in (
        "facebook",
        "messenger",
    ):
        channel = "facebook" if channel == "zip" else channel

    title = str(data.get("title", "")).strip()
    out: list[ParsedMessage] = []

    for msg in messages:
        if not isinstance(msg, dict):
            continue
        msg_type = (msg.get("type") or "Generic").lower()
        if msg_type in SKIP_TYPES and not _message_body(msg):
            continue

        body = _message_body(msg)
        if not body:
            photos = msg.get("photos") or msg.get("videos") or msg.get("files")
            if photos:
                body = "[mídia]"
            else:
                continue

        sender = str(msg.get("sender_name", msg.get("sender", "unknown"))).strip()

        dt = _parse_timestamp_ms(msg.get("timestamp_ms", msg.get("timestamp")))
        role = _infer_role(sender, owner_name, participants)

        out.append(
            ParsedMessage(
                contact=sender or title or "unknown",
                body=body[:50000],
                role=role,
                sent_at=dt,
                channel=channel,
            )
        )

    return out


def parse_meta_export_json(
    text: str,
    channel: str,
    owner_name: str | None = None,
    file_hint: str = "",
) -> list[ParsedMessage]:
    import json

    data = json.loads(text)
    if isinstance(data, list):
        out: list[ParsedMessage] = []
        for item in data:
            if isinstance(item, dict):
                out.extend(parse_meta_thread(item, channel, owner_name, file_hint))
        return out
    if isinstance(data, dict):
        if "messages" in data:
            return parse_meta_thread(data, channel, owner_name, file_hint)
        # Export com múltiplas threads no topo
        for key in ("threads", "conversations", "chats"):
            if key in data and isinstance(data[key], list):
                out = []
                for thread in data[key]:
                    if isinstance(thread, dict):
                        out.extend(parse_meta_thread(thread, channel, owner_name, file_hint))
                return out
    return []
