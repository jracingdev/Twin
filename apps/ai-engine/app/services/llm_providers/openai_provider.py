from typing import Any

from app.core.config import settings
from app.services.llm_providers.base import LLMProvider


class OpenAIProvider(LLMProvider):
    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model

    def generate(self, prompt: str, **kwargs: Any) -> str:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        temperature = kwargs.get("temperature", 0.75)
        max_tokens = kwargs.get("max_tokens", 500)
        r = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return r.choices[0].message.content or ""
