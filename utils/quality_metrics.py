#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
客观质量指标计算器
计算词汇多样性、重复检测、段落长度等客观指标
补充AI主观评分，提供更全面的质量评估
"""

import re
from collections import Counter
from typing import Dict, List


def calculate_quality_metrics(text: str) -> Dict:
    """
    计算文本的客观质量指标

    返回:
        {
            "vocabulary_diversity": 词汇多样性 (0-1),
            "dialogue_ratio": 对话占比 (0-1),
            "avg_paragraph_length": 平均段落长度 (字符数),
            "long_paragraph_count": 过长段落数量,
            "repeated_phrases": 重复短语列表,
            "repeated_phrases_count": 重复短语数量,
            "total_words": 总字数,
            "total_paragraphs": 段落数
        }
    """
    # 分割段落
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    total_paragraphs = len(paragraphs)

    # 计算总字数（汉字+英文单词）
    # 统计汉字
    chinese_chars = re.findall(r'[\u4e00-\u9fff]', text)
    # 统计英文单词
    english_words = re.findall(r'[a-zA-Z]+', text)
    total_words = len(chinese_chars) + len(english_words)

    # 1. 词汇多样性 (Type-Token Ratio)
    words = extract_words(text)
    if len(words) > 0:
        unique_words = set(words)
        vocabulary_diversity = len(unique_words) / len(words)
    else:
        vocabulary_diversity = 0

    # 2. 对话占比
    # 统计对话行数（以引号开头或包含对话标记）
    dialogue_lines = 0
    total_lines = len([l for l in text.split('\n') if l.strip()])
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue
        # 常见对话格式："..." 或者 “...”
        if line.startswith('"') or line.startswith('“') or line.startswith('‘'):
            dialogue_lines += 1
        elif '"' in line and len(line) < 50:
            dialogue_lines += 1
    if total_lines > 0:
        dialogue_ratio = dialogue_lines / total_lines
    else:
        dialogue_ratio = 0

    # 3. 平均段落长度和过长段落统计
    if total_paragraphs > 0:
        paragraph_lengths = [len(p) for p in paragraphs]
        avg_paragraph_length = sum(paragraph_lengths) / total_paragraphs
        # 统计超过阈值的长段落
        from config import LONG_PARAGRAPH_THRESHOLD
        long_paragraph_count = sum(1 for pl in paragraph_lengths if pl > LONG_PARAGRAPH_THRESHOLD)
    else:
        avg_paragraph_length = 0
        long_paragraph_count = 0

    # 4. 重复短语检测（检测常见AI套话重复）
    repeated_phrases = find_repeated_phrases(text, min_count=2)
    repeated_phrases_count = len(repeated_phrases)

    return {
        "vocabulary_diversity": round(vocabulary_diversity, 3),
        "dialogue_ratio": round(dialogue_ratio, 3),
        "avg_paragraph_length": round(avg_paragraph_length, 1),
        "long_paragraph_count": long_paragraph_count,
        "repeated_phrases": repeated_phrases[:10],  # 只返回前10个
        "repeated_phrases_count": repeated_phrases_count,
        "total_words": total_words,
        "total_paragraphs": total_paragraphs
    }


def extract_words(text: str) -> List[str]:
    """提取文本中的词语（中文按字，英文按词）"""
    words = []
    # 提取汉字（每个汉字算一个词）
    chinese_words = re.findall(r'[\u4e00-\u9fff]', text)
    words.extend(chinese_words)
    # 提取英文单词
    english_words = re.findall(r'[a-zA-Z]+', text.lower())
    words.extend(english_words)
    return words


def find_repeated_phrases(text: str, min_count: int = 2) -> List[str]:
    """查找重复出现的短语（2-4个字的常见短语）"""
    # 常见AI套话短语模式
    # 检测"微微一笑"、"只见..."、"话落..."这类常见套话重复
    common_clichés = [
        "微微一笑", "淡淡一笑", "轻轻一笑",
        "只见", "话落", "轻声道",
        "眼中闪过", "瞳孔一缩", "心中一动",
        "一声冷哼", "淡淡说道", "缓缓说道",
        "身体一震", "脸色一变", "眉头一皱",
        "这究竟是", "怎么可能", "到底发生了什么",
        "笑声猛地卡在喉咙里",
    ]

    repeated = []
    for clichè in common_clichés:
        count = text.count(clichè)
        if count >= min_count:
            repeated.append(f"{clichè} ({count}次)")

    # 额外检测：任意2-4字短语重复
    words = extract_words(text)
    if len(words) >= 4:
        # 统计二元组
        bigrams = []
        for i in range(len(words) - 1):
            bigram = ''.join(words[i:i+2])
            bigrams.append(bigram)
        counter = Counter(bigrams)
        for phrase, count in counter.most_common():
            if count >= min_count and len(phrase) >= 2:
                if phrase not in [p.split(' ')[0] for p in repeated]:
                    repeated.append(f"{phrase} ({count}次)")
            if len(repeated) >= 10:
                break

    return repeated


def get_quality_summary(metrics: Dict) -> Dict:
    """根据客观指标给出质量总结和评分"""
    score = 10.0

    # 词汇多样性扣分
    if metrics["vocabulary_diversity"] < 0.3:
        score -= 1
    elif metrics["vocabulary_diversity"] < 0.2:
        score -= 2

    # 长段落扣分（影响移动端阅读体验）
    score -= metrics["long_paragraph_count"] * 0.5

    # 重复短语扣分
    score -= metrics["repeated_phrases_count"] * 0.3

    # 段落太少太长扣分
    if metrics["total_paragraphs"] < 3 and metrics["total_words"] > 1000:
        score -= 2

    return {
        "objective_score": max(1, round(score, 1)),
        "summary": generate_summary(metrics)
    }


def generate_summary(metrics: Dict) -> str:
    """生成质量总结文本"""
    summaries = []

    if metrics["vocabulary_diversity"] < 0.2:
        summaries.append("词汇多样性较低，存在重复表达")
    elif metrics["vocabulary_diversity"] < 0.3:
        summaries.append("词汇多样性尚可，可以进一步丰富")
    else:
        summaries.append("词汇多样性良好")

    if metrics["long_paragraph_count"] > 0:
        summaries.append(f"有 {metrics['long_paragraph_count']} 个过长段落，不适合移动端阅读，建议拆分")

    if metrics["repeated_phrases_count"] > 0:
        summaries.append(f"检测到 {metrics['repeated_phrases_count']} 个重复短语，建议修改")

    if metrics["dialogue_ratio"] < 0.1:
        summaries.append("对话占比偏低，适当增加对话可以提升节奏感")
    elif metrics["dialogue_ratio"] > 0.6:
        summaries.append("对话占比较高，描写相对偏少")

    return '；'.join(summaries)
