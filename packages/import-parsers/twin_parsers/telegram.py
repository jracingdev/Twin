import json
from datetime import datetime

from twin_parsers.base import ParsedMessage


def _extract_text(body) -> str:
    if isinstance(body, str):
        return body.strip()
    if isinstance(body, list):
        return "".join(
            part if isinstance(part, str) else part.get("text", "")
            for part in body
        ).strip()
    return ""


def parse_telegram(text: str, owner_name: str | None = None) -> list[ParsedMessage]:
    data = json.loads(text)
    if isinstance(data, dict) and "messages" in data:
        messages = data["messages"]
        chat_name = data.get("name", "")
    elif isinstance(data, list):
        messages = data
        chat_name = ""
    else:
        messages = []
        chat_name = ""

    out: list[ParsedMessage] = []
    for m in messages:
        if not isinstance(m, dict):
            continue
        msg_type = m.get("type", "message")
        if msg_type not in ("message", "private", "group"):
            continue

        body = _extract_text(m.get("text", ""))
        if not body:
            continue

        from_name = m.get("from") or m.get("from_id") or chat_name or "unknown"
        from_name = str(from_name)

        date_val = m.get("date")
        if isinstance(date_val, str):
            try:
                dt = datetime.fromisoformat(date_val.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                dt = datetime.utcnow()
        elif isinstance(date_val, (int, float)):
            dt = datetime.utcfromtimestamp(date_val)
        else:
            dt = datetime.utcnow()

        is_out = m.get("out", False)
        if owner_name:
            role = "user" if from_name.lower() == owner_name.lower() or is_out else "contact"
        else:
            role = "user" if is_out else "contact"

        out.append(
            ParsedMessage(
                contact=from_name,
                body=body,
                role=role,
                sent_at=dt,
                channel="telegram",
            )
        )

    return out
