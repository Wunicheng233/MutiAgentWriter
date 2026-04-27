"""Project-local NovelState storage for continuity-aware chapter generation."""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping, List, Dict, Tuple

from backend.utils.file_utils import write_file_atomic
from backend.utils.logger import logger


DEFAULT_NOVEL_STATE: dict[str, Any] = {
    "schema_version": "novel_state_v1",
    "characters": {},
    "timeline": [],
    "foreshadows": {},
    "style": {
        "voice": "",
        "pacing": "",
        "taboo_phrases": [],
        "reference_notes": "",
    },
    "updated_at": None,
}


class NovelStateService:
    """Maintain dynamic story facts in the project directory.

    The setting bible remains the baseline source of truth. NovelState only
    stores facts that change chapter by chapter: character states, timeline
    events, foreshadows, and style observations.
    """

    def __init__(self, project_dir: str | Path | None):
        self.project_dir = Path(project_dir) if project_dir else None
        self.state_path = self.project_dir / "novel_state.json" if self.project_dir else None

    def load_state(self) -> dict[str, Any]:
        state = deepcopy(DEFAULT_NOVEL_STATE)
        if self.state_path and self.state_path.exists():
            try:
                with open(self.state_path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                if isinstance(loaded, Mapping):
                    state.update(loaded)
            except (OSError, json.JSONDecodeError) as e:
                logger.warning(f"加载状态文件失败，使用默认状态: {type(e).__name__}: {e}")
        for key, default_value in DEFAULT_NOVEL_STATE.items():
            state.setdefault(key, deepcopy(default_value))
        return state

    def save_state(self, state: Mapping[str, Any]) -> dict[str, Any]:
        saved = deepcopy(dict(state))
        saved["schema_version"] = "novel_state_v1"
        saved["updated_at"] = datetime.utcnow().isoformat()
        if self.state_path:
            content = json.dumps(saved, ensure_ascii=False, indent=2)
            write_file_atomic(self.state_path, content)
        return saved

    def build_prewrite_context(
        self,
        chapter_outline: str,
        scene_anchors: list[Mapping[str, Any]],
        max_chars: int = 1800,
    ) -> str:
        state = self.load_state()
        parts = [
            "【NovelState 动态状态：只列入本章相关连续性约束】",
            self._format_characters(state.get("characters", {})),
            self._format_timeline(state.get("timeline", [])),
            self._format_foreshadows(state.get("foreshadows", {})),
            self._format_style(state.get("style", {})),
            "【本章状态使用原则】以 setting_bible 为基线，只把 NovelState 作为已发生事实和文风连续性的补充约束。",
        ]
        text = "\n".join(part for part in parts if part.strip())
        if len(text) > max_chars:
            text = text[:max_chars] + "\n...（NovelState 已按长度裁剪）"
        return text

    def extract_state_delta_from_chapter(
        self,
        chapter_index: int,
        chapter_content: str,
        scene_anchors: list[Mapping[str, Any]],
    ) -> dict[str, Any]:
        state_changes = [
            anchor.get("state_change")
            for anchor in scene_anchors
            if isinstance(anchor, Mapping) and anchor.get("state_change")
        ]
        hook_notes = [
            anchor.get("hook_intent")
            for anchor in scene_anchors
            if isinstance(anchor, Mapping) and anchor.get("hook_intent")
        ]
        return {
            "timeline": [
                {
                    "chapter": chapter_index,
                    "summary": "；".join(str(item) for item in state_changes) or f"第{chapter_index}章已生成",
                }
            ],
            "foreshadows": {
                f"chapter_{chapter_index}_hook": {
                    "status": "open",
                    "note": "；".join(str(item) for item in hook_notes),
                }
            }
            if hook_notes
            else {},
            "style": {
                "reference_notes": "保持当前章节短段落、连续承接、章节钩子的写作方式。",
            },
        }

    def register_foreshadow(
        self,
        foreshadow_id: str,
        chapter_index: int,
        scene_id: str,
        description: str,
    ):
        """登记一个新埋设的伏笔"""
        state = self.load_state()
        state.setdefault("foreshadows", {})[foreshadow_id] = {
            "status": "open",
            "planted_chapter": chapter_index,
            "planted_scene": scene_id,
            "description": description,
            "planted_at": datetime.utcnow().isoformat(),
        }
        self.save_state(state)

    def resolve_foreshadow(
        self,
        foreshadow_id: str,
        chapter_index: int,
        scene_id: str,
        resolution: str,
    ):
        """标记伏笔已回收"""
        state = self.load_state()
        if foreshadow_id in state.get("foreshadows", {}):
            state["foreshadows"][foreshadow_id]["status"] = "resolved"
            state["foreshadows"][foreshadow_id]["resolved_chapter"] = chapter_index
            state["foreshadows"][foreshadow_id]["resolved_scene"] = scene_id
            state["foreshadows"][foreshadow_id]["resolution"] = resolution
            self.save_state(state)

    def merge_delta(self, delta: Mapping[str, Any], source_scene: str = None) -> dict[str, Any]:
        """
        合并状态变更

        Args:
            delta: 状态增量
            source_scene: 导致此变更的 scene_id，用于追溯
        """
        state = self.load_state()

        for character_name, character_state in dict(delta.get("characters") or {}).items():
            current = state.setdefault("characters", {}).setdefault(character_name, {})
            if isinstance(current, dict) and isinstance(character_state, Mapping):
                current.update(dict(character_state))
            else:
                state["characters"][character_name] = character_state

        timeline_delta = delta.get("timeline") or []
        if isinstance(timeline_delta, list):
            # 新增：记录来源和时间戳
            for event in timeline_delta:
                if isinstance(event, dict):
                    event["source_scene"] = source_scene or "unknown"
                    event["timestamp"] = datetime.utcnow().isoformat()
            state.setdefault("timeline", []).extend(timeline_delta)
            state["timeline"] = state["timeline"][-30:]

        foreshadow_delta = delta.get("foreshadows") or {}
        if isinstance(foreshadow_delta, Mapping):
            state.setdefault("foreshadows", {}).update(dict(foreshadow_delta))

        style_delta = delta.get("style") or {}
        if isinstance(style_delta, Mapping):
            state.setdefault("style", {}).update(dict(style_delta))

        return self.save_state(state)

    def snapshot(self, chapter_index: int | None = None) -> dict[str, Any]:
        return {
            "chapter_index": chapter_index,
            "state": self.load_state(),
            "state_path": str(self.state_path) if self.state_path else None,
        }

    @staticmethod
    def _format_characters(characters: Any) -> str:
        if not isinstance(characters, Mapping) or not characters:
            return "角色动态：暂无新增动态状态。"
        lines = ["角色动态："]
        for name, state in list(characters.items())[:8]:
            lines.append(f"- {name}: {state}")
        return "\n".join(lines)

    @staticmethod
    def _format_timeline(timeline: Any) -> str:
        if not isinstance(timeline, list) or not timeline:
            return "时间线：暂无前文动态事件。"
        lines = ["时间线："]
        for event in timeline[-8:]:
            if isinstance(event, Mapping):
                lines.append(f"- 第{event.get('chapter', '?')}章: {event.get('summary', '')}")
            else:
                lines.append(f"- {event}")
        return "\n".join(lines)

    @staticmethod
    def _format_foreshadows(foreshadows: Any) -> str:
        if not isinstance(foreshadows, Mapping) or not foreshadows:
            return "伏笔：暂无待回收伏笔。"
        lines = ["伏笔："]
        for key, value in list(foreshadows.items())[:8]:
            lines.append(f"- {key}: {value}")
        return "\n".join(lines)

    @staticmethod
    def _format_style(style: Any) -> str:
        if not isinstance(style, Mapping) or not style:
            return "文风：按 setting_bible 与参考文风保持一致。"
        return (
            "文风："
            f"voice={style.get('voice', '')}; "
            f"pacing={style.get('pacing', '')}; "
            f"notes={style.get('reference_notes', '')}"
        )


class NovelStateValidator:
    """
    纯代码状态校验器，零token消耗
    在 Critic 评审前运行，抓出硬错误
    """

    def __init__(self, state_service: NovelStateService):
        self.state_service = state_service

    def validate_chapter(
        self,
        chapter_index: int,
        chapter_content: str,
        scene_anchors: List[Dict],
    ) -> Tuple[bool, List[Dict]]:
        """
        校验本章内容与当前状态快照的一致性

        Returns:
            (是否通过, 发现的硬错误列表)
        """
        logger.info(f"开始校验第 {chapter_index} 章状态一致性...")
        state = self.state_service.load_state()
        issues: List[Dict] = []

        # 检查1：角色一致性 - 已标记为死亡/离开的角色不应出现（除非回忆）
        char_count = len(state.get("characters", {}))
        logger.debug(f"当前 NovelState 中有 {char_count} 个角色记录")

        for char_name, char_state in state.get("characters", {}).items():
            char_state_str = str(char_state)
            if ("死亡" in char_state_str or "离开" in char_state_str or "不在" in char_state_str):
                if char_name in chapter_content:
                    context_window = self._get_name_context(chapter_content, char_name)
                    # 检查是否是回忆/闪回上下文
                    flashback_indicators = ["回忆", "想起", "记得", "当年", "以前", "恍惚", "仿佛"]
                    is_flashback = any(indicator in context_window for indicator in flashback_indicators)
                    if not is_flashback:
                        logger.warning(
                            f"发现角色状态冲突：{char_name} (状态: {char_state_str}) "
                            f"在第 {chapter_index} 章内容中出现（非回忆场景）"
                        )
                        issues.append({
                            "type": "character_state_violation",
                            "issue_type": "character_consistency",
                            "evidence_span": {"quote": char_name},
                            "severity": "high",
                            "fix_strategy": "state_consistency_repair",
                            "fix_instruction": f"{char_name} 状态为'{char_state}'，不应在本章出现，除非是回忆场景",
                        })

        # 检查2：伏笔堆积提醒（不强制失败，只作为参考）
        open_foreshadows = [
            k for k, v in state.get("foreshadows", {}).items()
            if isinstance(v, dict) and v.get("status") == "open"
        ]
        if len(open_foreshadows) > 5 and chapter_index > 5:
            logger.info(f"伏笔追踪提醒：当前有 {len(open_foreshadows)} 个未回收伏笔")
            issues.append({
                "type": "too_many_open_foreshadows",
                "issue_type": "plot_progress",
                "severity": "low",
                "fix_strategy": "foreshadow_review",
                "fix_instruction": f"当前有 {len(open_foreshadows)} 个未回收伏笔，建议在后续章节逐步回收",
            })

        logger.info(f"第 {chapter_index} 章状态校验完成，发现 {len(issues)} 个问题")
        return len(issues) == 0, issues

    @staticmethod
    def _get_name_context(content: str, name: str) -> str:
        """提取名字出现的上下文窗口"""
        idx = content.find(name)
        if idx < 0:
            return ""
        start = max(0, idx - 20)
        end = min(len(content), idx + 20)
        return content[start:end]
