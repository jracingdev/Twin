import hashlib
import re


_MD_BOLD = re.compile(r"\*\*([^*]+)\*\*")
_MD_ITALIC = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)")
_MD_HEADERS = re.compile(r"^#{1,6}\s+", re.MULTILINE)
_MD_BULLETS = re.compile(r"^\s*[-*•]\s+", re.MULTILINE)
_MD_CODE = re.compile(r"`([^`]+)`")
_MULTI_NL = re.compile(r"\n{3,}")


def _stable_unit(seed: str) -> float:
    digest = hashlib.sha256(seed.encode("utf-8", errors="replace")).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def _strip_markdown(text: str) -> str:
    text = _MD_BOLD.sub(r"\1", text)
    text = _MD_ITALIC.sub(r"\1", text)
    text = _MD_CODE.sub(r"\1", text)
    text = _MD_HEADERS.sub("", text)
    text = _MD_BULLETS.sub("", text)
    text = text.replace("**", "").replace("__", "")
    return _MULTI_NL.sub("\n\n", text).strip()


def postprocess(text: str, dna: dict, intensity: int) -> str:
    """Apply DNA writing_style to LLM output for chat channels (deterministic)."""
    style = dna.get("writing_style", {}) or {}
    emoji_rate = float(style.get("emoji_rate", 0.1) or 0.1)
    avg_len = int(style.get("avg_message_length", 80) or 80)
    formality = float(style.get("formality", 0.5) or 0.5)

    text = _strip_markdown(text.strip())
    if not text:
        return text

    # Soft length control by intensity (chat, not essay).
    max_chars = {
        1: max(120, avg_len),
        2: max(180, int(avg_len * 1.5)),
        3: max(280, int(avg_len * 2.2)),
        4: max(400, int(avg_len * 3)),
    }.get(intensity, max(180, int(avg_len * 1.5)))

    if len(text) > max_chars:
        sentences = re.split(r"(?<=[.!?…])\s+", text)
        keep = 2 if intensity <= 2 else 3 if intensity == 3 else 4
        text = " ".join(sentences[:keep]).strip() or text[:max_chars].rsplit(" ", 1)[0]

    # Deterministic light emoji nudge when DNA uses emojis and intensity is high.
    has_emoji = bool(re.search(r"[\U0001F300-\U0001F9FF]", text))
    if intensity >= 3 and emoji_rate > 0.12 and not has_emoji and formality < 0.65:
        if _stable_unit(text[:80]) < min(0.45, emoji_rate + 0.1):
            pick = [" 👍", " 😊", " ✅", " 🙌"]
            text += pick[int(_stable_unit(text[::-1][:40]) * len(pick)) % len(pick)]

    return text.strip()
