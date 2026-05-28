from typing import Any

from app.core.config import settings
from app.services.dna_extractor import extract_behavioral_dna
from app.services.memory_service import MemoryService
from app.services.pinecone_client import search
from app.services.style_postprocessor import postprocess
from app.services.seller_engine import SellerEngine

INTENSITY_MAP = {1: "light", 2: "moderate", 3: "advanced", 4: "ultra"}


class RAGEngine:
    def __init__(self):
        self.memory = MemoryService()
        self.seller = SellerEngine()

    def suggest(
        self,
        tenant_id: str,
        twin_id: str,
        text: str,
        dna: dict | None,
        intensity: int = 2,
        contact_id: str | None = None,
        seller_mode: bool = False,
    ) -> dict[str, Any]:
        level = INTENSITY_MAP.get(intensity, "moderate")
        ctx = self.memory.retrieve_context(tenant_id, twin_id, text, contact_id)

        style_examples = ctx.get("messages", [])[:5]
        seller_ctx = []
        if seller_mode:
            seller_ctx = search(tenant_id, twin_id, "seller", text, top_k=3)

        prompt = self._build_prompt(text, dna or {}, level, style_examples, ctx, seller_ctx, seller_mode)
        suggestion = self._generate(prompt)
        suggestion = postprocess(suggestion, dna or {}, intensity)

        return {
            "suggestion": suggestion,
            "score": 0.85,
            "metadata": {"intensity": level, "seller_mode": seller_mode},
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
    ) -> str:
        style = dna.get("writing_style", {})
        presets = dna.get("intensity_presets", {}).get(level, {})
        ex_text = "\n".join(
            f"- {e.get('chunk_text', e.get('body', ''))[:200]}" for e in examples[:3]
        )
        mem_text = "\n".join(
            f"- {m.get('chunk_text', m.get('label', ''))[:150]}" for m in ctx.get("memories", [])[:3]
        )
        seller_text = ""
        if seller_mode and seller_ctx:
            seller_text = "\nPlaybooks:\n" + "\n".join(
                f"- {s.get('chunk_text', '')[:200]}" for s in seller_ctx
            )

        return f"""Você é o gêmeo digital TWIN do usuário. Responda como ELE responderia.
Intensidade de imitação: {level} (peso estilo: {presets.get('style_weight', 0.6)}).
Formalidade: {style.get('formality', 0.5)}. Emojis: taxa {style.get('emoji_rate', 0.1)}.
Saudações típicas: {', '.join(style.get('greeting_patterns', ['Olá'])[:3])}.
Gírias: {', '.join(style.get('slang_lexicon', [])[:5])}.

Exemplos de estilo:
{ex_text or '- (sem exemplos ainda)'}

Memória relevante:
{mem_text or '- (nenhuma)'}{seller_text}

REGRAS: Não invente fatos. Se não souber, diga que precisa confirmar. Tom humano, não robótico.

Mensagem recebida: {user_input}

Resposta:"""

    def _generate(self, prompt: str) -> str:
        if settings.openai_api_key:
            try:
                from openai import OpenAI

                client = OpenAI(api_key=settings.openai_api_key)
                r = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.75,
                    max_tokens=500,
                )
                return r.choices[0].message.content or ""
            except Exception:
                pass
        return self._fallback_response(prompt)

    def _fallback_response(self, prompt: str) -> str:
        if "Mensagem recebida:" in prompt:
            msg = prompt.split("Mensagem recebida:")[-1].split("Resposta:")[0].strip()
            return f"Opa! Vi sua mensagem sobre isso. Deixa eu verificar e já te retorno, blz? ({msg[:40]}...)"
        return "Entendi! Já te respondo com os detalhes."
