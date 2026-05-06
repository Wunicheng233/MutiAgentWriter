from __future__ import annotations

from typing import Any, Callable

import openai

from backend.core.llm.types import LLMRequest, LLMResponse, LLMTokenUsage


class OpenAICompatibleProvider:
    """Provider for OpenAI-compatible chat completions endpoints.

    This covers OpenAI itself and vendors that expose the same
    `client.chat.completions.create()` shape, including the current Volcano
    Engine integration.
    """

    def __init__(
        self,
        *,
        client: Any | None = None,
        client_factory: Callable[[str | None, str | None], Any] | None = None,
    ) -> None:
        self.client = client
        self.client_factory = client_factory or self._default_client_factory
        self._client_cache: dict[tuple[str | None, str | None], Any] = {}

    def complete(self, request: LLMRequest) -> LLMResponse:
        client = request.client or self.client or self._get_client(request.api_key, request.base_url)
        raw_response = client.chat.completions.create(
            model=request.model,
            messages=[
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_input},
            ],
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            timeout=request.timeout,
        )
        return LLMResponse(
            content=self._extract_content(raw_response),
            model=request.model,
            provider=request.provider,
            usage=self._extract_usage(raw_response),
            raw_response=raw_response,
        )

    def _get_client(self, api_key: str | None, base_url: str | None) -> Any:
        cache_key = (api_key, base_url)
        if cache_key not in self._client_cache:
            self._client_cache[cache_key] = self.client_factory(api_key, base_url)
        return self._client_cache[cache_key]

    def reset_client(self, api_key: str | None, base_url: str | None) -> None:
        self._client_cache.pop((api_key, base_url), None)

    @staticmethod
    def _default_client_factory(api_key: str | None, base_url: str | None) -> openai.OpenAI:
        return openai.OpenAI(api_key=api_key or "", base_url=base_url)

    @staticmethod
    def _extract_content(raw_response: Any) -> str:
        choices = getattr(raw_response, "choices", None) or []
        if not choices:
            return " "
        message = getattr(choices[0], "message", None)
        content = getattr(message, "content", "") if message is not None else ""
        return str(content or "").strip() or " "

    @staticmethod
    def _extract_usage(raw_response: Any) -> LLMTokenUsage | None:
        usage = getattr(raw_response, "usage", None)
        if usage is None:
            return None
        prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        total_tokens = getattr(usage, "total_tokens", None)
        if total_tokens is None:
            total_tokens = prompt_tokens + completion_tokens
        return LLMTokenUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=int(total_tokens or 0),
        )
