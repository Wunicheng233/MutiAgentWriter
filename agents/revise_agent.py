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
from core.config import settings
from config import PROMPTS_DIR


def revise_chapter(
    original_chapter: str,
    critic_issues: list,
    setting_bible: str,
    client: openai.OpenAI = None
) -> str:
    """
    根据 Critic 的问题清单修订章节。

    Args:
        original_chapter: 原始章节完整正文
        critic_issues: Critic 输出的 issues 数组（已经解析为Python列表）
        setting_bible: 完整设定圣经（用于核验）
        client: OpenAI客户端

    Returns:
        修订后的完整章节正文
    """
    # 读取 prompt 模板
    prompt_path = PROMPTS_DIR / "revise.md"
    with open(prompt_path, 'r', encoding='utf-8') as f:
        template = f.read().strip()

    # 占位符替换
    context = {
        "original_chapter": original_chapter,
        "critic_issues": json.dumps(critic_issues, ensure_ascii=False, indent=2),
        "world_bible": setting_bible,
    }

    for key, value in context.items():
        template = template.replace(f"{{{{{key}}}}}", str(value))

    logger.info(f"✂️  Revise Agent正在修订章节，问题数: {len(critic_issues)}")
    temperature = settings.get_temperature_for_agent("revise")
    return call_volc_api("revise", template, temperature=temperature, client=client)
