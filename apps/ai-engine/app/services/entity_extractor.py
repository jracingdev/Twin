"""Lightweight entity extraction from message pairs (products, objections, topics)."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

_PRODUCT_PATTERNS = re.compile(
    r"\b(?:produto|peça|peca|item|modelo|kit|serviço|servico|plano|pacote)\s+[\w\-]+",
    re.IGNORECASE,
)
_PRICE_PATTERN = re.compile(r"R\$\s*[\d.,]+|\b\d+[,.]?\d*\s*(?:reais|real)\b", re.IGNORECASE)

_OBJECTION_MARKERS: list[tuple[str, str]] = [
    ("price", r"\b(?:caro|preço|preco|valor alto|muito caro|desconto)\b"),
    ("timing", r"\b(?:depois|mais tarde|não agora|nao agora|sem pressa)\b"),
    ("trust", r"\b(?:não confio|nao confio|desconfio|golpe|fraude)\b"),
    ("competition", r"\b(?:concorrente|outro lugar|mais barato em)\b"),
    ("need", r"\b(?:não preciso|nao preciso|não quero|nao quero)\b"),
]

_TOPIC_MARKERS: list[tuple[str, str]] = [
    ("pricing", r"\b(?:preço|preco|orçamento|orcamento|valor|custo|pagamento|pix|boleto)\b"),
    ("delivery", r"\b(?:entrega|prazo|frete|envio|retirada)\b"),
    ("support", r"\b(?:garantia|troca|defeito|suporte|problema|ajuda)\b"),
    ("closing", r"\b(?:fechado|combinado|confirmado|pode mandar|vou levar)\b"),
    ("greeting", r"\b(?:oi|olá|ola|bom dia|boa tarde|boa noite|fala)\b"),
    ("product_inquiry", r"\b(?:tem|disponível|disponivel|estoque|modelo|versão|versao)\b"),
]

_STOPWORDS = frozenset(
    "de da do das dos em no na nos nas um uma uns umas o a os as e que para com por".split()
)


def _unique_preserve(items: list[str], limit: int = 10) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        key = item.lower().strip()
        if key and key not in seen:
            seen.add(key)
            out.append(item.strip())
        if len(out) >= limit:
            break
    return out


def _match_labels(text: str, markers: list[tuple[str, str]]) -> list[str]:
    low = text.lower()
    return [label for label, pattern in markers if re.search(pattern, low)]


def _extract_products(text: str) -> list[str]:
    products: list[str] = []
    for m in _PRODUCT_PATTERNS.findall(text):
        products.append(m.strip())
    for m in _PRICE_PATTERN.findall(text):
        products.append(m.strip())
    tokens = [w for w in re.findall(r"\b[A-Z][\w\-]{2,}\b", text) if w.lower() not in _STOPWORDS]
    products.extend(tokens[:5])
    return _unique_preserve(products)


def _suggested_edges(
    topics: list[str],
    objections: list[str],
    products: list[str],
) -> list[dict[str, str]]:
    edges: list[dict[str, str]] = []
    for objection in objections:
        for topic in topics:
            if topic == "pricing" and objection == "price":
                edges.append({
                    "from": f"topic:{topic}",
                    "to": f"objection:{objection}",
                    "relation": "addresses",
                })
            elif topic == "closing" and objection in ("timing", "need"):
                edges.append({
                    "from": f"topic:{topic}",
                    "to": f"objection:{objection}",
                    "relation": "overcomes",
                })
    for product in products[:3]:
        for topic in topics:
            if topic in ("product_inquiry", "pricing"):
                edges.append({
                    "from": f"product:{product[:40]}",
                    "to": f"topic:{topic}",
                    "relation": "mentioned_in",
                })
    seen: set[tuple[str, str, str]] = set()
    unique: list[dict[str, str]] = []
    for e in edges:
        key = (e["from"], e["to"], e["relation"])
        if key not in seen:
            seen.add(key)
            unique.append(e)
    return unique[:15]


def extract_from_pair(input_text: str, output_text: str | None = None) -> dict[str, Any]:
    combined = f"{input_text} {output_text or ''}"
    topics_in = _match_labels(input_text, _TOPIC_MARKERS)
    topics_out = _match_labels(output_text or "", _TOPIC_MARKERS) if output_text else []
    topic_counts = Counter(topics_in + topics_out)
    topics = [t for t, _ in topic_counts.most_common(8)]

    objections_in = _match_labels(input_text, _OBJECTION_MARKERS)
    objections_out = _match_labels(output_text or "", _OBJECTION_MARKERS) if output_text else []
    objection_counts = Counter(objections_in + objections_out)
    objections = [o for o, _ in objection_counts.most_common(5)]

    products = _extract_products(combined)

    return {
        "products": products,
        "objections": objections,
        "topics": topics,
        "suggested_edges": _suggested_edges(topics, objections, products),
    }


def extract_from_pairs(pairs: list[dict[str, str]]) -> dict[str, Any]:
    merged: dict[str, list[str]] = {"products": [], "objections": [], "topics": []}
    all_edges: list[dict[str, str]] = []

    for pair in pairs:
        result = extract_from_pair(
            pair.get("input", pair.get("input_text", "")),
            pair.get("output", pair.get("output_text")),
        )
        for key in ("products", "objections", "topics"):
            merged[key].extend(result[key])
        all_edges.extend(result["suggested_edges"])

    topics = _unique_preserve(merged["topics"], 12)
    objections = _unique_preserve(merged["objections"], 8)
    products = _unique_preserve(merged["products"], 12)

    edge_seen: set[tuple[str, str, str]] = set()
    edges: list[dict[str, str]] = []
    for e in all_edges:
        key = (e["from"], e["to"], e["relation"])
        if key not in edge_seen:
            edge_seen.add(key)
            edges.append(e)

    return {
        "products": products,
        "objections": objections,
        "topics": topics,
        "suggested_edges": edges[:20],
        "pair_count": len(pairs),
    }
