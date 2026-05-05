from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any, Mapping


DEFAULT_MIN_RATIO = 0.85
DEFAULT_MAX_RATIO = 1.20


def _strip_chapter_title(content: str) -> str:
    lines = str(content or "").splitlines()
    if lines and re.search(r"第\s*[一二三四五六七八九十百千万\d]+\s*章", lines[0]):
        return "\n".join(lines[1:]).strip()
    return str(content or "").strip()


def count_story_words(content: str) -> int:
    """Count story body length in the same spirit as chapter sync.

    Chinese projects are the primary path, so Chinese characters are counted
    after dropping the generated chapter title. For non-Chinese text, fall back
    to non-whitespace characters instead of returning zero.
    """
    body = _strip_chapter_title(content)
    chinese_chars = re.findall(r"[\u4e00-\u9fff]", body)
    if chinese_chars:
        return len(chinese_chars)
    return len(re.sub(r"\s+", "", body))


@dataclass(frozen=True)
class WordCountEvaluation:
    target_word_count: int
    actual_word_count: int
    min_word_count: int
    max_word_count: int
    deviation: float
    passed: bool
    status: str
    message: str


@dataclass(frozen=True)
class WordCountPolicy:
    min_ratio: float = DEFAULT_MIN_RATIO
    max_ratio: float = DEFAULT_MAX_RATIO

    @classmethod
    def from_config(cls, config: Mapping[str, Any] | None) -> "WordCountPolicy":
        config = dict(config or {})
        policy_config = config.get("word_count_policy") if "word_count_policy" in config else config
        if not isinstance(policy_config, Mapping):
            policy_config = {}

        def _ratio(key: str, default: float) -> float:
            try:
                value = float(policy_config.get(key, default))
            except (TypeError, ValueError):
                return default
            return value if value > 0 else default

        if "min_ratio" not in policy_config and "max_ratio" not in policy_config and "tolerance" in policy_config:
            try:
                tolerance = float(policy_config.get("tolerance"))
            except (TypeError, ValueError):
                tolerance = None
            if tolerance is not None and tolerance > 0:
                min_ratio = max(0.01, 1 - tolerance)
                max_ratio = 1 + tolerance
            else:
                min_ratio = DEFAULT_MIN_RATIO
                max_ratio = DEFAULT_MAX_RATIO
        else:
            min_ratio = _ratio("min_ratio", DEFAULT_MIN_RATIO)
            max_ratio = _ratio("max_ratio", DEFAULT_MAX_RATIO)
        if max_ratio < min_ratio:
            min_ratio, max_ratio = DEFAULT_MIN_RATIO, DEFAULT_MAX_RATIO
        return cls(min_ratio=min_ratio, max_ratio=max_ratio)

    def to_dict(self) -> dict[str, float]:
        return {
            "min_ratio": self.min_ratio,
            "max_ratio": self.max_ratio,
        }

    def target_range(self, target_word_count: int) -> tuple[int, int]:
        safe_target = max(1, int(target_word_count or 1))
        return (
            max(1, math.ceil(safe_target * self.min_ratio)),
            max(1, math.floor(safe_target * self.max_ratio)),
        )

    def evaluate(self, content: str, target_word_count: int) -> WordCountEvaluation:
        safe_target = max(1, int(target_word_count or 1))
        actual = count_story_words(content)
        min_count, max_count = self.target_range(safe_target)
        deviation = (actual - safe_target) / safe_target
        if actual < min_count:
            status = "under"
            passed = False
            message = f"字数不足（目标{safe_target}，区间{min_count}-{max_count}，实际{actual}）"
        elif actual > max_count:
            status = "over"
            passed = False
            message = f"字数超标（目标{safe_target}，区间{min_count}-{max_count}，实际{actual}）"
        else:
            status = "ok"
            passed = True
            message = ""
        return WordCountEvaluation(
            target_word_count=safe_target,
            actual_word_count=actual,
            min_word_count=min_count,
            max_word_count=max_count,
            deviation=deviation,
            passed=passed,
            status=status,
            message=message,
        )

    def build_issue(
        self,
        evaluation: WordCountEvaluation,
        budgeted_scene_plan: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        if evaluation.status == "over":
            issue_type = "word_count_over_target"
            fix_strategy = "compression_tension_rewrite"
            fix_instruction = (
                f"本章实际 {evaluation.actual_word_count} 字，目标区间为 "
                f"{evaluation.min_word_count}-{evaluation.max_word_count} 字。"
                "请压缩重复解释、冗余心理和拖沓环境描写，保留关键情节、人物动机和结尾钩子。"
            )
        else:
            issue_type = "word_count_under_target"
            fix_strategy = "expansion_repair"
            fix_instruction = (
                f"本章实际 {evaluation.actual_word_count} 字，目标区间为 "
                f"{evaluation.min_word_count}-{evaluation.max_word_count} 字。"
                "请围绕已有大纲和预算拍点扩写场景压力、动作细节、心理反应、人物对话和氛围描写，"
                "不得新增新人物、新设定或主线外事件。"
            )

        issue = {
            "type": "字数不足" if evaluation.status != "over" else "字数超标",
            "issue_type": issue_type,
            "location": "全文",
            "evidence_span": {"quote": "全文"},
            "severity": "high",
            "fix_strategy": fix_strategy,
            "fix": fix_instruction,
            "fix_instruction": fix_instruction,
            "word_count": {
                "target": evaluation.target_word_count,
                "actual": evaluation.actual_word_count,
                "min": evaluation.min_word_count,
                "max": evaluation.max_word_count,
                "status": evaluation.status,
            },
        }
        summary = summarize_budgeted_scene_plan(budgeted_scene_plan)
        if summary:
            issue["budgeted_scene_plan_summary"] = summary
        return issue


def summarize_budgeted_scene_plan(plan: Mapping[str, Any] | None, *, max_beats: int = 6) -> str:
    if not isinstance(plan, Mapping):
        return ""
    beats = plan.get("beats")
    if not isinstance(beats, list):
        return ""
    lines: list[str] = []
    for beat in beats[:max_beats]:
        if not isinstance(beat, Mapping):
            continue
        beat_id = str(beat.get("beat_id") or "beat")
        goal = str(beat.get("goal") or "")
        budget = beat.get("word_budget")
        lines.append(f"{beat_id}: {goal}（约{budget}字）")
    return "\n".join(lines)
