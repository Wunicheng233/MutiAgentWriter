from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class LLMTokenUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass(frozen=True)
class LLMRequest:
    agent_role: str
    system_prompt: str
    user_input: str
    model: str
    temperature: float
    max_tokens: int
    timeout: int
    provider: str = "openai_compatible"
    base_url: str | None = None
    api_key: str | None = None
    max_retries: int = 3
    retry_delay_seconds: float = 2.0
    client: Any | None = None


@dataclass(frozen=True)
class LLMResponse:
    content: str
    model: str
    provider: str
    usage: LLMTokenUsage | None = None
    raw_response: Any | None = None
