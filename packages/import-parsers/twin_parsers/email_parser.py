import csv
import io
from datetime import datetime
from email import policy
from email.parser import BytesParser

from twin_parsers.base import ParsedMessage


def parse_email_eml(raw: bytes) -> list[ParsedMessage]:
    msg = BytesParser(policy=policy.default).parsebytes(raw)
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                body = part.get_content()
                break
    else:
        body = msg.get_content()
    return [
        ParsedMessage(
            contact=msg.get("From", "unknown"),
            body=str(body)[:50000],
            role="user",
            sent_at=datetime.utcnow(),
            channel="email",
        )
    ]


def parse_email_csv(text: str) -> list[ParsedMessage]:
    reader = csv.DictReader(io.StringIO(text))
    out = []
    for row in reader:
        out.append(
            ParsedMessage(
                contact=row.get("from", row.get("From", "unknown")),
                body=row.get("body", row.get("Body", "")),
                role="user",
                sent_at=datetime.utcnow(),
                channel="email",
            )
        )
    return out
