#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Critic Agent - 章节评审员
精简架构：输出纯 JSON 格式的评审结果，包含 passed/score/issues
遵循设计文档：Writer → System Guardrails → Critic → Revise → (Critic 复评)
"""

import json
import re
import openai
from typing import Tuple, List, Dict, Optional
from utils.volc_engine import call_volc_api
from utils.logger import logger
from core.config import settings
from config import PROMPTS_DIR, CRITIC_PASS_SCORE


def critic_chapter(
    chapter_content: str,
    setting_bible: str,
    chapter_outline: str,
    content_type: str = "novel",
    client: openai.OpenAI = None
) -> Tuple[bool, int, List[Dict]]:
    """
    评审章节，输出 JSON 格式的结果。

    Args:
        chapter_content: 待评审的章节正文
        setting_bible: 设定圣经全文
        chapter_outline: 当前章节的大纲
        content_type: 内容类型 (novel/short_story/script)
        client: OpenAI客户端

    Returns:
        (passed: 是否通过, score: 分数 1-10, issues: 问题列表)
        issues 列表中每个item包含: {type, location, fix}
    """
    # 读取 prompt 模板
    prompt_path = PROMPTS_DIR / "critic.md"
    with open(prompt_path, 'r', encoding='utf-8') as f:
        template = f.read().strip()

    # 占位符替换
    context = {
        "chapter_content": chapter_content,
        "world_bible": setting_bible,
        "chapter_outline": chapter_outline,
        "content_type": content_type,
    }

    for key, value in context.items():
        # 世界圣经太长，截断保留核心部分
        if key == "world_bible" and len(str(value)) > 2500:
            value = str(value)[:2500] + "\n...（内容过长已截断）"
        template = template.replace(f"{{{{{key}}}}}", str(value))

    logger.info(f"🔍 Critic Agent正在评审章节，等待结果...")
    temperature = settings.get_temperature_for_agent("critic")
    result = call_volc_api("critic", template, temperature=temperature, client=client)

    # 解析 JSON 结果
    data = parse_json_result(result)
    if data is None:
        # 解析失败，默认不通过
        logger.error(f"❌ Critic 输出JSON解析失败，输出内容: {result[:200]}...")
        return False, 5, [{
            "type": "格式问题",
            "location": "全文",
            "fix": "重新生成，确保输出严格符合JSON格式"
        }]

    passed = data.get("passed", False)
    score = data.get("score", 5)
    issues = data.get("issues", [])

    # 确保score在1-10范围
    score = max(1, min(10, score))

    logger.info(f"📊 评审完成，分数: {score}/10，通过: {passed}，问题数: {len(issues)}")
    if not passed and issues:
        for i, issue in enumerate(issues[:3]):
            logger.info(f"   {i+1}. [{issue.get('type')}] {issue.get('location')} → {issue.get('fix')[:50]}")

    return passed, score, issues


def parse_json_result(result: str) -> Optional[Dict]:
    """从输出中提取并解析JSON。"""
    try:
        # 尝试提取被markdown包裹的JSON
        json_text = extract_json_from_markdown(result)
        data = json.loads(json_text)
        return data
    except Exception as e:
        logger.warning(f"JSON解析失败: {e}")
        return None


def extract_json_from_markdown(text: str) -> str:
    """从markdown中提取JSON内容。"""
    # 匹配 ```json ... ```
    json_block_pattern = r'```(?:json)?\s*({[\s\S]*?})\s*```'
    match = re.search(json_block_pattern, text)
    if match:
        return match.group(1)

    # 匹配 {...} 整块
    curly_pattern = r'({[\s\S]*})'
    match = re.search(curly_pattern, text)
    if match:
        return match.group(1)

    # 如果都没找到，返回原文本尝试直接解析
    return text.strip()
