import re
from collections import Counter
from datetime import datetime
from statistics import median
from typing import Any

from app.services.similarity_scorer import compute_baseline, corpus_bodies

_EMOJI_PATTERN = re.compile(
    r"[\U0001F300-\U0001F9FF\U00002600-\U000027BF\U0001F600-\U0001F64F]+"
)
_OBJECTION_MARKERS = [
    ("preco", ["caro", "preço", "valor", "quanto custa", "muito caro"]),
    ("prazo", ["demora", "prazo", "quando chega", "atraso", "urgente"]),
    ("confianca", ["confiável", "golpe", "seguro", "garantia", "reclame aqui"]),
    ("concorrencia", ["concorrente", "mais barato", "outro lugar", "vi mais barato"]),
]
_EMPATHY_MARKERS = ["entendo", "compreendo", "desculpa", "sinto muito", "imagino", "fico feliz"]
_FOLLOW_UP_MARKERS = ["retorno", "volto", "te aviso", "confirmo", "te mando", "aguardo", "qualquer coisa"]
_OPENING_KEYWORDS = ["oi", "olá", "bom dia", "boa tarde", "boa noite", "e aí", "fala"]
_CLOSING_KEYWORDS = ["abraço", "att", "atenciosamente", "valeu", "obrigado", "até", "tchau", "fechado"]


def extract_behavioral_dna(messages: list[dict]) -> dict[str, Any]:
    user_msgs = [m for m in messages if m.get("role") == "user"]
    other_msgs = [m for m in messages if m.get("role") not in ("user", None)]
    bodies = corpus_bodies(messages)

    if not bodies:
        return _default_dna()

    lengths = [len(b) for b in bodies]
    emoji_count = sum(len(_EMOJI_PATTERN.findall(b)) for b in bodies)

    words = Counter()
    for b in bodies:
        words.update(w.lower() for w in re.findall(r"\b\w+\b", b) if len(w) > 2)

    slang_candidates = [w for w, c in words.most_common(30) if c >= 3 and len(w) <= 6]
    frequent_phrases = _extract_frequent_phrases(bodies)
    greeting_patterns = _extract_openings(bodies)
    closing_patterns = _extract_closings(bodies)
    abbrev_rate = _abbreviation_rate(bodies)

    formality = _estimate_formality(bodies)
    avg_len = int(sum(lengths) / len(lengths))
    emoji_rate = round(emoji_count / max(len(bodies), 1), 3)
    psych = _estimate_psychological(bodies, formality, emoji_rate, avg_len)
    temporal = _analyze_temporal(user_msgs)
    objections = _extract_objection_patterns(other_msgs, user_msgs)
    follow_up_style = _detect_follow_up_style(bodies)
    negotiation = _detect_negotiation_style(bodies, objections)

    radar = [
        {"trait": "Formalidade", "value": psych["formalidade"]},
        {"trait": "Emojis", "value": min(100, int(emoji_rate * 200))},
        {"trait": "Empatia", "value": psych["empatia"]},
        {"trait": "Comercial", "value": min(100, len(closing_patterns) * 15 + psych["assertividade"] // 3)},
        {"trait": "Objetividade", "value": max(20, min(100, 120 - avg_len))},
        {"trait": "Naturalidade", "value": psych["cordialidade"]},
    ]

    similarity_baseline = compute_baseline(bodies)
    extracted_at = datetime.utcnow().isoformat()

    v2 = {
        "version": "2.0.0",
        "extracted_at": extracted_at,
        "identity": {
            "nome_referencia": "",
            "vertical": "",
            "role": _detect_role(bodies, objections),
        },
        "communication": {
            "estilo_comunicacao": "direto" if avg_len < 80 else "detalhado",
            "nivel_formalidade": round(formality, 3),
            "vocabulario_frequente": [w for w, _ in words.most_common(15)],
            "girias": slang_candidates[:10],
            "frases_frequentes": frequent_phrases[:8],
            "padroes_saudacao": greeting_patterns[:5],
            "padroes_encerramento": closing_patterns[:5],
            "comprimento_medio_mensagem": avg_len,
            "taxa_emojis": emoji_rate,
            "uso_abreviacoes": round(abbrev_rate, 3),
        },
        "behavior": {
            "como_inicia_conversas": greeting_patterns[:5] or ["Olá"],
            "como_encerra_conversas": closing_patterns[:5] or ["Até mais"],
            "resposta_duvidas": _detect_response_style(bodies, "duvida"),
            "resposta_reclamacoes": _detect_response_style(bodies, "reclamacao"),
            "tempo_medio_resposta_minutos": temporal["median_reply_minutes"],
            "horarios_ativos": temporal["active_hours"],
        },
        "psychological_estimate": psych,
        "commercial": {
            "perfil_vendas": negotiation,
            "perfil_emocional": _emotional_profile(psych),
            "gatilhos_persuasao": _persuasion_triggers(bodies),
            "objecoes_comuns": objections,
            "estrategia_negociacao": negotiation,
            "estilo_follow_up": follow_up_style,
        },
        "radar": radar,
        "similarity_baseline": similarity_baseline,
        "intensity_presets": {
            "light": {"temperature": 0.5, "style_weight": 0.3},
            "moderate": {"temperature": 0.7, "style_weight": 0.6},
            "advanced": {"temperature": 0.8, "style_weight": 0.85},
            "ultra": {"temperature": 0.9, "style_weight": 1.0, "few_shot_k": 8},
        },
        # Backward compatibility (v1 consumers)
        "writing_style": {
            "avg_message_length": avg_len,
            "formality": round(formality, 2),
            "emoji_rate": emoji_rate,
            "slang_lexicon": slang_candidates[:10],
            "greeting_patterns": greeting_patterns[:5] or ["Olá"],
            "sentence_structure": "short_direct" if avg_len < 80 else "detailed",
        },
        "temporal": temporal,
        "emotional": {
            "baseline_tone": _emotional_profile(psych),
            "empathy_markers": [m for m in _EMPATHY_MARKERS if any(m in b.lower() for b in bodies)][:5],
        },
    }
    return v2


def _parse_timestamp(msg: dict) -> datetime | None:
    for key in ("timestamp", "sent_at", "created_at", "date"):
        raw = msg.get(key)
        if not raw:
            continue
        if isinstance(raw, (int, float)):
            try:
                return datetime.utcfromtimestamp(raw if raw < 1e12 else raw / 1000)
            except (OSError, ValueError):
                continue
        if isinstance(raw, str):
            for fmt in (
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S",
                "%d/%m/%Y %H:%M:%S",
                "%d/%m/%Y %H:%M",
            ):
                try:
                    return datetime.strptime(raw[:19], fmt)
                except ValueError:
                    continue
            try:
                return datetime.fromisoformat(raw.replace("Z", "+00:00").replace("+00:00", ""))
            except ValueError:
                continue
    return None


def _analyze_temporal(user_msgs: list[dict]) -> dict[str, Any]:
    reply_gaps: list[float] = []
    active_hours: list[int] = []
    sorted_msgs = sorted(
        [(m, _parse_timestamp(m)) for m in user_msgs],
        key=lambda x: x[1] or datetime.min,
    )

    prev_ts: datetime | None = None
    prev_role = None
    for msg, ts in sorted_msgs:
        if ts:
            active_hours.append(ts.hour)
            if prev_ts and prev_role != "user" and msg.get("role") == "user":
                gap = (ts - prev_ts).total_seconds() / 60
                if 0 < gap < 24 * 60:
                    reply_gaps.append(gap)
            prev_ts = ts
        prev_role = msg.get("role")

    hour_counts = Counter(active_hours)
    top_hours = [h for h, _ in hour_counts.most_common(6)] if hour_counts else [9, 18]

    return {
        "median_reply_minutes": int(median(reply_gaps)) if reply_gaps else 8,
        "active_hours": sorted(top_hours) if top_hours else [9, 18],
    }


def _estimate_formality(bodies: list[str]) -> float:
    formal_markers = ["prezado", "cordialmente", "atenciosamente", "senhor", "senhora"]
    informal_markers = ["vc", "tb", "blz", "valeu", "fala", "oi", "opa", "mano"]
    formal = sum(1 for b in bodies for m in formal_markers if m in b.lower())
    informal = sum(1 for b in bodies for m in informal_markers if m in b.lower())
    total = formal + informal + 1
    return max(0.1, min(0.9, informal / total))


def _abbreviation_rate(bodies: list[str]) -> float:
    abbrev = ["vc", "tb", "pq", "q", "td", "blz", "msg", "obg"]
    hits = sum(1 for b in bodies for a in abbrev if re.search(rf"\b{a}\b", b.lower()))
    return hits / max(len(bodies), 1)


def _estimate_psychological(
    bodies: list[str],
    formality: float,
    emoji_rate: float,
    avg_len: int,
) -> dict[str, int]:
    text = " ".join(bodies).lower()
    excl = sum(b.count("!") for b in bodies)
    questions = sum(b.count("?") for b in bodies)
    empathy_hits = sum(1 for m in _EMPATHY_MARKERS if m in text)
    imperative = sum(1 for b in bodies if re.search(r"\b(vamos|preciso|faça|envie|confirme)\b", b.lower()))
    closings = sum(1 for k in _CLOSING_KEYWORDS if k in text)

    extroversao = min(100, max(10, int(30 + emoji_rate * 80 + excl * 2 + min(avg_len, 100) * 0.2)))
    assertividade = min(100, max(15, int(25 + imperative * 8 + closings * 3)))
    empatia = min(100, max(20, int(30 + empathy_hits * 12 + questions * 1.5)))
    formalidade_score = int(formality * 100)
    dominancia = min(100, max(10, int(20 + imperative * 10 + assertividade * 0.3)))
    cordialidade = min(100, max(20, int(35 + closings * 4 + empathy_hits * 8)))

    return {
        "extroversao": extroversao,
        "assertividade": assertividade,
        "empatia": empatia,
        "formalidade": formalidade_score,
        "dominancia": dominancia,
        "cordialidade": cordialidade,
    }


def _extract_openings(bodies: list[str]) -> list[str]:
    openings = []
    for b in bodies[:200]:
        first = b.split("\n")[0][:50].strip()
        if first and len(first) < 45:
            low = first.lower()
            if any(k in low for k in _OPENING_KEYWORDS) or len(first.split()) <= 6:
                openings.append(first)
    return list(dict.fromkeys(openings))


def _extract_closings(bodies: list[str]) -> list[str]:
    closings = []
    keywords = _CLOSING_KEYWORDS + ["fechado", "combinado", "pode ser", "segue pix", "envio o orçamento"]
    for b in bodies:
        low = b.lower()
        tail = b[-90:].strip()
        if any(k in low for k in keywords) and tail:
            closings.append(tail)
    return list(dict.fromkeys(closings))[:8]


def _extract_frequent_phrases(bodies: list[str]) -> list[str]:
    phrases = Counter()
    for b in bodies:
        for line in b.split("\n"):
            line = line.strip()
            if 8 <= len(line) <= 60:
                phrases[line] += 1
    return [p for p, c in phrases.most_common(10) if c >= 2]


def _extract_objection_patterns(
    other_msgs: list[dict],
    user_msgs: list[dict],
) -> list[dict[str, str]]:
    patterns: list[dict[str, str]] = []
    other_bodies = [m.get("body", "") for m in other_msgs if m.get("body")]
    user_bodies = [m.get("body", "") for m in user_msgs if m.get("body")]

    for tipo, markers in _OBJECTION_MARKERS:
        for ob in other_bodies:
            low = ob.lower()
            if not any(m in low for m in markers):
                continue
            exemplo = ob[:120].strip()
            resposta = ""
            for ub in user_bodies:
                if any(m in ub.lower() for m in markers[:2]):
                    resposta = ub[:150].strip()
                    break
            patterns.append({"tipo": tipo, "exemplo": exemplo, "resposta_tipica": resposta})
            break

    if not patterns:
        for tipo, markers in _OBJECTION_MARKERS:
            for ub in user_bodies:
                low = ub.lower()
                if any(m in low for m in markers):
                    patterns.append({
                        "tipo": tipo,
                        "exemplo": ub[:120].strip(),
                        "resposta_tipica": "",
                    })
                    break

    return patterns[:6]


def _detect_follow_up_style(bodies: list[str]) -> str:
    text = " ".join(bodies).lower()
    hits = sum(1 for m in _FOLLOW_UP_MARKERS if m in text)
    if hits >= 5:
        return "proativo_frequente"
    if hits >= 2:
        return "proativo_moderado"
    return "reativo"


def _detect_negotiation_style(bodies: list[str], objections: list[dict]) -> str:
    text = " ".join(bodies).lower()
    if any(w in text for w in ["consultivo", "entender", "necessidade", "ajudar"]):
        return "consultivo"
    if any(w in text for w in ["desconto", "condição", "fechamos", "proposta"]):
        return "negociador"
    if objections:
        return "consultivo"
    return "relacional"


def _detect_role(bodies: list[str], objections: list[dict]) -> str:
    text = " ".join(bodies).lower()
    if any(w in text for w in ["suporte", "ticket", "chamado", "problema técnico"]):
        return "suporte"
    if any(w in text for w in ["orçamento", "proposta", "venda", "fechado"]):
        return "vendedor"
    if any(w in text for w in ["instalar", "configurar", "erro", "log"]):
        return "tecnico"
    if objections:
        return "vendedor"
    return "geral"


def _detect_response_style(bodies: list[str], kind: str) -> str:
    text = " ".join(bodies).lower()
    if kind == "duvida":
        if any(w in text for w in ["explico", "funciona assim", "basicamente"]):
            return "explicativo_paciente"
        return "direto_objetivo"
    if any(w in text for w in ["desculpa", "entendo", "vamos resolver", "prioridade"]):
        return "empatico_resolutivo"
    return "profissional_neutro"


def _emotional_profile(psych: dict[str, int]) -> str:
    if psych["empatia"] >= 70:
        return "acolhedor"
    if psych["assertividade"] >= 70:
        return "assertivo_pragmatico"
    if psych["formalidade"] >= 70:
        return "formal_cordial"
    return "warm_pragmatic"


def _persuasion_triggers(bodies: list[str]) -> list[str]:
    triggers = []
    text = " ".join(bodies).lower()
    mapping = {
        "urgência": ["últimas unidades", "só hoje", "prazo", "urgente"],
        "prova social": ["clientes", "depoimento", "referência"],
        "escassez": ["último", "restam", "limitado"],
        "benefício": ["economia", "vantagem", "melhor custo"],
    }
    for name, words in mapping.items():
        if any(w in text for w in words):
            triggers.append(name)
    return triggers[:5]


def _default_dna() -> dict[str, Any]:
    return extract_behavioral_dna([{"role": "user", "body": "Olá, tudo bem?"}])
