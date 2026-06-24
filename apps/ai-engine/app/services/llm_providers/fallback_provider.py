from typing import Any

from app.services.llm_providers.base import LLMProvider


class FallbackProvider(LLMProvider):
    def generate(self, prompt: str, **kwargs: Any) -> str:
        if "Mensagem recebida:" in prompt:
            msg = prompt.split("Mensagem recebida:")[-1].split("Resposta:")[0].strip()
            return (
                f"Opa! Vi sua mensagem sobre isso. Deixa eu verificar e já te retorno, blz? "
                f"({msg[:40]}...)"
            )
        return "Entendi! Já te respondo com os detalhes."
