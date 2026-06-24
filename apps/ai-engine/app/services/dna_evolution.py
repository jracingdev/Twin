import re
from collections import Counter
from datetime import datetime
from typing import Any

from app.services.dna_extractor import (
    _EMOJI_PATTERN,
    _abbreviation_rate,
    _extract_closings,
    _extract_frequent_phrases,
    _extract_openings,
    corpus_bodies,
)
from app.services.similarity_scorer import compute_baseline

_NUMERIC_SECTIONS = (
    ("psychological_estimate", ("extroversao", "assertividade", "empatia", "formalidade", "dominancia", "cordialidade")),
    ("communication", ("nivel_formalidade", "taxa_emojis", "uso_abreviacoes", "comprimento_medio_mensagem")),
)

_LIST_PATHS = (
    ("communication", "vocabulario_frequente"),
    ("communication", "girias"),
    ("communication", "frases_frequentes"),
    ("communication", "padroes_saudacao"),
    ("communication", "padroes_encerramento"),
    ("behavior", "como_inicia_conversas"),
    ("behavior", "como_encerra_conversas"),
    ("commercial", "gatilhos_persuasao"),
)


def _get_nested(payload: dict, *keys: str, default=None):
    node = payload
    for key in keys:
        if not isinstance(node, dict):
            return default
        node = node.get(key)
        if node is None:
            return default
    return node


def _radar_map(payload: dict) -> dict[str, float]:
    radar = payload.get("radar") or []
    return {item.get("trait", ""): float(item.get("value", 0)) for item in radar if item.get("trait")}


def _list_diff(old_items: list, new_items: list) -> dict[str, list[str]]:
    old_set = set(old_items or [])
    new_set = set(new_items or [])
    return {
        "added": sorted(new_set - old_set),
        "removed": sorted(old_set - new_set),
        "unchanged_count": len(old_set & new_set),
    }


def compare_dna_versions(old_payload: dict, new_payload: dict) -> dict[str, Any]:
    """Compare two DNA payloads and return trait deltas plus changed-field summary."""
    trait_deltas: list[dict[str, Any]] = []
    changed_fields: list[dict[str, Any]] = []

    old_radar = _radar_map(old_payload)
    new_radar = _radar_map(new_payload)
    for trait in sorted(set(old_radar) | set(new_radar)):
        old_val = old_radar.get(trait, 0.0)
        new_val = new_radar.get(trait, 0.0)
        if old_val != new_val:
            trait_deltas.append({
                "trait": trait,
                "old": old_val,
                "new": new_val,
                "delta": round(new_val - old_val, 3),
            })

    for section, fields in _NUMERIC_SECTIONS:
        for field in fields:
            old_val = _get_nested(old_payload, section, field)
            new_val = _get_nested(new_payload, section, field)
            if old_val is None and new_val is None:
                continue
            if old_val != new_val:
                path = f"{section}.{field}"
                changed_fields.append({
                    "path": path,
                    "old": old_val,
                    "new": new_val,
                    "delta": round(float(new_val or 0) - float(old_val or 0), 3)
                    if old_val is not None and new_val is not None
                    else None,
                })

    for section, field in _LIST_PATHS:
        old_list = _get_nested(old_payload, section, field, default=[]) or []
        new_list = _get_nested(new_payload, section, field, default=[]) or []
        diff = _list_diff(old_list, new_list)
        if diff["added"] or diff["removed"]:
            parts = []
            if diff["added"]:
                parts.append(f"+{len(diff['added'])} itens")
            if diff["removed"]:
                parts.append(f"-{len(diff['removed'])} itens")
            changed_fields.append({
                "path": f"{section}.{field}",
                "summary": ", ".join(parts),
                "added": diff["added"][:5],
                "removed": diff["removed"][:5],
            })

    for key in ("identity", "behavior", "commercial"):
        for sub_key in ("role", "resposta_duvidas", "resposta_reclamacoes", "perfil_vendas", "estilo_follow_up"):
            old_val = _get_nested(old_payload, key, sub_key)
            new_val = _get_nested(new_payload, key, sub_key)
            if old_val and new_val and old_val != new_val:
                changed_fields.append({
                    "path": f"{key}.{sub_key}",
                    "old": old_val,
                    "new": new_val,
                })

    total_changes = len(trait_deltas) + len(changed_fields)
    summary_parts = []
    if trait_deltas:
        summary_parts.append(f"{len(trait_deltas)} traço(s) do radar alterado(s)")
    if changed_fields:
        summary_parts.append(f"{len(changed_fields)} campo(s) modificado(s)")
    summary = "; ".join(summary_parts) if summary_parts else "Nenhuma alteração detectada"

    return {
        "trait_deltas": trait_deltas,
        "changed_fields": changed_fields,
        "summary": summary,
        "total_changes": total_changes,
        "old_version": old_payload.get("version"),
        "new_version": new_payload.get("version"),
    }


def _merge_ranked_lists(existing: list[str], incoming: list[str], limit: int) -> list[str]:
    scores: Counter[str] = Counter()
    for idx, item in enumerate(existing or []):
        scores[item] += max(1, limit - idx)
    for idx, item in enumerate(incoming or []):
        scores[item] += max(2, limit - idx + 1)
    return [item for item, _ in scores.most_common(limit)]


def incremental_dna_update(existing_payload: dict, messages: list[dict]) -> dict[str, Any]:
    """Lightweight DNA merge: update vocab, phrases and rolling averages from new messages."""
    new_bodies = corpus_bodies(messages)
    if not new_bodies:
        return dict(existing_payload)

    updated = dict(existing_payload)
    comm = dict(updated.get("communication") or {})
    behavior = dict(updated.get("behavior") or {})
    writing = dict(updated.get("writing_style") or {})
    stats = dict(updated.get("stats") or {})

    prev_count = int(stats.get("message_sample_count") or max(len(new_bodies), 1))
    new_count = prev_count + len(new_bodies)
    stats["message_sample_count"] = new_count

    words = Counter(comm.get("vocabulario_frequente") or [])
    for body in new_bodies:
        words.update(w.lower() for w in re.findall(r"\b\w+\b", body) if len(w) > 2)

    slang_candidates = [w for w, c in words.most_common(30) if c >= 2 and len(w) <= 6]
    new_phrases = _extract_frequent_phrases(new_bodies)
    new_greetings = _extract_openings(new_bodies)
    new_closings = _extract_closings(new_bodies)

    comm["vocabulario_frequente"] = [w for w, _ in words.most_common(15)]
    comm["girias"] = _merge_ranked_lists(comm.get("girias") or [], slang_candidates, 10)
    comm["frases_frequentes"] = _merge_ranked_lists(
        comm.get("frases_frequentes") or [], new_phrases, 8
    )
    comm["padroes_saudacao"] = _merge_ranked_lists(
        comm.get("padroes_saudacao") or [], new_greetings, 5
    )
    comm["padroes_encerramento"] = _merge_ranked_lists(
        comm.get("padroes_encerramento") or [], new_closings, 5
    )

    prev_avg = float(comm.get("comprimento_medio_mensagem") or 80)
    new_avg_len = sum(len(b) for b in new_bodies) / len(new_bodies)
    comm["comprimento_medio_mensagem"] = int(
        (prev_avg * prev_count + new_avg_len * len(new_bodies)) / new_count
    )

    prev_emoji = float(comm.get("taxa_emojis") or 0.0)
    new_emoji = sum(len(_EMOJI_PATTERN.findall(b)) for b in new_bodies) / len(new_bodies)
    comm["taxa_emojis"] = round(
        (prev_emoji * prev_count + new_emoji * len(new_bodies)) / new_count, 3
    )
    comm["uso_abreviacoes"] = round(
        (_abbreviation_rate(new_bodies) + float(comm.get("uso_abreviacoes") or 0)) / 2, 3
    )

    behavior["como_inicia_conversas"] = comm["padroes_saudacao"][:5] or behavior.get(
        "como_inicia_conversas", ["Olá"]
    )
    behavior["como_encerra_conversas"] = comm["padroes_encerramento"][:5] or behavior.get(
        "como_encerra_conversas", ["Até mais"]
    )

    writing["avg_message_length"] = comm["comprimento_medio_mensagem"]
    writing["emoji_rate"] = comm["taxa_emojis"]
    writing["slang_lexicon"] = comm["girias"]
    writing["greeting_patterns"] = comm["padroes_saudacao"]

    merged_corpus = (comm.get("frases_frequentes") or []) + new_bodies
    updated["similarity_baseline"] = compute_baseline(merged_corpus[:30])
    updated["communication"] = comm
    updated["behavior"] = behavior
    updated["writing_style"] = writing
    updated["stats"] = stats
    updated["extracted_at"] = datetime.utcnow().isoformat()
    updated["incremental_updated_at"] = updated["extracted_at"]
    return updated
