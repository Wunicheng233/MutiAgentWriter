from __future__ import annotations

import datetime
from dataclasses import dataclass

from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.auth import get_user_api_key
from backend.core.config import settings
from backend.models import TokenUsage, User, WorkflowRun


@dataclass(frozen=True)
class GenerationQuotaStatus:
    daily_limit: int | None
    used_today: int
    remaining_today: int | None
    reset_at: datetime.datetime
    api_source: str
    platform_token_budget_applies: bool
    monthly_token_limit: int | None
    monthly_tokens_used: int
    monthly_tokens_remaining: int | None
    monthly_reset_at: datetime.datetime
    allowed: bool
    reason: str | None = None


def get_generation_quota_status(
    db: Session,
    user: User,
    *,
    now: datetime.datetime | None = None,
) -> GenerationQuotaStatus:
    current_time = now or datetime.datetime.utcnow()
    day_start = current_time.replace(hour=0, minute=0, second=0, microsecond=0)
    reset_at = day_start + datetime.timedelta(days=1)
    month_start = current_time.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if month_start.month == 12:
        monthly_reset_at = month_start.replace(year=month_start.year + 1, month=1)
    else:
        monthly_reset_at = month_start.replace(month=month_start.month + 1)
    api_source = _resolve_api_source(user)
    platform_token_budget_applies = api_source == "system"

    used_today = int(
        db.query(func.count(WorkflowRun.id))
        .filter(
            WorkflowRun.triggered_by_user_id == user.id,
            WorkflowRun.run_kind == "generation",
            WorkflowRun.started_at >= day_start,
            WorkflowRun.started_at < reset_at,
        )
        .scalar()
        or 0
    )
    monthly_tokens_used = int(
        db.query(func.coalesce(func.sum(TokenUsage.total_tokens), 0))
        .filter(
            TokenUsage.user_id == user.id,
            or_(TokenUsage.api_source == "system", TokenUsage.api_source.is_(None)),
            TokenUsage.created_at >= month_start,
            TokenUsage.created_at < monthly_reset_at,
        )
        .scalar()
        or 0
    )

    configured_limit = max(0, int(settings.public_beta_daily_generation_limit or 0))
    configured_monthly_token_limit = (
        max(0, int(settings.public_beta_monthly_token_limit or 0))
        if platform_token_budget_applies
        else 0
    )
    monthly_token_limit = configured_monthly_token_limit if configured_monthly_token_limit > 0 else None
    monthly_tokens_remaining = (
        max(0, configured_monthly_token_limit - monthly_tokens_used)
        if configured_monthly_token_limit > 0
        else None
    )

    if configured_monthly_token_limit > 0 and monthly_tokens_remaining == 0:
        return GenerationQuotaStatus(
            daily_limit=configured_limit if configured_limit > 0 else None,
            used_today=used_today,
            remaining_today=max(0, configured_limit - used_today) if configured_limit > 0 else None,
            reset_at=reset_at,
            api_source=api_source,
            platform_token_budget_applies=platform_token_budget_applies,
            monthly_token_limit=monthly_token_limit,
            monthly_tokens_used=monthly_tokens_used,
            monthly_tokens_remaining=monthly_tokens_remaining,
            monthly_reset_at=monthly_reset_at,
            allowed=False,
            reason="本月 Token 预算已用完，请下月再试。",
        )

    if configured_limit <= 0:
        return GenerationQuotaStatus(
            daily_limit=None,
            used_today=used_today,
            remaining_today=None,
            reset_at=reset_at,
            api_source=api_source,
            platform_token_budget_applies=platform_token_budget_applies,
            monthly_token_limit=monthly_token_limit,
            monthly_tokens_used=monthly_tokens_used,
            monthly_tokens_remaining=monthly_tokens_remaining,
            monthly_reset_at=monthly_reset_at,
            allowed=True,
        )

    remaining = max(0, configured_limit - used_today)
    allowed = remaining > 0
    return GenerationQuotaStatus(
        daily_limit=configured_limit,
        used_today=used_today,
        remaining_today=remaining,
        reset_at=reset_at,
        api_source=api_source,
        platform_token_budget_applies=platform_token_budget_applies,
        monthly_token_limit=monthly_token_limit,
        monthly_tokens_used=monthly_tokens_used,
        monthly_tokens_remaining=monthly_tokens_remaining,
        monthly_reset_at=monthly_reset_at,
        allowed=allowed,
        reason=None if allowed else "今日生成次数已用完，请明天再试。",
    )


def _resolve_api_source(user: User) -> str:
    provider = (user.llm_provider or "system").strip().lower() or "system"
    if provider != "system":
        return "user"
    if get_user_api_key(user):
        return "user"
    return "system"
