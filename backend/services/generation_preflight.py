from __future__ import annotations

import math
from typing import Any

from sqlalchemy.orm import Session

from backend.auth import get_user_llm_config_issues
from backend.models import Project, User
from backend.services.generation_quota import get_generation_quota_status

DEFAULT_CHAPTER_WORD_COUNT = 2000
PLANNING_OVERHEAD_TOKENS = 1500
PER_CHAPTER_WORKFLOW_OVERHEAD_TOKENS = 1800
TOKENS_PER_TARGET_WORD = 4.5


def build_generation_preflight(db: Session, project: Project, user: User) -> dict[str, Any]:
    config = project.config if isinstance(project.config, dict) else {}
    start_chapter = _positive_int(config.get("start_chapter"), 1)
    end_chapter = _positive_int(config.get("end_chapter"), start_chapter)
    if end_chapter < start_chapter:
        end_chapter = start_chapter

    chapter_count = end_chapter - start_chapter + 1
    target_words_per_chapter = _positive_int(config.get("chapter_word_count"), DEFAULT_CHAPTER_WORD_COUNT)
    estimated_output_words = chapter_count * target_words_per_chapter
    estimated_token_count = estimate_generation_tokens(chapter_count, target_words_per_chapter)
    quota = get_generation_quota_status(db, user)
    llm_issues = get_user_llm_config_issues(user)

    messages: list[str] = []
    risk_level = "ok"
    if llm_issues:
        risk_level = "blocked"
        messages.extend(f"模型配置不完整：{issue}" for issue in llm_issues)
    elif not quota.allowed:
        risk_level = "blocked"
        if quota.reason:
            messages.append(quota.reason)
    elif quota.platform_token_budget_applies and quota.monthly_tokens_remaining is not None:
        if estimated_token_count > quota.monthly_tokens_remaining:
            risk_level = "warning"
            messages.append("预计本次生成可能超过本月平台 Token 预算，建议减少章节范围或改用自带 Key。")
    elif not quota.platform_token_budget_applies:
        messages.append("自带 Key 不占用平台 Token 预算，实际费用由你的模型供应商账户承担。")

    return {
        "start_chapter": start_chapter,
        "end_chapter": end_chapter,
        "chapter_count": chapter_count,
        "target_words_per_chapter": target_words_per_chapter,
        "estimated_output_words": estimated_output_words,
        "estimated_token_count": estimated_token_count,
        "api_source": quota.api_source,
        "platform_token_budget_applies": quota.platform_token_budget_applies,
        "monthly_token_limit": quota.monthly_token_limit,
        "monthly_tokens_remaining": quota.monthly_tokens_remaining,
        "daily_remaining": quota.remaining_today,
        "quota_allowed": quota.allowed and not llm_issues,
        "risk_level": risk_level,
        "messages": messages,
    }


def estimate_generation_tokens(chapter_count: int, target_words_per_chapter: int) -> int:
    if chapter_count <= 0 or target_words_per_chapter <= 0:
        return 0
    output_words = chapter_count * target_words_per_chapter
    return int(math.ceil(
        output_words * TOKENS_PER_TARGET_WORD
        + chapter_count * PER_CHAPTER_WORKFLOW_OVERHEAD_TOKENS
        + PLANNING_OVERHEAD_TOKENS
    ))


def _positive_int(value: Any, fallback: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = fallback
    return max(1, parsed)
