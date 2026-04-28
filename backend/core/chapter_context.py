"""
章节上下文构建器

职责：
- 构建章节生成所需的完整上下文
- 整合大纲、相关历史章节、相关设定
- 解析和整合场景锚点
"""

from typing import Tuple, List, Dict
from backend.utils.logger import logger
from .workflow_optimization import parse_scene_anchors_from_outline, format_scene_anchors_for_prompt


def build_chapter_context(
    chapter_index: int,
    chapter_plot: str,
    related_content: str,
    target_word_count: int,
) -> Tuple[str, List[Dict]]:
    """
    构建章节生成完整上下文

    Args:
        chapter_index: 章节序号
        chapter_plot: 章节大纲
        related_content: 相关历史章节和设定内容
        target_word_count: 目标字数

    Returns:
        (构建好的完整上下文, 场景锚点列表)
    """
    # 解析场景锚点
    scene_anchors = parse_scene_anchors_from_outline(chapter_plot)

    # 格式化场景锚点提示
    anchor_prompt = format_scene_anchors_for_prompt(scene_anchors)

    # 构建完整上下文
    full_context_parts = []

    if related_content.strip():
        full_context_parts.append(
            f"【历史章节与人物关系回顾】\n{related_content.strip()}"
        )

    if anchor_prompt.strip():
        full_context_parts.append(
            f"【本章关键场景锚点（必须包含）】\n{anchor_prompt.strip()}"
        )

    full_context_parts.append(f"【目标字数】\n约 {target_word_count} 字")

    full_context = "\n\n".join(full_context_parts)

    logger.debug(
        f"第{chapter_index}章上下文构建完成，包含 {len(scene_anchors)} 个场景锚点"
    )

    return full_context, scene_anchors
