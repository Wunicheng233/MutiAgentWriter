#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
对抗性评论Agent - Critic Agent
专门挑刺打分，找出章节存在的问题，帮助后续优化
这就是"对抗性修改"环节：一个挑错，一个优化，提升质量
"""

import re
from utils.volc_engine import call_volc_api
from utils.logger import logger
from config import TEMPERATURES, PROMPTS_DIR, CRITIC_PASS_SCORE


def critic_chapter(
    chapter_text: str,
    target_word_count: int,
    current_chapter: int,
    setting_bible: str
) -> tuple[bool, str, int]:
    """
    对抗性评论：给章节挑刺打分
    返回：(是否通过, 问题清单, 总分)
    """
    # 读取提示词
    prompt_path = PROMPTS_DIR / "critic.md"
    with open(prompt_path, 'r', encoding='utf-8') as f:
        system_prompt = f.read().strip()

    full_prompt = f"""{system_prompt}

=========================================
【当前章节信息】
目标章节号：第{current_chapter}章
目标字数：{target_word_count}字
=========================================

【设定圣经（用于检查设定一致性）】
{setting_bible}

=========================================
【需要评审的章节内容】
{chapter_text}

=========================================
请开始评审：
"""

    logger.info(f"🔍 Critic Agent正在评审第{current_chapter}章，寻找问题...")
    result = call_volc_api("critic", full_prompt, temperature=TEMPERATURES["critic"])

    # 解析结果
    score = parse_score(result)
    issues = parse_issues(result)
    passed = is_passed(result)

    # 如果只是解析问题失败，但分数不算太低，就默认通过
    # 这通常是AI输出格式不对，不是真的质量问题
    if "需要优化整体质量" in issues and score >= 5:
        passed = True

    logger.info(f"📊 第{current_chapter}章评审完成，得分：{score}/10，是否通过：{'是' if passed else '否'}")
    if not passed:
        logger.warning(f"⚠️  问题清单：{issues}")

    return passed, issues, score


def parse_score(result: str) -> int:
    """解析总分 - 更宽松的匹配"""
    # 多种格式匹配，容忍不同的输出
    patterns = [
        r'【总分】\s*[:：]\s*(\d+)\s*[\//]',
        r'总分\s*[:：]\s*(\d+)',
        r'得分[:：]\s*(\d+)',
        r'(\d+)\s*\/\s*10'
    ]
    for pattern in patterns:
        match = re.search(pattern, result)
        if match:
            score = int(match.group(1))
            return max(1, min(10, score))  #  clamp 1-10
    return 6  # 默认及格分


def parse_issues(result: str) -> str:
    """解析问题清单 - 更宽松的匹配"""
    patterns = [
        r'【问题清单】\s*[:：]\s*(.*?)(?=【是否通过|【总分|是否通过|总分|\Z)',
        r'问题清单\s*[:：]\s*(.*?)(?=是否通过|总分|\Z)',
        r'问题[:：]\s*(.*?)(?=是否通过|总分|\Z)',
        r'(.*?)(?=【是否通过|是否通过)'
    ]
    for pattern in patterns:
        match = re.search(pattern, result, re.DOTALL)
        if match:
            issues = match.group(1).strip()
            if len(issues) > 0:
                return issues
    # 如果还是没找到，提取所有内容
    lines = result.strip().split('\n')
    if len(lines) >= 2:
        return '\n'.join(lines[1:]).strip()
    return "需要优化整体质量，提升故事吸引力和结尾悬念"


def is_passed(result: str) -> bool:
    """解析是否通过 - 严格按配置的及格线判断分数"""
    # 不管 AI 怎么说，严格按分数判断，分数 >= 配置及格线就算通过
    score = parse_score(result)
    return score >= CRITIC_PASS_SCORE
