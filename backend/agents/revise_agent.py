#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Revise Agent - 内容修订师
根据 Critic 输出的问题清单，严格执行修订指令，只修改指定问题，不动其他内容。
遵循精简架构设计：Writer → Guardrails → Critic → Revise → (Critic 复评)
"""

import json
import openai
from utils.volc_engine import call_volc_api
from utils.logger import logger
from backend.core.config import settings
from utils.file_utils import load_prompt
from utils.json_utils import parse_json_result


def revise_chapter(
    original_chapter: str,
    critic_issues: list,
    setting_bible: str,
    client: openai.OpenAI = None,
    perspective: str = None,
    perspective_strength: float = 0.7,
    project_config: dict = None,
) -> str:
    """
    根据 Critic 的问题清单修订章节。

    Args:
        original_chapter: 原始章节完整正文
        critic_issues: Critic 输出的 issues 数组（已经解析为Python列表）
        setting_bible: 完整设定圣经（用于核验）
        client: OpenAI客户端
        perspective: 写作视角
        perspective_strength: 视角强度

    Returns:
        修订后的完整章节正文
    """
    # 占位符替换上下文
    context = {
        "original_chapter": original_chapter,
        "critic_issues": json.dumps(critic_issues, ensure_ascii=False, indent=2),
        "world_bible": setting_bible,
    }

    # 使用统一的 load_prompt 加载提示词（支持 Skill 注入）
    template = load_prompt(
        "revise",
        context=context,
        perspective=perspective,
        perspective_strength=perspective_strength,
        project_config=project_config,
    )

    logger.info(f"✂️  Revise Agent正在修订章节，问题数: {len(critic_issues)}")
    temperature = settings.get_temperature_for_agent("revise")
    return call_volc_api(
        "revise",
        template,
        temperature=temperature,
        client=client,
        perspective=perspective,
        perspective_strength=perspective_strength,
        project_config=project_config,
    )


def revise_local_patch(
    original_chapter: str,
    repair_issue: dict,
    local_context: dict,
    setting_bible: str,
    client: openai.OpenAI = None,
    perspective: str = None,
    perspective_strength: float = 0.7,
    project_config: dict = None,
) -> dict:
    """Revise only the target fragment with adjacent context preserved."""
    context = {
        "world_bible": setting_bible,
        "repair_issue": json.dumps(repair_issue, ensure_ascii=False, indent=2),
        "local_context": json.dumps(local_context, ensure_ascii=False, indent=2),
        "original_chapter_excerpt": _build_local_excerpt(local_context),
    }

    # 使用统一的 load_prompt 加载提示词（支持 Skill 注入）
    template = load_prompt(
        "revise_local_patch",
        context=context,
        perspective=perspective,
        perspective_strength=perspective_strength,
        project_config=project_config,
    )

    logger.info("✂️  Revise Agent正在执行局部片段修复")
    temperature = settings.get_temperature_for_agent("revise")
    result = call_volc_api(
        "revise",
        template,
        temperature=temperature,
        client=client,
        perspective=perspective,
        perspective_strength=perspective_strength,
        project_config=project_config,
    )
    patch = parse_json_result(result)
    if patch:
        return {
            "target_text": str(patch.get("target_text") or local_context.get("target") or ""),
            "replacement_text": str(patch.get("replacement_text") or patch.get("revised_target") or ""),
            "bridge_sentence": str(patch.get("bridge_sentence") or ""),
        }
    return {
        "target_text": str(local_context.get("target") or repair_issue.get("evidence_span", {}).get("quote") or ""),
        "replacement_text": result.strip(),
        "bridge_sentence": "",
    }


def stitch_chapter(
    chapter_content: str,
    repair_trace: list,
    setting_bible: str,
    client: openai.OpenAI = None,
    perspective: str = None,
    perspective_strength: float = 0.7,
    project_config: dict = None,
) -> str:
    """Run a bounded stitching pass after local repairs."""
    context = {
        "world_bible": setting_bible,
        "chapter_content": chapter_content,
        "repair_trace": json.dumps(repair_trace, ensure_ascii=False, indent=2),
    }

    # 使用统一的 load_prompt 加载提示词（支持 Skill 注入）
    template = load_prompt(
        "stitch",
        context=context,
        perspective=perspective,
        perspective_strength=perspective_strength,
        project_config=project_config,
    )

    logger.info("🪡 Revise Agent正在执行章节拼接连贯性修复")
    temperature = settings.get_temperature_for_agent("revise")
    result = call_volc_api(
        "revise",
        template,
        temperature=temperature,
        client=client,
        perspective=perspective,
        perspective_strength=perspective_strength,
        project_config=project_config,
    )
    data = parse_json_result(result)
    if data and data.get("chapter_content"):
        return str(data["chapter_content"]).strip()
    return result.strip() or chapter_content


def _build_local_excerpt(local_context: dict) -> str:
    parts = []
    if local_context.get("previous"):
        parts.append(f"【前一段】\n{local_context['previous']}")
    parts.append(f"【目标片段】\n{local_context.get('target', '')}")
    if local_context.get("next"):
        parts.append(f"【后一段】\n{local_context['next']}")
    return "\n\n".join(parts)
