from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str, **kwargs: Any) -> str:
        ...
