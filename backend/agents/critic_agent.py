#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Critic Agent - 章节评审员
精简架构：输出纯 JSON 格式的评审结果，包含 passed/score/issues
遵循设计文档：Writer → System Guardrails → Critic → Revise → (Critic 复评)
"""

import openai
from typing import Tuple, List, Dict, Optional
from utils.volc_engine import call_volc_api
from utils.logger import logger
from backend.core.config import settings
from config import CRITIC_PASS_SCORE
from utils.file_utils import load_prompt
from utils.json_utils import parse_json_result

CRITIC_V2_DIMENSIONS = (
    "plot_progress",
    "character_consistency",
    "style_match",
    "worldview_conflict",
    "redundancy",
    "hook_strength",
    "rhythm_continuity",
)


def critic_chapter(
    chapter_content: str,
    setting_bible: str,
    chapter_outline: str,
    content_type: str = "novel",
    client: openai.OpenAI = None,
    perspective: str = None,
    perspective_strength: float = 0.7,
    project_config: dict = None,
) -> Tuple[bool, int, Dict, List, Optional[Dict]]:
    """
    评审章节，输出 JSON 格式的评审结果。

    Args:
        chapter_content: 待评审的章节正文
        setting_bible: 设定圣经全文
        chapter_outline: 当前章节的大纲
        content_type: 内容类型 (novel/short_story/script)
        client: OpenAI客户端
        perspective: 写作视角
        perspective_strength: 视角强度

    Returns:
        (passed: 是否通过, score: 总分 1-10, dimensions: 各维度评分, issues: 问题列表, critique_v2: V2诊断数据)
        issues 列表中每个item包含: {type, location, fix}
    """
    # 占位符替换上下文
    context = {
        "chapter_content": chapter_content,
        "world_bible": setting_bible,
        "chapter_outline": chapter_outline,
        "content_type": content_type,
    }

    # 使用统一的 load_prompt 加载提示词（支持 Skill 注入）
    template = load_prompt(
        "critic",
        content_type=content_type,
        context=context,
        perspective=perspective,
        perspective_strength=perspective_strength,
        project_config=project_config,
    )

    logger.info(f"🔍 Critic Agent正在评审章节，等待结果...")
    temperature = settings.get_temperature_for_agent("critic")
    result = call_volc_api(
        "critic",
        template,
        temperature=temperature,
        client=client,
        perspective=perspective,
        perspective_strength=perspective_strength,
        project_config=project_config,
    )

    # 解析 JSON 结果
    data = parse_json_result(result)
    if data is None:
        # 解析失败，默认不通过
        logger.error(f"❌ Critic 输出JSON解析失败，输出内容: {result[:200]}...")
        return False, 5, {}, [{
            "type": "格式问题",
            "location": "全文",
            "fix": "重新生成，确保输出严格符合JSON格式"
        }], None

    passed = data.get("passed", False)
    score = data.get("score", 5)
    dimensions = data.get("dimensions", {})
    issues = data.get("issues", [])

    # 确保score在1-10范围
    try:
        score = int(score)
    except (TypeError, ValueError):
        score = 5
    score = max(1, min(10, score))

    # 确保每个维度都有值，默认5分
    default_dimensions = {
        "plot": 5,
        "character": 5,
        "hook": 5,
        "writing": 5,
        "setting": 5,
    }
    for k in default_dimensions:
        if k not in dimensions:
            dimensions[k] = default_dimensions[k]
        else:
            try:
                dimensions[k] = int(dimensions[k])
            except (TypeError, ValueError):
                dimensions[k] = default_dimensions[k]
            dimensions[k] = max(1, min(10, dimensions[k]))

    logger.info(f"📊 评审完成，分数: {score}/10，通过: {passed}，问题数: {len(issues)}")
    if not passed and issues:
        for i, issue in enumerate(issues[:3]):
            logger.info(f"   {i+1}. [{issue.get('type')}] {issue.get('location')} → {issue.get('fix')[:50]}")

    critique_v2 = data.get("critique_v2") or data.get("diagnostics")
    if critique_v2 is None and any(field in data for field in CRITIC_V2_DIMENSIONS):
        critique_v2 = {field: data.get(field, []) for field in CRITIC_V2_DIMENSIONS}

    # 固定返回 5 元组，确保所有代码路径返回相同结构
    return passed, score, dimensions, issues, critique_v2
