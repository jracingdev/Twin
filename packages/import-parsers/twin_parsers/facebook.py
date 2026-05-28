from twin_parsers.meta_messages import parse_meta_export_json
from twin_parsers.base import ParsedMessage


def parse_facebook(text: str, owner_name: str | None = None, file_hint: str = "") -> list[ParsedMessage]:
    return parse_meta_export_json(text, "facebook", owner_name, file_hint)
