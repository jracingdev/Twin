import json
from pathlib import PurePosixPath

from twin_parsers.base import ParsedMessage
from twin_parsers.email_parser import parse_email_csv, parse_email_eml
from twin_parsers.facebook import parse_facebook
from twin_parsers.instagram import parse_instagram
from twin_parsers.messenger import parse_messenger
from twin_parsers.telegram import parse_telegram
from twin_parsers.whatsapp import parse_whatsapp
from twin_parsers.zip_util import extract_zip_entries

CHANNEL_SOURCES = frozenset({
    "whatsapp",
    "telegram",
    "instagram",
    "facebook",
    "messenger",
})


def _detect_channel_from_path(path: str, default: str | None = None) -> str:
    lower = path.lower().replace("\\", "/")
    if "instagram" in lower or "your_instagram_activity" in lower:
        return "instagram"
    if "messenger" in lower:
        return "messenger"
    if "facebook" in lower or "/messages/inbox/" in lower:
        return "facebook"
    if "telegram" in lower or lower.endswith("result.json"):
        return "telegram"
    if lower.endswith(".txt") and "whatsapp" not in lower:
        return default or "whatsapp"
    if lower.endswith(".txt"):
        return "whatsapp"
    if lower.endswith(".json"):
        if default and default in CHANNEL_SOURCES:
            return default
        return "telegram"
    return default or "whatsapp"


def _parse_file(
    path: str,
    content: bytes,
    default_channel: str | None = None,
    owner_name: str | None = None,
) -> list[ParsedMessage]:
    channel = _detect_channel_from_path(path, default_channel)
    suffix = PurePosixPath(path).suffix.lower()

    if suffix == ".txt":
        text = content.decode("utf-8", errors="replace")
        return parse_whatsapp(text, owner_name)

    if suffix == ".json":
        text = content.decode("utf-8", errors="replace")
        if channel == "instagram":
            return parse_instagram(text, owner_name, path)
        if channel == "facebook":
            return parse_facebook(text, owner_name, path)
        if channel == "messenger":
            return parse_messenger(text, owner_name, path)
        if channel == "telegram":
            return parse_telegram(text, owner_name)
        # Auto-detect Meta JSON
        try:
            data = json.loads(text)
            if isinstance(data, dict) and "messages" in data:
                if "instagram" in path.lower():
                    return parse_instagram(text, owner_name, path)
                if "messenger" in path.lower():
                    return parse_messenger(text, owner_name, path)
                return parse_facebook(text, owner_name, path)
            if isinstance(data, dict) and "messages" in data.get("chats", {}):
                return parse_telegram(text, owner_name)
        except json.JSONDecodeError:
            pass
        return parse_telegram(text, owner_name)

    if suffix == ".csv":
        return parse_email_csv(content.decode("utf-8", errors="replace"))

    if suffix == ".eml":
        return parse_email_eml(content)

    return []


def parse_zip(
    data: bytes,
    default_channel: str | None = None,
    owner_name: str | None = None,
) -> list[ParsedMessage]:
    out: list[ParsedMessage] = []
    for path, content in extract_zip_entries(data):
        out.extend(_parse_file(path, content, default_channel, owner_name))
    return out


def _is_zip_bytes(data: bytes) -> bool:
    return len(data) >= 4 and data[:2] == b"PK"


def parse_export(
    source: str,
    content: str | bytes,
    default_channel: str | None = None,
    owner_name: str | None = None,
) -> list[ParsedMessage]:
    source = source.lower()
    channel = default_channel or (source if source in CHANNEL_SOURCES else None)

    if isinstance(content, bytes):
        if source == "email" or (content[:5] == b"From:" if len(content) >= 5 else False):
            return parse_email_eml(content)
        if source == "zip" or _is_zip_bytes(content):
            return parse_zip(content, channel, owner_name)
        text = content.decode("utf-8", errors="replace")
    else:
        text = content
        if source == "zip":
            return parse_zip(text.encode("latin-1", errors="replace"), channel, owner_name)

    if source == "whatsapp":
        return parse_whatsapp(text, owner_name)
    if source == "telegram":
        return parse_telegram(text, owner_name)
    if source == "instagram":
        return parse_instagram(text, owner_name)
    if source == "facebook":
        return parse_facebook(text, owner_name)
    if source == "messenger":
        return parse_messenger(text, owner_name)
    if source == "email":
        if text.strip().startswith("From:"):
            return parse_email_eml(text.encode())
        return parse_email_csv(text)
    if source in ("json", "csv"):
        if source == "json":
            ch = channel or "json"
            if ch in CHANNEL_SOURCES:
                return parse_export(ch, text, channel=ch, owner_name=owner_name)
            data = json.loads(text)
            return [
                ParsedMessage(
                    contact=item.get("contact", "unknown"),
                    body=item.get("body", ""),
                    role=item.get("role", "user"),
                    sent_at=__import__("datetime").datetime.utcnow(),
                    channel=item.get("channel", ch),
                )
                for item in (data if isinstance(data, list) else data.get("messages", []))
            ]
        return parse_email_csv(text)

    return parse_whatsapp(text, owner_name)
