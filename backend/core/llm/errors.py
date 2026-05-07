from __future__ import annotations

from backend.core.llm.types import LLMError


def classify_llm_exception(exc: Exception, *, provider: str | None = None) -> LLMError:
    if isinstance(exc, LLMError):
        return exc

    status_code = _extract_status_code(exc)
    raw_error = str(exc)
    normalized = raw_error.lower()

    if status_code in {401, 403} or _contains_any(normalized, ["invalid api key", "unauthorized", "forbidden", "authentication"]):
        return LLMError(
            "auth",
            "模型认证失败，请检查该供应商 API Key。",
            retryable=False,
            provider=provider,
            status_code=status_code,
            raw_error=raw_error,
        )

    if _contains_any(normalized, ["insufficient_quota", "quota", "balance", "billing", "额度", "余额"]):
        return LLMError(
            "quota",
            "模型供应商额度不足，请检查账户余额或切换模型。",
            retryable=False,
            provider=provider,
            status_code=status_code,
            raw_error=raw_error,
        )

    if status_code == 429 or _contains_any(normalized, ["rate limit", "too many requests", "限流"]):
        return LLMError(
            "rate_limit",
            "模型供应商限流，请稍后重试。",
            retryable=True,
            provider=provider,
            status_code=status_code,
            raw_error=raw_error,
        )

    if isinstance(exc, TimeoutError) or _contains_any(normalized, ["timeout", "timed out", "read timed out", "超时"]):
        return LLMError(
            "timeout",
            "模型响应超时，请稍后重试或降低生成范围。",
            retryable=True,
            provider=provider,
            status_code=status_code,
            raw_error=raw_error,
        )

    if _contains_any(normalized, ["content_filter", "content policy", "safety", "moderation", "内容安全"]):
        return LLMError(
            "content_filter",
            "模型供应商拒绝了本次内容，请调整提示或内容设定。",
            retryable=False,
            provider=provider,
            status_code=status_code,
            raw_error=raw_error,
        )

    if status_code in {500, 502, 503, 504}:
        return LLMError(
            "provider_unavailable",
            "模型供应商暂时不可用，请稍后重试或切换供应商。",
            retryable=True,
            provider=provider,
            status_code=status_code,
            raw_error=raw_error,
        )

    if status_code in {400, 404, 422}:
        return LLMError(
            "bad_request",
            "模型请求参数不正确，请检查模型 ID、Base URL 或供应商配置。",
            retryable=False,
            provider=provider,
            status_code=status_code,
            raw_error=raw_error,
        )

    return LLMError(
        "unknown",
        "模型调用失败，请稍后重试或检查模型配置。",
        retryable=True,
        provider=provider,
        status_code=status_code,
        raw_error=raw_error,
    )


def _extract_status_code(exc: Exception) -> int | None:
    for attr in ("status_code", "status"):
        value = getattr(exc, attr, None)
        if value is not None:
            try:
                return int(value)
            except (TypeError, ValueError):
                return None

    response = getattr(exc, "response", None)
    value = getattr(response, "status_code", None)
    if value is not None:
        try:
            return int(value)
        except (TypeError, ValueError):
            return None
    return None


def _contains_any(value: str, needles: list[str]) -> bool:
    return any(needle in value for needle in needles)
