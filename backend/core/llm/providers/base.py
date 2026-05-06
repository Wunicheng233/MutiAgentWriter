from __future__ import annotations

from typing import Protocol

from backend.core.llm.types import LLMRequest, LLMResponse


class LLMProvider(Protocol):
    def complete(self, request: LLMRequest) -> LLMResponse:
        """Return a normalized response for one chat-completion request."""
