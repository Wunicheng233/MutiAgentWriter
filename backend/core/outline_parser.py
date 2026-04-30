"""
大纲解析模块 - 从设定圣经中解析结构化章节大纲

职责：
- 解析 Planner 输出的设定圣经
- 支持传统格式和表格格式
- 提取场景锚点并附加到对应章节
"""

import re
import json
from typing import List, Dict, Optional

from backend.utils.logger import logger
from .workflow_optimization import extract_scene_anchor_blocks_by_chapter


def parse_outlines_from_setting_bible(
    setting_bible: Optional[str],
    plan: Optional[str],
    chapter_word_count: str = "2000",
) -> List[Dict]:
    """
    从 Planner 输出的设定圣经中解析分章大纲。
    支持两种格式：
    1. 传统格式：每个章节单独一行，以"第X章"开头
    2. 表格格式：Markdown表格，第一列包含"第X章"（Planner默认输出格式）

    Args:
        setting_bible: 设定圣经内容
        plan: 完整策划方案（回退使用）
        chapter_word_count: 每章目标字数

    Returns:
        章节大纲列表:
        [
            {
                "chapter_num": int,
                "title": str,
                "outline": str,  # 本章目标、核心冲突、结尾钩子
            }
        ]
    """
    if not setting_bible:
        return []

    outlines = []
    lines = setting_bible.split('\n')

    # 匹配行首的 "第X章"（传统格式）
    chapter_pattern = re.compile(r'^(#\s*)?第\s*(\d+)\s*章[:：]?\s*(.*)$')
    # 匹配表格单元格中的 "第X章"（支持 "| 第X章 | ..." 格式）
    table_chapter_pattern = re.compile(r'第\s*(\d+)\s*章')

    current_chapter = None
    current_title = ""
    current_outline_parts = []
    in_scene_anchor_section = False

    for line in lines:
        line_stripped = line.strip()
        if re.match(r"^#+\s*.*scene[_\s-]*anchors", line_stripped, re.IGNORECASE):
            in_scene_anchor_section = True
            continue
        if in_scene_anchor_section:
            continue

        # 优先检查是否是表格行中的章节（Planner默认输出格式）
        # 格式: | 第1章 | 本章目标 | 核心冲突 | 结尾钩子 |
        match_in_table = table_chapter_pattern.search(line)
        if match_in_table:
            chapter_num = int(match_in_table.group(1))
            # 从表格行提取各列
            columns = [col.strip() for col in line.split('|') if col.strip()]
            if len(columns) >= 4:
                # columns[0] = "第1章", columns[1] = "本章目标", columns[2] = "核心冲突", columns[3] = "结尾钩子"
                outline_text = f"本章目标：{columns[1]}\n核心冲突：{columns[2]}\n结尾钩子：{columns[3]}"

                # 保存上一章
                if current_chapter is not None:
                    outlines.append({
                        "chapter_num": current_chapter,
                        "title": current_title,
                        "outline": '\n'.join(current_outline_parts).strip() if current_outline_parts else outline_text,
                        "target_word_count": int(chapter_word_count)
                    })
                # 开始新一章
                current_chapter = chapter_num
                current_title = f"第{chapter_num}章"
                current_outline_parts = [outline_text]
                continue

        # 再检查是否是传统格式（行首就是第X章）
        match = chapter_pattern.match(line_stripped)
        if match and not match_in_table:  # 避免重复匹配表格行
            # 保存上一章
            if current_chapter is not None and (current_outline_parts or current_title):
                outlines.append({
                    "chapter_num": current_chapter,
                    "title": current_title,
                    "outline": '\n'.join(current_outline_parts).strip(),
                    "target_word_count": int(chapter_word_count)
                    })
            # 开始新一章
            current_chapter = int(match.group(2))
            current_title = match.group(3).strip()
            current_outline_parts = []
        elif current_chapter is not None and line_stripped:
            current_outline_parts.append(line_stripped)

    # 保存最后一章
    if current_chapter is not None:
        outlines.append({
            "chapter_num": current_chapter,
            "title": current_title,
            "outline": '\n'.join(current_outline_parts).strip() if current_outline_parts else f"第{current_chapter}章",
            "target_word_count": int(chapter_word_count)
            })

    # 去重并按章节号排序
    outlines = sorted(outlines, key=lambda x: x["chapter_num"])
    # 移除重复章节号（保留第一个）
    seen = set()
    unique_outlines = []
    for o in outlines:
        if o["chapter_num"] not in seen:
            unique_outlines.append(o)
            seen.add(o["chapter_num"])

    anchor_blocks = extract_scene_anchor_blocks_by_chapter(setting_bible)
    for outline in unique_outlines:
        anchor_block = anchor_blocks.get(outline["chapter_num"])
        if anchor_block:
            outline["outline"] = (
                f"{outline['outline']}\n\n"
                f"{json.dumps(anchor_block, ensure_ascii=False, indent=2)}"
            )

    # 如果没有解析到结构化大纲，创建占位大纲
    # 注意：调用方需要根据用户设置的 end_chapter 生成足够的章节
    if not unique_outlines and plan:
        # 回退：将整个plan作为第1章的大纲
        unique_outlines = [{
            "chapter_num": 1,
            "title": "",
            "outline": plan,
            "target_word_count": int(chapter_word_count)
        }]

    logger.info(f"从设定圣经解析出 {len(unique_outlines)} 个章节大纲")
    return unique_outlines
