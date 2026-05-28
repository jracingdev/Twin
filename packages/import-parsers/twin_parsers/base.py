from dataclasses import dataclass
from datetime import datetime
import hashlib


@dataclass
class ParsedMessage:
    contact: str
    body: str
    role: str
    sent_at: datetime
    channel: str

    @property
    def source(self) -> str:
        """Alias legado para channel."""
        return self.channel

    @property
    def content_hash(self) -> str:
        norm = f"{self.contact}|{self.sent_at.isoformat()}|{self.body.strip().lower()}"
        return hashlib.sha256(norm.encode()).hexdigest()
