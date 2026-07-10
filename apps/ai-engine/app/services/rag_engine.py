from typing import Any

from app.core.config import settings
from app.services.dna_extractor import extract_behavioral_dna
from app.services.llm_providers import get_provider
from app.services.memory_service import MemoryService
from app.services.pinecone_client import search
from app.services.similarity_scorer import score_similarity
from app.services.style_postprocessor import postprocess
from app.services.seller_engine import SellerEngine

INTENSITY_MAP = {1: "light", 2: "moderate", 3: "advanced", 4: "ultra"}
DEFAULT_CONFIDENCE_THRESHOLD = 0.75

_FACTOR_LABELS_PT = {
    "formalidade": "Formalidade",
    "vocabulario": "Vocabulário",
    "tom": "Tom emocional",
    "tom_emocional": "Tom emocional",
    "persuasao": "Persuasão",
    "geral": "Confiança geral",
}

_FACTOR_EXPLANATIONS_PT = {
    "formalidade": (
        "Mede o alinhamento do nível formal/informal da sugestão com o estilo habitual do twin."
    ),
    "vocabulario": (
        "Avalia o uso de palavras e expressões típicas do vocabulário indexado no DNA."
    ),
    "tom_emocional": (
        "Compara a carga emocional (emojis, tom afetivo) com as mensagens de referência."
    ),
    "persuasao": (
        "Verifica aderência a padrões comerciais e de persuasão presentes no corpus."
    ),
    "geral": (
        "Score agregado de similaridade — quanto maior, mais fiel ao estilo do twin."
    ),
}


class RAGEngine:
    def __init__(self):
        self.memory = MemoryService()
        self.seller = SellerEngine()
        self._llm = get_provider()

    def suggest(
        self,
        tenant_id: str,
        twin_id: str,
        text: str,
        dna: dict | None,
        intensity: int = 2,
        contact_id: str | None = None,
        seller_mode: bool = False,
        session_id: str | None = None,
        confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
        *,
        conversation_history: list[dict] | None = None,
        channel: str | None = None,
        agent_mode: bool = False,
    ) -> dict[str, Any]:
        level = INTENSITY_MAP.get(intensity, "moderate")
        ctx = self.memory.retrieve_context(tenant_id, twin_id, text, contact_id)

        wm_session = session_id or contact_id
        working = self.memory.working_set(wm_session) if wm_session else []
        if wm_session:
            self.memory.push_working(
                wm_session,
                {"role": "incoming", "text": text, "contact_id": contact_id},
            )

        style_examples = ctx.get("messages", [])[:5]
        seller_ctx = []
        if seller_mode:
            seller_ctx = search(tenant_id, twin_id, "seller", text, top_k=3)

        opportunity = self.seller.detect_opportunity(text) if seller_mode else None
        presets = (dna or {}).get("intensity_presets", {}).get(level, {})
        few_shot_k = int(presets.get("few_shot_k") or {1: 2, 2: 3, 3: 5, 4: 8}.get(intensity, 3))
        style_examples = style_examples[:few_shot_k]
        temperature = float(presets.get("temperature") or {1: 0.5, 2: 0.7, 3: 0.8, 4: 0.9}.get(intensity, 0.7))

        prompt = self._build_prompt(
            text,
            dna or {},
            level,
            style_examples,
            ctx,
            seller_ctx,
            seller_mode,
            conversation_history=conversation_history,
            working_memory=working,
            channel=channel,
            agent_mode=agent_mode,
            opportunity=opportunity,
            intensity=intensity,
        )
        suggestion = self._generate(prompt, temperature=temperature)
        suggestion = postprocess(suggestion, dna or {}, intensity)

        corpus = self._corpus_for_scoring(ctx, dna)
        similarity = score_similarity(suggestion, corpus)

        if wm_session:
            self.memory.push_working(
                wm_session,
                {
                    "role": "assistant" if agent_mode else "suggestion",
                    "text": suggestion,
                    "score": similarity["geral"],
                },
            )

        confidence = similarity["geral"]
        auto_send = confidence >= confidence_threshold

        return {
            "suggestion": suggestion,
            "score": confidence,
            "confidence": confidence,
            "auto_send_recommended": auto_send,
            "confidence_threshold": confidence_threshold,
            "similarity": similarity,
            "metadata": {
                "intensity": level,
                "seller_mode": seller_mode,
                "agent_mode": agent_mode,
                "channel": channel,
                "opportunity": opportunity,
                "similarity_breakdown": similarity,
                "confidence": confidence,
                "auto_send_recommended": auto_send,
                "history_turns": len(conversation_history or []),
            },
        }

    def simulate(
        self,
        tenant_id: str,
        twin_id: str,
        text: str,
        dna: dict | None,
        intensity: int = 2,
        contact_id: str | None = None,
        seller_mode: bool = False,
        session_id: str | None = None,
        confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
        *,
        conversation_history: list[dict] | None = None,
        push_working_memory: bool = False,
    ) -> dict[str, Any]:
        """Replay simulation — no side effects unless push_working_memory is True."""
        level = INTENSITY_MAP.get(intensity, "moderate")
        ctx = self.memory.retrieve_context(tenant_id, twin_id, text, contact_id)

        wm_session = session_id or contact_id
        if push_working_memory and wm_session:
            self.memory.push_working(
                wm_session,
                {"role": "incoming", "text": text, "contact_id": contact_id},
            )

        style_examples = ctx.get("messages", [])[:5]
        seller_ctx = []
        if seller_mode:
            seller_ctx = search(tenant_id, twin_id, "seller", text, top_k=3)

        presets = (dna or {}).get("intensity_presets", {}).get(level, {})
        few_shot_k = int(presets.get("few_shot_k") or {1: 2, 2: 3, 3: 5, 4: 8}.get(intensity, 3))
        style_examples = style_examples[:few_shot_k]
        temperature = float(presets.get("temperature") or {1: 0.5, 2: 0.7, 3: 0.8, 4: 0.9}.get(intensity, 0.7))

        prompt = self._build_prompt(
            text,
            dna or {},
            level,
            style_examples,
            ctx,
            seller_ctx,
            seller_mode,
            conversation_history=conversation_history,
            intensity=intensity,
        )
        suggestion = self._generate(prompt, temperature=temperature)
        suggestion = postprocess(suggestion, dna or {}, intensity)

        corpus = self._corpus_for_scoring(ctx, dna)
        similarity = score_similarity(suggestion, corpus)
        confidence = similarity["geral"]

        if push_working_memory and wm_session:
            self.memory.push_working(
                wm_session,
                {"role": "suggestion", "text": suggestion, "score": confidence},
            )

        chunks_used = [
            {
                "text": (c.get("chunk_text", c.get("body", "")))[:300],
                "source": c.get("source", "msgs"),
                "role": c.get("role"),
                "score": c.get("_score"),
            }
            for c in style_examples
        ]

        return {
            "suggestion": suggestion,
            "similarity": similarity,
            "confidence": confidence,
            "chunks_used": chunks_used,
            "memories_used": [
                {"text": m.get("chunk_text", m.get("label", ""))[:200], "source": "memory"}
                for m in ctx.get("memories", [])[:3]
            ],
            "seller_chunks_used": [
                {"text": s.get("chunk_text", "")[:200], "intent": s.get("intent")}
                for s in seller_ctx
            ],
            "side_effects": {"working_memory_pushed": bool(push_working_memory and wm_session)},
            "metadata": {
                "intensity": level,
                "seller_mode": seller_mode,
                "replay": True,
            },
        }

    def explain(
        self,
        input_text: str,
        suggestion_text: str,
        dna: dict | None = None,
        retrieved_chunks: list[dict] | None = None,
        similarity_breakdown: dict | None = None,
    ) -> dict[str, Any]:
        chunks = retrieved_chunks or []
        corpus = [
            c.get("chunk_text", c.get("body", c.get("text", "")))
            for c in chunks
            if c.get("chunk_text") or c.get("body") or c.get("text")
        ]

        if not corpus and dna:
            phrases = dna.get("communication", {}).get("frases_frequentes", [])
            vocab = dna.get("communication", {}).get("vocabulario_frequente", [])
            if phrases:
                corpus = phrases
            elif vocab:
                corpus = [" ".join(vocab[:20])]

        breakdown = similarity_breakdown or score_similarity(suggestion_text, corpus)
        factors: list[dict[str, Any]] = []
        for key, value in breakdown.items():
            if not isinstance(value, (int, float)):
                continue
            label = _FACTOR_LABELS_PT.get(key, key.replace("_", " ").title())
            factors.append({
                "key": key,
                "label": label,
                "value": round(float(value), 3),
                "explanation": _FACTOR_EXPLANATIONS_PT.get(key, ""),
            })

        factors.sort(key=lambda f: f["value"], reverse=True)
        confidence = breakdown.get("geral", 0.5)

        dna_influence: list[dict[str, str]] = []
        if dna:
            comm = dna.get("communication", {})
            style = dna.get("writing_style", {})
            if comm.get("padroes_saudacao"):
                dna_influence.append({
                    "aspect": "Saudações",
                    "detail": ", ".join(comm["padroes_saudacao"][:3]),
                })
            if comm.get("girias") or style.get("slang_lexicon"):
                girias = comm.get("girias") or style.get("slang_lexicon", [])
                dna_influence.append({
                    "aspect": "Gírias e vocabulário",
                    "detail": ", ".join(girias[:5]),
                })
            if comm.get("estilo_comunicacao"):
                dna_influence.append({
                    "aspect": "Estilo",
                    "detail": comm["estilo_comunicacao"],
                })

        context_used = [
            {
                "text": (c.get("chunk_text", c.get("body", c.get("text", ""))))[:200],
                "source": c.get("source", c.get("namespace", "rag")),
            }
            for c in chunks[:5]
        ]

        summary = (
            f"Sugestão com confiança de {round(confidence * 100)}% em relação ao estilo do twin. "
            f"Fator mais forte: {factors[0]['label']} ({round(factors[0]['value'] * 100)}%)."
            if factors
            else "Não foi possível calcular fatores de similaridade."
        )

        return {
            "input_text": input_text,
            "suggestion_text": suggestion_text,
            "confidence": round(confidence, 3),
            "factors": factors,
            "summary": summary,
            "dna_influence": dna_influence,
            "context_used": context_used,
            "similarity_breakdown": breakdown,
        }

    def _corpus_for_scoring(self, ctx: dict, dna: dict | None) -> list[str]:
        from_msgs = [
            m.get("chunk_text", m.get("body", ""))
            for m in ctx.get("messages", [])
            if m.get("chunk_text") or m.get("body")
        ]
        if from_msgs:
            return from_msgs
        if dna:
            phrases = dna.get("communication", {}).get("frases_frequentes", [])
            vocab = dna.get("communication", {}).get("vocabulario_frequente", [])
            if phrases:
                return phrases
            if vocab:
                return [" ".join(vocab[:20])]
        return []

    def score_style(
        self,
        tenant_id: str,
        twin_id: str,
        text: str,
        dna: dict | None = None,
    ) -> dict[str, Any]:
        ctx = self.memory.retrieve_context(tenant_id, twin_id, text)
        corpus = self._corpus_for_scoring(ctx, dna)
        similarity = score_similarity(text, corpus)
        confidence = similarity["geral"]
        return {
            "confidence": confidence,
            "score": confidence,
            "similarity": similarity,
            "similarity_breakdown": similarity,
        }

    def _build_prompt(
        self,
        user_input: str,
        dna: dict,
        level: str,
        examples: list,
        ctx: dict,
        seller_ctx: list,
        seller_mode: bool,
        *,
        conversation_history: list[dict] | None = None,
        working_memory: list[dict] | None = None,
        channel: str | None = None,
        agent_mode: bool = False,
        opportunity: dict | None = None,
        intensity: int = 2,
    ) -> str:
        style = dna.get("writing_style", {})
        comm = dna.get("communication", {})
        presets = dna.get("intensity_presets", {}).get(level, {})
        few_shot_k = int(presets.get("few_shot_k") or max(2, min(8, len(examples) or 3)))
        ex_text = "\n".join(
            f"- {e.get('chunk_text', e.get('body', ''))[:200]}" for e in examples[:few_shot_k]
        )
        mem_text = "\n".join(
            f"- {m.get('chunk_text', m.get('label', ''))[:150]}" for m in ctx.get("memories", [])[:3]
        )
        seller_text = ""
        if seller_mode and seller_ctx:
            seller_text = "\nPlaybooks de venda:\n" + "\n".join(
                f"- {s.get('chunk_text', '')[:200]}" for s in seller_ctx
            )

        formality = style.get("formality", comm.get("nivel_formalidade", 0.5))
        emoji_rate = style.get("emoji_rate", comm.get("taxa_emojis", 0.1))
        greetings = style.get("greeting_patterns", comm.get("padroes_saudacao", ["Olá"]))
        slang = style.get("slang_lexicon", comm.get("girias", []))
        avg_len = style.get("avg_message_length", comm.get("tamanho_medio_mensagem", 80))

        psych = dna.get("psychological_estimate", {})
        psych_hint = ""
        if psych:
            psych_hint = (
                f"\nPerfil: extroversão {psych.get('extroversao', 50)}, "
                f"empatia {psych.get('empatia', 50)}, formalidade {psych.get('formalidade', 50)}."
            )

        history_block = ""
        turns = conversation_history or []
        if turns:
            history_block = "\nHistórico recente da conversa:\n" + "\n".join(
                f"{t.get('role', 'user')}: {str(t.get('text', ''))[:300]}"
                for t in turns[-10:]
            )

        wm_block = ""
        if working_memory:
            recent_wm = working_memory[-8:]
            wm_block = "\nContexto da sessão:\n" + "\n".join(
                f"{m.get('role', 'msg')}: {str(m.get('text', ''))[:200]}"
                for m in recent_wm
                if m.get("text")
            )

        channel_hint = ""
        if channel in ("whatsapp", "telegram") or agent_mode:
            channel_hint = (
                "\nCanal de chat (WhatsApp/Telegram). Respostas curtas (1–3 frases), "
                "tom de pessoa real digitando no celular. "
                "NÃO use markdown, títulos, bullets nem listas. "
                "Continue o fio; não reinicie com saudação se já estiver no meio do diálogo."
            )

        intensity_hint = {
            1: "Imite de leve — priorize clareza; use pouco do vocabulário típico.",
            2: "Imite o jeito habitual: comprimento, formalidade e gírias do DNA.",
            3: "Imite forte: espelhe frases, ritmo e emojis dos exemplos.",
            4: "Clone máximo: soe indistinguível do vendedor nos exemplos (sem inventar fatos).",
        }.get(intensity, "Imite o jeito habitual.")

        role_line = (
            "Você é o vendedor clonado (agente TWIN) atendendo o cliente em tempo real. "
            "Responda exatamente como ELE responderia — feche dúvidas, avance a venda quando fizer sentido."
            if agent_mode or seller_mode
            else "Você é o gêmeo digital TWIN do usuário. Responda como ELE responderia."
        )

        opportunity_hint = ""
        if opportunity:
            opportunity_hint = (
                f"\nSinal detectado: {opportunity.get('type')} "
                f"(confiança {opportunity.get('confidence', 0)}). "
                "Ajuste a resposta a esse momento da venda sem forçar."
            )

        return f"""{role_line}
Intensidade de imitação: {level} (peso estilo: {presets.get('style_weight', 0.6)}).
{intensity_hint}
Formalidade: {formality}. Emojis: taxa {emoji_rate}. Comprimento típico: ~{avg_len} caracteres.
Saudações típicas: {', '.join(greetings[:3])}.
Gírias: {', '.join(slang[:5])}.{psych_hint}{channel_hint}{opportunity_hint}

Exemplos reais do estilo (copie o jeito, não copie fatos):
{ex_text or '- (sem exemplos ainda — use o DNA acima)'}

Memória relevante:
{mem_text or '- (nenhuma)'}{seller_text}{history_block}{wm_block}

REGRAS: Não invente fatos, preços ou prazos. Se não souber, diga que precisa confirmar. Tom humano, não robótico. Uma mensagem de chat, não um e-mail.

Mensagem recebida: {user_input}

Resposta:"""

    def _generate(self, prompt: str, temperature: float = 0.75) -> str:
        try:
            return self._llm.generate(prompt, temperature=temperature, max_tokens=500)
        except Exception:
            from app.services.llm_providers.fallback_provider import FallbackProvider

            return FallbackProvider().generate(prompt)
