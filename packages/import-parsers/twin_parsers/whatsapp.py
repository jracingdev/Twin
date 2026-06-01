import re
from datetime import datetime

from twin_parsers.base import ParsedMessage

# [DD/MM/YYYY, HH:MM:SS] Nome: mensagem  (PT-BR com colchetes)
WA_PATTERN_BR = re.compile(
    r"^\[(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\]\s+([^:]+):\s(.*)$",
    re.MULTILINE,
)

# [M/D/YY, H:MM:SS AM/PM] Name: message  (en-US com colchetes)
WA_PATTERN_US = re.compile(
    r"^\[(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)?\]\s+([^:]+):\s(.*)$",
    re.MULTILINE | re.IGNORECASE,
)

# DD/MM/YYYY HH:MM - Nome: mensagem  (Android sem colchetes, PT-BR)
WA_PATTERN_ANDROID = re.compile(
    r"^(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+-\s+([^:]+):\s(.*)$",
    re.MULTILINE,
)

# M/D/YY, H:MM AM/PM - Name: message  (Android sem colchetes, en-US)
WA_PATTERN_ANDROID_US = re.compile(
    r"^(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)?\s+-\s+([^:]+):\s(.*)$",
    re.MULTILINE | re.IGNORECASE,
)

SYSTEM_MARKERS = (
    "mensagens e chamadas são protegidas",
    "messages and calls are end-to-end",
    "você criou o grupo",
    "you created group",
    "alterou o assunto",
    "changed the subject",
    "adicionou",
    "added",
    "saiu",
    "left",
    "encriptação",
    "encryption",
)


def _parse_dt(date_s: str, time_s: str, am_pm: str | None = None) -> datetime:
    time_s = time_s.strip()
    if am_pm:
        for fmt in ("%d/%m/%Y %I:%M:%S %p", "%d/%m/%Y %I:%M %p", "%m/%d/%Y %I:%M:%S %p", "%m/%d/%Y %I:%M %p"):
            try:
                return datetime.strptime(f"{date_s} {time_s} {am_pm.upper()}", fmt)
            except ValueError:
                continue
    for fmt in (
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d/%m/%y %H:%M:%S",
        "%d/%m/%y %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%m/%d/%y %H:%M",
    ):
        try:
            return datetime.strptime(f"{date_s} {time_s}", fmt)
        except ValueError:
            continue
    return datetime.utcnow()


def _is_system(body: str) -> bool:
    lower = body.lower()
    return any(m in lower for m in SYSTEM_MARKERS)


def parse_whatsapp(text: str, owner_name: str | None = None) -> list[ParsedMessage]:
    messages: list[ParsedMessage] = []
    patterns = [WA_PATTERN_BR, WA_PATTERN_US, WA_PATTERN_ANDROID, WA_PATTERN_ANDROID_US]

    for pattern in patterns:
        for m in pattern.finditer(text):
            groups = m.groups()
            if len(groups) == 5:
                date_s, time_s, am_pm, sender, body = groups
            else:
                date_s, time_s, sender, body = groups
                am_pm = None

            body = body.strip()
            if not body or body == "<Mídia omitida>" or body == "<Media omitted>":
                continue
            if _is_system(body):
                continue

            dt = _parse_dt(date_s, time_s, am_pm)
            sender = sender.strip()
            role = "user"
            if owner_name:
                role = "user" if sender.lower() == owner_name.lower() else "contact"

            messages.append(
                ParsedMessage(
                    contact=sender,
                    body=body,
                    role=role,
                    sent_at=dt,
                    channel="whatsapp",
                )
            )

        if messages:
            break

    return messages
