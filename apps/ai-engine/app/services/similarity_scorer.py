import re
from collections import Counter
from typing import Any

from app.core.config import settings

_FORMAL_MARKERS = frozenset(
    {"prezado", "cordialmente", "atenciosamente", "senhor", "senhora", "gostaria", "informamos"}
)
_INFORMAL_MARKERS = frozenset(
    {"vc", "tb", "blz", "valeu", "fala", "oi", "opa", "beleza", "show", "mano", "cara"}
)
_COMMERCIAL_MARKERS = frozenset(
    {"fechado", "combinado", "orçamento", "valor", "desconto", "promoção", "pix", "pagamento"}
)
_EMOJI_PATTERN = re.compile(
    r"[\U0001F300-\U0001F9FF\U00002600-\U000027BF\U0001F600-\U0001F64F]+"
)


def _tokenize(text: str) -> set[str]:
    return {w.lower() for w in re.findall(r"\b\w+\b", text) if len(w) > 2}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _marker_ratio(texts: list[str], markers: frozenset[str]) -> float:
    if not texts:
        return 0.0
    hits = sum(1 for t in texts for m in markers if m in t.lower())
    return hits / max(len(texts), 1)


def _emoji_rate(texts: list[str]) -> float:
    if not texts:
        return 0.0
    total_chars = sum(len(t) for t in texts) or 1
    emoji_chars = sum(len("".join(_EMOJI_PATTERN.findall(t))) for t in texts)
    return emoji_chars / total_chars


def _embedding_similarity(generated: str, corpus_sample: list[str]) -> float | None:
    if not settings.openai_api_key or not corpus_sample:
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        texts = [generated[:2000]] + [t[:2000] for t in corpus_sample[:8]]
        resp = client.embeddings.create(model="text-embedding-3-small", input=texts)
        vectors = [d.embedding for d in resp.data]
        gen_vec = vectors[0]
        scores = []
        for vec in vectors[1:]:
            dot = sum(a * b for a, b in zip(gen_vec, vec))
            norm_a = sum(a * a for a in gen_vec) ** 0.5
            norm_b = sum(b * b for b in vec) ** 0.5
            if norm_a and norm_b:
                scores.append(dot / (norm_a * norm_b))
        return sum(scores) / len(scores) if scores else None
    except Exception:
        return None


def score_similarity(generated: str, corpus_messages: list[str]) -> dict[str, float]:
    """Compare generated text against user message corpus."""
    empty = {
        "formalidade": 0.5,
        "vocabulario": 0.5,
        "tom": 0.5,
        "tom_emocional": 0.5,
        "persuasao": 0.5,
        "geral": 0.5,
    }
    if not generated or not corpus_messages:
        return empty

    gen_tokens = _tokenize(generated)
    corp_tokens: set[str] = set()
    for msg in corpus_messages:
        corp_tokens.update(_tokenize(msg))

    vocabulario = _jaccard(gen_tokens, corp_tokens)

    gen_formal = _marker_ratio([generated], _FORMAL_MARKERS)
    gen_informal = _marker_ratio([generated], _INFORMAL_MARKERS)
    corp_formal = _marker_ratio(corpus_messages, _FORMAL_MARKERS)
    corp_informal = _marker_ratio(corpus_messages, _INFORMAL_MARKERS)
    gen_ratio = gen_formal / (gen_formal + gen_informal + 0.01)
    corp_ratio = corp_formal / (corp_formal + corp_informal + 0.01)
    formalidade = max(0.0, 1.0 - abs(gen_ratio - corp_ratio))

    gen_emoji = _emoji_rate([generated])
    corp_emoji = _emoji_rate(corpus_messages)
    tom_emocional = max(0.0, 1.0 - min(1.0, abs(gen_emoji * 50 - corp_emoji * 50)))

    gen_comm = _marker_ratio([generated], _COMMERCIAL_MARKERS)
    corp_comm = _marker_ratio(corpus_messages, _COMMERCIAL_MARKERS)
    persuasao = max(0.0, 1.0 - min(1.0, abs(gen_comm - corp_comm)))

    embed_score = _embedding_similarity(generated, corpus_messages)
    if embed_score is not None:
        vocabulario = (vocabulario + max(0.0, embed_score)) / 2

    geral = (formalidade + vocabulario + tom_emocional + persuasao) / 4
    return {
        "formalidade": round(formalidade, 3),
        "vocabulario": round(vocabulario, 3),
        "tom": round(tom_emocional, 3),
        "tom_emocional": round(tom_emocional, 3),
        "persuasao": round(persuasao, 3),
        "geral": round(geral, 3),
    }


def compute_baseline(corpus_messages: list[str]) -> dict[str, float]:
    """Internal corpus consistency baseline for DNA extraction."""
    if not corpus_messages:
        return score_similarity("", [])
    if len(corpus_messages) == 1:
        return score_similarity(corpus_messages[0], corpus_messages)

    sample = corpus_messages[: min(30, len(corpus_messages))]
    word_freq = Counter()
    for msg in sample:
        word_freq.update(_tokenize(msg))
    representative = " ".join(w for w, _ in word_freq.most_common(40))
    return score_similarity(representative, sample)


def corpus_bodies(messages: list[dict[str, Any]]) -> list[str]:
    return [
        m.get("body", m.get("chunk_text", ""))
        for m in messages
        if m.get("role") == "user" and (m.get("body") or m.get("chunk_text"))
    ]
