from __future__ import annotations

import time
from typing import Callable

from backend.core.llm.errors import classify_llm_exception
from backend.core.llm.providers.openai_compat import OpenAICompatibleProvider
from backend.core.llm.types import LLMError, LLMRequest, LLMResponse


class LLMRouter:
    """Small provider router with bounded retry.

    Provider identifiers such as "deepseek" or "volcengine" may still use the
    OpenAI-compatible adapter. Registering a dedicated provider later only
    requires adding it to `providers`.
    """

    def __init__(self, providers: dict[str, object] | None = None) -> None:
        self.providers = providers or {"openai_compatible": OpenAICompatibleProvider()}

    def complete(
        self,
        request: LLMRequest,
        *,
        sleep: Callable[[float], None] = time.sleep,
    ) -> LLMResponse:
        provider = self._provider_for(request.provider)
        attempts = max(1, int(request.max_retries or 1))
        last_error: LLMError | None = None

        for attempt in range(attempts):
            try:
                return provider.complete(request)
            except Exception as exc:
                last_error = classify_llm_exception(exc, provider=request.provider)
                if not last_error.retryable or attempt >= attempts - 1:
                    break
                sleep(max(0.0, float(request.retry_delay_seconds or 0.0)))

        if last_error is None:
            last_error = LLMError(
                "unknown",
                "模型调用失败，请稍后重试或检查模型配置。",
                retryable=True,
                provider=request.provider,
            )
        raise last_error

    def reset_provider_cache(self, provider_id: str, api_key: str | None, base_url: str | None) -> None:
        provider = self._provider_for(provider_id)
        reset_client = getattr(provider, "reset_client", None)
        if callable(reset_client):
            reset_client(api_key, base_url)

    def _provider_for(self, provider_id: str):
        return self.providers.get(provider_id) or self.providers["openai_compatible"]
