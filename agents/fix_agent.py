#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统一修复Agent - Fix Agent
汇总所有检查器发现的问题，一次性修复所有问题
减少LLM调用次数，架构更简洁
"""

from utils.volc_engine import call_volc_api
from utils.logger import logger
from config import TEMPERATURES, PROMPTS_DIR


def fix_all_issues(
    original_text: str,
    target_word_count: int,
    setting_bible: str,
    all_problems: str,
    chapter_num: int = None,
    prev_chapter_end: str = ""
) -> str:
    """
    汇总所有问题，一次性修复
    :param original_text: 需要修复的原始章节
    :param target_word_count: 目标字数
    :param setting_bible: 设定圣经
    :param all_problems: 所有问题汇总
    :param chapter_num: 章节号
    :param prev_chapter_end: 上一章结尾
    :return: 修复后的完整章节
    """
    # 检索相关历史章节和核心设定，保证修改不偏离前文
    from utils.vector_db import search_related_chapter_content, search_core_setting
    max_chapter = chapter_num if chapter_num else 9999
    related_chapters = search_related_chapter_content(original_text, top_k=2, max_chapter_num=max_chapter)
    related_settings = search_core_setting(original_text, top_k=2)
    related_content = related_settings + "\n" + related_chapters

    # 提取当前正确章节号
    chapter_hint = ""
    if chapter_num is not None:
        chapter_hint = f"""【本章正确章节号】：必须是第{chapter_num}章！如果标题章节号不对，请修正。
"""

    # 上一章结尾提示
    prev_chapter_hint = ""
    if chapter_num is not None and chapter_num > 1 and prev_chapter_end:
        prev_chapter_hint = f"""
=========================================
【**最重要的连贯性要求**】你必须保证本章开头直接顺畅承接下面给出的上一章结尾！
上一章结尾停在这里：
```
{prev_chapter_end}
```
本章故事必须**从这里直接开始**，不能凭空跳转到新场景，必须让读者感觉连贯不断片。
=========================================
"""

    # 读取系统prompt
    with open(PROMPTS_DIR / "fix.md", "r", encoding="utf-8") as f:
        system_prompt = f.read().strip()

    prompt = f"""{system_prompt}

=========================================
【设定圣经（必须100%遵守，绝对不能违反）】
{setting_bible}

【相关历史内容参考（保证剧情连贯，不和前文矛盾）】
{related_content}

{prev_chapter_hint}
{chapter_hint}【当前需要修复的原始章节】：
{original_text}

【所有需要修复的问题清单，请逐条认真解决】：
{all_problems}

【目标字数要求】：严格控制在 {target_word_count} 字左右，误差不超过15%

请输出修复后的完整章节正文：
"""

    logger.info("🔧 统一修复Agent正在修复所有问题...")
    result = call_volc_api("quality", prompt, temperature=TEMPERATURES["quality"])

    # 确保标题保留，章节号正确
    from agents.quality_agent import has_valid_title, fix_chapter_number
    if chapter_num is not None:
        result = fix_chapter_number(result, chapter_num)

    return result
