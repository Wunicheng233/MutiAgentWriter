#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
质量校验Agent
检查字数、格式、文笔，去除AI味，提升整体质量
"""

import re
from utils.volc_engine import call_volc_api
from utils.logger import logger
from config import (
    TEMPERATURES,
    WORD_COUNT_DEVIATION_ALLOWED,
    WORD_COUNT_DEVIATION_HARD,
    LONG_PARAGRAPH_THRESHOLD,
    AI_CLICHE_REPEAT_THRESHOLD
)


def check_quality(original_text: str, target_word_count: int, setting_bible: str, chapter_num: int = None, prev_chapter_end: str = "") -> tuple[bool, str, str]:
    """
    检查章节质量（纯检查，不动笔修改）
    返回：(是否通过, 问题反馈/优化建议) - 如果不通过，feedback包含需要修正的问题
    """
    # 第一步：自动检查基础项（不需要LLM）
    word_count = count_chinese_words(original_text)
    logger.info(f"质量检查：当前字数 {word_count}，目标字数 {target_word_count}")

    feedback = ""
    problems_found = False

    allowed_deviation = int(target_word_count * WORD_COUNT_DEVIATION_ALLOWED)
    hard_max_deviation = int(target_word_count * WORD_COUNT_DEVIATION_HARD)

    # 1. 检查标题和章节号
    first_line = original_text.split('\n')[0].strip()
    if not has_valid_title(first_line):
        feedback += "- 缺少有效章节标题，格式必须是 `第X章 标题`\n"
        problems_found = True
    elif chapter_num is not None:
        # 检查章节号是否正确
        clean_line = first_line.lstrip('#').strip()
        match = re.search(r'第\s*(\d+)\s*章', clean_line)
        if match:
            found_num = int(match.group(1))
            if found_num != chapter_num:
                feedback += f"- 章节号错误，应该是第{chapter_num}章，实际写成了第{found_num}章\n"
                problems_found = True

    # 2. 检查字数偏差
    if abs(word_count - target_word_count) > hard_max_deviation:
        feedback += f"- 字数偏差过大。当前字数：{word_count}，目标字数：{target_word_count}，必须调整到目标字数±{allowed_deviation}范围内\n"
        problems_found = True  # 硬伤，必须打回
    elif abs(word_count - target_word_count) > allowed_deviation:
        feedback += f"- 字数有偏差。当前字数：{word_count}，目标字数：{target_word_count}，必须调整到目标字数±{allowed_deviation}范围内\n"
        problems_found = True  # 超出允许偏差，必须修正

    # 3. 检查段落格式（是否都是短段落）
    if not has_good_paragraphs(original_text):
        feedback += f"- 存在过长段落（超过{LONG_PARAGRAPH_THRESHOLD}字符），必须拆分成更多短段落，每段1-3句话，对话单独成段\n"
        problems_found = True  # 格式硬伤，必须打回

    # 4. 章节连贯性强制要求（本章开头必须承接上一章结尾）
    if chapter_num is not None and chapter_num > 1 and prev_chapter_end:
        # 只在反馈中提醒，不默认就判定为问题（quality无法自动检测是否连贯，由critic做最终判断）
        # 但如果之前已经重试过还是不对，才强制要求修正。这里只给提示信息
        feedback += "- 请确认本章开头直接顺畅承接上一章结尾，剧情不能断片，不能突兀跳转。上一章结尾内容参考：\n```\n" + prev_chapter_end + "\n```\n"
        # 不再默认设置problems_found = True，让critic评审判断是否真的不连贯

    # ========== 优化说明 ==========
    # AI模板化套话检查、情绪转换检查、结尾悬念检查 都移除了
    # 原因：这些是"软伤"，editor润色阶段本来就会处理，提前检查会导致重复工作
    # editor润色完，如果还有问题，Critic终审会挑出来，交给optimize处理
    # 这样减少了第一轮不必要的修改回合，节省LLM调用

    # 如果没有任何问题，直接通过
    if not problems_found and not feedback.strip():
        logger.info("质量检查通过")
        return True, original_text, "一切正常，无明显问题"

    # 如果只有优化建议，没有致命硬伤，直接通过，交给critic评审
    if not problems_found:
        logger.info(f"质量检查通过，但有一些优化建议：{feedback.strip()}")
        return True, original_text, feedback.strip()

    # 有致命硬伤（字数超标、格式错、重复套话太多、情绪明显生硬），必须重写优化
    logger.warning(f"质量检查不通过，问题：\n{feedback}")
    return False, original_text, feedback.strip()


def optimize_quality(original_text: str, target_word_count: int, setting_bible: str, feedback: str, chapter_num: int = None, prev_chapter_end: str = "") -> str:
    """
    根据质量检查的反馈，执行优化修正
    职责：只做优化，不做检查
    """
    # 检索相关历史章节和核心设定，保证修改不偏离前文
    from utils.vector_db import search_related_chapter_content, search_core_setting
    related_chapters = search_related_chapter_content(original_text, top_k=2, max_chapter_num=chapter_num if chapter_num else 9999)
    related_settings = search_core_setting(original_text, top_k=2)
    related_content = related_settings + "\n" + related_chapters

    # 提取当前正确章节号给LLM
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
如果反馈指出了连贯性问题，你必须认真修正开头，保证顺畅衔接。
=========================================
"""

    prompt = f"""
=========================================
【任务】根据专业评论家指出的问题，重新优化小说章节，逐条修正问题，保证剧情和设定连贯
=========================================

【设定圣经（人物设定世界观必须100%遵守，绝对不能违反）】
{setting_bible}

【相关历史内容参考（保证剧情连贯，不和前文矛盾）】
{related_content}

{prev_chapter_hint}
{chapter_hint}【当前需要优化的原始章节】：
{original_text}

【评论家指出的问题，请**逐条认真解决**，不能漏掉任何一个问题】：
{feedback}

请重新输出优化后的完整章节，**必须完全保持原剧情走向、核心冲突、人物关系不变，只修正评论家指出的问题**。

【强制要求】：
1. 必须保留原章节标题在第一行，章节号必须正确
2. 严格控制字数在 {target_word_count} 字左右，误差不超过15%
3. 保持短段落排版，每段1-3句话，对话单独成段，禁止大段文字堆砌
4. 发现有重复的烂大街模板套话，必须删除替换成更自然生动的表达，表达方式要多样
5. 如果人物情绪转换生硬，请增加过渡过程，让变化更自然
6. 如果结尾悬念生硬，请改成自然方式：展示反常现象/潜在危险/未知谜团，让读者自己产生好奇，不要用生硬的疑问句结尾
7. **本章开头必须和上一章结尾连贯**，情节逻辑必须顺畅衔接，不能让人觉得突兀跳转
8. 剧情核心、人物设定必须完全保留，和前文保持一致，绝对不能改剧情

请输出优化后的完整章节：
"""
    logger.info("quality优化Agent正在根据反馈重新优化...")
    result = call_volc_api("quality", prompt, temperature=TEMPERATURES["quality"])

    # 确保标题保留，并最后再检查一次章节号（最后一道关卡）
    original_first_line = original_text.split('\n')[0].strip()
    result_first_line = result.split('\n')[0].strip()
    if not has_valid_title(result_first_line):
        logger.warning("优化后标题异常，恢复原始标题")
        result = original_first_line + "\n\n" + result.lstrip('#').lstrip()

    # 再次自动修正章节号
    if chapter_num is not None:
        result = fix_chapter_number(result, chapter_num)

    return result


def count_chinese_words(text: str) -> int:
    """统计汉字数量（粗略统计）"""
    # 匹配所有中文字符
    chinese_chars = re.findall(r'[\u4e00-\u9fff]', text)
    return len(chinese_chars)


def has_valid_title(first_line: str) -> bool:
    """检查是否有有效标题"""
    clean_line = first_line.lstrip('#').strip()
    # 匹配 "第X章" 开头
    return bool(re.match(r'^第\s*\d+\s*章', clean_line))


def has_good_paragraphs(text: str) -> bool:
    """检查是否都是短段落（平均每行字数不超过60，没有过长段落）"""
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    if not paragraphs:
        return False
    # 检查是否有过长段落（超过配置阈值字符）
    for p in paragraphs:
        if len(p) > LONG_PARAGRAPH_THRESHOLD:
            return False
    return True


def fix_chapter_number(text: str, correct_chapter_num: int) -> str:
    """自动修正章节号错误"""
    first_line = text.split('\n')[0].strip()
    clean_line = first_line.lstrip('#').strip()
    match = re.search(r'第\s*(\d+)\s*章', clean_line)
    if match:
        found_num = int(match.group(1))
        if found_num != correct_chapter_num:
            logger.warning(f"质量检查：标题章节号错误，应该是第{correct_chapter_num}章，写成了第{found_num}章，自动修正...")
            new_first_line = clean_line.replace(f"第{found_num}章", f"第{correct_chapter_num}章", 1)
            lines = text.split('\n')
            lines[0] = new_first_line
            return '\n'.join(lines)
    return text


def check_ai_cliches(text: str) -> str:
    """检查是否有过多AI模板化套话和重复表达"""
    cliches = [
        '只见', '话落', '微微一笑', '嘴角微微上扬', '心中一动', '瞳孔一缩',
        '眼中闪过一丝', '脸上露出了', '身形一晃', '脚下一顿', '轻哼一声',
        '笑声猛地卡在喉咙里', '哄笑猛地卡在喉咙里', '笑声戛然而止'
    ]
    found = []
    for cliche in cliches:
        count = text.count(cliche)
        if count >= AI_CLICHE_REPEAT_THRESHOLD:
            found.append(f"'{cliche}'出现了{count}次，重复过多")
    if found:
        return f"存在过多AI模板化套话/重复表达：{', '.join(found)}，请删除替换成更自然多样的表达"

    # 检查结尾是不是都是疑问句，太刻意
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if lines and len(lines) > 3:
        last_line = lines[-1]
        if last_line.endswith('?') or last_line.endswith('？'):
            found.append("结尾生硬用疑问句制造悬念，建议改用更自然的方式，展示出未知或危险让读者自己好奇")

    if found:
        return "; ".join(found)
    return ""


def check_emotion_transition(text: str) -> str:
    """检查人物情绪转换是否生硬"""
    # 简单heuristic检查：查找情绪关键词，短段落内情绪变化太剧烈就算问题
    emotion_keywords = [
        '愤怒', '暴怒', '冷笑', '恐惧', '害怕', '惊讶', '诧异',
        '狂喜', '大笑', '平静', '淡定', '凶狠', '温柔'
    ]
    # 统计在短内容中情绪词汇密度太高，说明转换太频繁生硬
    paragraphs = text.split('\n')
    for p in paragraphs:
        count = sum(1 for kw in emotion_keywords if kw in p)
        if count >= 3 and len(p) < 100:
            return "段落内情绪转换太频繁，缺少过渡过程，建议放缓节奏，让情绪变化有过程"
            break
    return ""


def generate_chapter_title(full_content: str, chapter_num: int) -> str:
    """
    本章内容完整生成后，专门再起一个高质量标题
    输入：完整章节内容
    输出：带标题的完整内容（替换原标题）
    """
    # 提取正文（去掉原标题）
    lines = full_content.split('\n')
    first_line = lines[0].strip()
    # 如果已经有标题，提取正文内容
    if has_valid_title(first_line):
        body = '\n'.join(lines[1:]).strip()
    else:
        body = full_content.strip()

    prompt = f"""
你现在需要给这一章小说起一个好标题。

本章核心内容摘要（前1500字）：
{full_content[:1500]}

本章是第{chapter_num}章。

要求：
1. 格式必须是：第{chapter_num}章 XXXXX
   例如：第7章 地府网约车订单
2. 标题要**准确概括本章核心剧情/核心冲突**，让读者一看就知道本章讲什么
3. 标题要有吸引力，符合番茄小说风格，让人想点进去看
4. 字数控制在5-15字左右（不含"第X章"），不要太长

请直接输出完整标题：
"""
    logger.info(f"正在为第{chapter_num}章生成高质量标题...")
    result = call_volc_api("quality", prompt, temperature=0.3)

    # 解析结果，提取标题
    result = result.strip()
    # 确保章节号正确
    match = re.search(r'第\s*(\d+)\s*章', result)
    if match:
        found_num = int(match.group(1))
        if found_num != chapter_num:
            # 修正章节号
            result = result.replace(f"第{found_num}章", f"第{chapter_num}章", 1)

    # 如果结果不包含"第X章"，加上
    if not re.search(r'第\s*\d+\s*章', result):
        result = f"第{chapter_num}章 {result.strip()}"

    # 拼回正文
    return result.strip() + "\n\n" + body
