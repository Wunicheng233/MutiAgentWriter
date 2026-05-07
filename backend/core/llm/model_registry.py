from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from backend.core.config import settings as default_settings


@dataclass(frozen=True)
class ModelRoute:
    provider: str
    model: str
    api_key: str
    base_url: str
    prompt_price: float
    completion_price: float
    api_source: str = "system"


def resolve_model_route(
    agent_role: str,
    *,
    settings: Any = default_settings,
    project_config: Mapping[str, Any] | None = None,
) -> ModelRoute:
    """Resolve model/provider settings for an agent.

    The default route mirrors the existing single-provider behavior. Projects
    may optionally override route details under `config.llm` without requiring
    changes to agent code.
    """
    llm_config = _mapping((project_config or {}).get("llm"))
    agents_config = _mapping(llm_config.get("agents"))
    agent_override = _mapping(agents_config.get(agent_role))
    provider_id = str(agent_override.get("provider") or llm_config.get("default_provider") or "openai_compatible")

    providers_config = _mapping(llm_config.get("providers"))
    provider_config = _mapping(providers_config.get(provider_id))

    model = str(agent_override.get("model") or provider_config.get("model") or settings.get_model_for_agent(agent_role))
    api_key = str(agent_override.get("api_key") or provider_config.get("api_key") or settings.get_api_key_for_agent(agent_role) or "")
    base_url = str(agent_override.get("base_url") or provider_config.get("base_url") or getattr(settings, "base_url", "") or "")

    prompt_price = _float_value(
        agent_override.get("prompt_price", provider_config.get("prompt_price", getattr(settings, "default_prompt_price", 0.0)))
    )
    completion_price = _float_value(
        agent_override.get("completion_price", provider_config.get("completion_price", getattr(settings, "default_completion_price", 0.0)))
    )
    api_source = str(agent_override.get("api_source") or provider_config.get("api_source") or llm_config.get("api_source") or "system")

    return ModelRoute(
        provider=provider_id,
        model=model,
        api_key=api_key,
        base_url=base_url,
        prompt_price=prompt_price,
        completion_price=completion_price,
        api_source=api_source,
    )


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _float_value(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0
