import re
from collections import Counter
from datetime import datetime
from typing import Any


def extract_behavioral_dna(messages: list[dict]) -> dict[str, Any]:
    user_msgs = [m for m in messages if m.get("role") == "user"]
    bodies = [m.get("body", "") for m in user_msgs if m.get("body")]

    if not bodies:
        return _default_dna()

    lengths = [len(b) for b in bodies]
    emoji_pattern = re.compile(
        r"[\U0001F300-\U0001F9FF\U00002600-\U000027BF\U0001F600-\U0001F64F]+"
    )
    emoji_count = sum(len(emoji_pattern.findall(b)) for b in bodies)

    words = Counter()
    for b in bodies:
        words.update(w.lower() for w in re.findall(r"\b\w+\b", b) if len(w) > 2)

    slang_candidates = [w for w, c in words.most_common(30) if c >= 3 and len(w) <= 6]

    greetings = []
    for b in bodies[:200]:
        first = b.split("\n")[0][:40].strip()
        if first and len(first) < 35:
            greetings.append(first)

    greeting_patterns = list(dict.fromkeys(greetings))[:5]

    formality = _estimate_formality(bodies)
    avg_len = int(sum(lengths) / len(lengths))
    emoji_rate = round(emoji_count / max(len(bodies), 1), 3)

    radar = [
        {"trait": "Formalidade", "value": int(formality * 100)},
        {"trait": "Emojis", "value": min(100, int(emoji_rate * 200))},
        {"trait": "Empatia", "value": 55},
        {"trait": "Comercial", "value": min(100, len(_extract_closing_phrases(bodies)) * 20)},
        {"trait": "Objetividade", "value": max(20, min(100, 120 - avg_len))},
        {"trait": "Naturalidade", "value": 70},
    ]

    return {
        "version": "1.0.0",
        "radar": radar,
        "writing_style": {
            "avg_message_length": int(sum(lengths) / len(lengths)),
            "formality": round(formality, 2),
            "emoji_rate": emoji_rate,
            "slang_lexicon": slang_candidates[:10],
            "greeting_patterns": greeting_patterns or ["Olá"],
            "sentence_structure": "short_direct" if sum(lengths) / len(lengths) < 80 else "detailed",
        },
        "temporal": {
            "median_reply_minutes": 8,
            "active_hours": [9, 18],
        },
        "commercial": {
            "negotiation_style": "consultive",
            "objection_patterns": [],
            "closing_phrases": _extract_closing_phrases(bodies),
        },
        "emotional": {
            "baseline_tone": "warm_pragmatic",
            "empathy_markers": [],
        },
        "intensity_presets": {
            "light": {"temperature": 0.5, "style_weight": 0.3},
            "moderate": {"temperature": 0.7, "style_weight": 0.6},
            "advanced": {"temperature": 0.8, "style_weight": 0.85},
            "ultra": {"temperature": 0.9, "style_weight": 1.0, "few_shot_k": 8},
        },
        "extracted_at": datetime.utcnow().isoformat(),
    }


def _estimate_formality(bodies: list[str]) -> float:
    formal_markers = ["prezado", "cordialmente", "atenciosamente", "senhor", "senhora"]
    informal_markers = ["vc", "tb", "blz", "valeu", "fala", "oi"]
    formal = sum(1 for b in bodies for m in formal_markers if m in b.lower())
    informal = sum(1 for b in bodies for m in informal_markers if m in b.lower())
    total = formal + informal + 1
    return max(0.1, min(0.9, informal / total))


def _extract_closing_phrases(bodies: list[str]) -> list[str]:
    closings = []
    keywords = ["fechado", "combinado", "pode ser", "segue pix", "envio o orçamento"]
    for b in bodies:
        low = b.lower()
        for k in keywords:
            if k in low:
                closings.append(b[-80:].strip())
                break
    return list(dict.fromkeys(closings))[:5]


def _default_dna() -> dict[str, Any]:
    return extract_behavioral_dna([{"role": "user", "body": "Olá, tudo bem?"}])
