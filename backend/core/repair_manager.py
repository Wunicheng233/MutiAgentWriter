"""
修复管理器 - 处理章节质量问题的检测、定位和修复

职责：
- 管理本地修复策略的应用
- 管理 Stitching Pass（过渡修复）
- 记录修复追踪信息
"""

from typing import List, Dict, Tuple, Optional, Any
from backend.utils.logger import logger


class RepairManager:
    """管理章节修复流程"""

    def __init__(
        self,
        revise_agent: Any,
        setting_bible: str,
        chapter_outline: str,
        chapter_index: int,
        perspective: str = None,
        perspective_strength: float = 0.7,
        event_reporter: Optional[callable] = None,
    ):
        """
        初始化修复管理器

        Args:
            revise_agent: Revise Agent 实例
            setting_bible: 设定圣经
            chapter_outline: 章节大纲
            chapter_index: 章节序号
            perspective: 作家视角
            perspective_strength: 视角强度
            event_reporter: 事件报告回调函数
        """
        self.revise_agent = revise_agent
        self.setting_bible = setting_bible
        self.chapter_outline = chapter_outline
        self.chapter_index = chapter_index
        self.perspective = perspective
        self.perspective_strength = perspective_strength
        self.event_reporter = event_reporter
        self.stitching_reports: List[Dict] = []

    def _report_event(self, message: str) -> None:
        """报告工作流事件"""
        if self.event_reporter:
            self.event_reporter(message)
        logger.info(message)

    def apply_repair_batch(
        self,
        chapter_content: str,
        issues: List[Dict],
    ) -> Tuple[str, bool, List[Dict]]:
        """
        批量应用修复策略

        Args:
            chapter_content: 章节内容
            issues: Critic 发现的问题列表

        Returns:
            (修复后的内容, 是否使用了本地修复, 修复追踪记录)
        """
        repair_trace: List[Dict] = []
        used_local_repair = False
        current_content = chapter_content

        # 本地修复逻辑（如果实现了 local patch 方法可以在这里扩展）
        # 目前直接使用整章修订

        # 本地修复失败，回退到整章修订
        current_content = self.revise_agent.revise_chapter(
            current_content,
            issues,
            self.setting_bible,
            perspective=self.perspective,
            perspective_strength=self.perspective_strength,
        )
        self._report_event(
            f"Workflow v2 · 第{self.chapter_index}章 Revise：局部定位不足，已回退整章轻量修订"
        )
        return current_content, False, repair_trace

    def run_stitching_pass(
        self,
        chapter_content: str,
        repair_trace: List[Dict],
    ) -> str:
        """
        在本地修复后修复过渡和语气

        Args:
            chapter_content: 章节内容
            repair_trace: 修复追踪记录

        Returns:
            修复后的内容
        """
        stitcher = getattr(self.revise_agent, "stitch_chapter", None)
        if not stitcher:
            self.stitching_reports.append(
                {
                    "artifact_type": "stitching_report",
                    "chapter_index": self.chapter_index,
                    "applied": False,
                    "reason": "revise agent does not expose stitch_chapter",
                }
            )
            return chapter_content

        stitched = stitcher(
            chapter_content,
            repair_trace,
            self.setting_bible,
            perspective=self.perspective,
            perspective_strength=self.perspective_strength,
        )
        applied = bool(stitched and stitched != chapter_content)
        self.stitching_reports.append(
            {
                "artifact_type": "stitching_report",
                "chapter_index": self.chapter_index,
                "applied": applied,
                "repair_count": len(repair_trace),
            }
        )
        self._report_event(
            f"Workflow v2 · 第{self.chapter_index}章 Stitching Pass：{'已修复过渡' if applied else '无需改动'}，局部修复 {len(repair_trace)} 处"
        )
        return stitched or chapter_content
