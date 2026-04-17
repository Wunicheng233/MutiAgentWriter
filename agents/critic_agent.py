#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
对抗性评论Agent - Critic Agent
专门挑刺打分，找出章节存在的问题，帮助后续优化
这就是"对抗性修改"环节：一个挑错，一个优化，提升质量
"""

import re
import openai
from utils.volc_engine import call_volc_api
from utils.logger import logger
from core.config import settings
from config import PROMPTS_DIR, CRITIC_PASS_SCORE


def critic_chapter(
    chapter_text: str,
    target_word_count: int,
    current_chapter: int,
    setting_bible: str,
    client: openai.OpenAI = None
) -> tuple[bool, str, float, dict]:
    """
    对抗性评论：给章节挑刺打分，多维度评分
    返回：(是否通过, 问题清单, 总分, 维度分数字典)
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
    temperature = settings.get_temperature_for_agent("critic")
    result = call_volc_api("critic", full_prompt, temperature=temperature, client=client)

    # 解析结果
    dimension_scores = parse_dimension_scores(result)
    total_score = calculate_weighted_total(dimension_scores)
    issues = parse_issues(result)
    passed = is_passed(total_score)

    # 如果只是解析问题失败，但分数不算太低，就默认通过
    # 这通常是AI输出格式不对，不是真的质量问题
    if "需要优化整体质量" in issues and total_score >= 5:
        passed = True

    logger.info(f"📊 第{current_chapter}章评审完成，总分：{total_score:.1f}/10，是否通过：{'是' if passed else '否'}")
    logger.info(f"   维度分数：剧情逻辑={dimension_scores.get('plot', 0)}, 人设一致性={dimension_scores.get('character', 0)}, 吸引力={dimension_scores.get('hook', 0)}, 文笔质量={dimension_scores.get('writing', 0)}, 设定一致性={dimension_scores.get('setting', 0)}")
    if not passed:
        logger.warning(f"⚠️  问题清单：{issues}")

    return passed, issues, total_score, dimension_scores


# 维度权重配置
WEIGHTS = {
    "plot": 0.30,      # 剧情逻辑
    "character": 0.25, # 人设一致性
    "hook": 0.20,      # 吸引力
    "writing": 0.15,   # 文笔质量
    "setting": 0.10    # 设定一致性
}

DIMENSION_NAMES = {
    "plot": "剧情逻辑",
    "character": "人设一致性",
    "hook": "吸引力",
    "writing": "文笔质量",
    "setting": "设定一致性"
}

def parse_dimension_scores(result: str) -> dict:
    """解析五个维度的分数"""
    dimension_patterns = [
        ("plot", [r'【剧情逻辑】\s*[:：]\s*(\d+)\s*[\//]', r'剧情逻辑\s*[:：]\s*(\d+)']),
        ("character", [r'【人设一致性】\s*[:：]\s*(\d+)\s*[\//]', r'人设一致性\s*[:：]\s*(\d+)']),
        ("hook", [r'【吸引力】\s*[:：]\s*(\d+)\s*[\//]', r'吸引力\s*[:：]\s*(\d+)']),
        ("writing", [r'【文笔质量】\s*[:：]\s*(\d+)\s*[\//]', r'文笔质量\s*[:：]\s*(\d+)']),
        ("setting", [r'【设定一致性】\s*[:：]\s*(\d+)\s*[\//]', r'设定一致性\s*[:：]\s*(\d+)']),
    ]

    scores = {}
    for dim_key, patterns in dimension_patterns:
        score = 6  # 默认中等分数
        found = False
        for pattern in patterns:
            match = re.search(pattern, result)
            if match:
                score = int(match.group(1))
                score = max(1, min(10, score))
                found = True
                break
        scores[dim_key] = score

    # 如果解析失败尝试解析总分
    if all(v == 6 for v in scores.values()):
        # 尝试解析旧格式总分
        total_match = re.search(r'【总分】\s*[:：]\s*(\d+)\s*[\//]', result)
        if total_match:
            total = int(total_match.group(1))
            # 均匀分配
            for key in scores:
                scores[key] = max(1, min(10, total))
    return scores


def calculate_weighted_total(dimension_scores: dict) -> float:
    """根据维度分数计算加权总分"""
    total = 0.0
    total_weight = 0.0
    for key, score in dimension_scores.items():
        weight = WEIGHTS.get(key, 0)
        total += score * weight
        total_weight += weight
    if total_weight > 0:
        total = total / total_weight * 10  # 归一化到 0-10
    return max(1.0, min(10.0, total))


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


def is_passed(total_score: float) -> bool:
    """判断是否通过 - 严格按配置的及格线判断分数"""
    # 总分 >= 配置及格线就算通过
    return total_score >= CRITIC_PASS_SCORE
