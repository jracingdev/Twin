from app.core.config import settings
from app.services.llm_providers.base import LLMProvider
from app.services.llm_providers.fallback_provider import FallbackProvider
from app.services.llm_providers.openai_provider import OpenAIProvider

_provider_cache: LLMProvider | None = None


def get_provider() -> LLMProvider:
    global _provider_cache
    if _provider_cache is not None:
        return _provider_cache

    name = (settings.llm_provider or "openai").lower()
    if name == "openai" and settings.openai_api_key:
        _provider_cache = OpenAIProvider()
    else:
        _provider_cache = FallbackProvider()
    return _provider_cache


def reset_provider_cache() -> None:
    global _provider_cache
    _provider_cache = None
