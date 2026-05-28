import random
import re


def postprocess(text: str, dna: dict, intensity: int) -> str:
    style = dna.get("writing_style", {})
    emoji_rate = style.get("emoji_rate", 0.1)
    avg_len = style.get("avg_message_length", 80)

    text = text.strip()

    if intensity >= 3 and emoji_rate > 0.15 and not re.search(r"[\U0001F300-\U0001F9FF]", text):
        if random.random() < emoji_rate:
            text += random.choice([" 👍", " 😊", " ✅", ""])

    if intensity <= 2 and len(text) > avg_len * 2:
        sentences = re.split(r"(?<=[.!?])\s+", text)
        text = " ".join(sentences[:3])

    greetings = style.get("greeting_patterns", [])
    if intensity >= 2 and greetings and not text.lower().startswith(tuple(g.lower()[:4] for g in greetings)):
        if random.random() < 0.3:
            g = greetings[0]
            if len(g) < 20:
                text = f"{g} {text}"

    return text
