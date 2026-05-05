from __future__ import annotations

import re
from typing import Any, Mapping

from .word_count_policy import WordCountPolicy


DEFAULT_BEAT_WEIGHTS = {
    "opening": 0.18,
    "progression": 0.32,
    "conflict": 0.34,
    "hook": 0.16,
}


def _coerce_text(value: Any, default: str = "") -> str:
    text = str(value or "").strip()
    return text if text else default


def _extract_outline_field(outline: str, field: str) -> str:
    pattern = rf"{field}\s*[：:]\s*([^\n]+)"
    match = re.search(pattern, outline)
    return match.group(1).strip() if match else ""


def _allocate_budgets(count: int, target_word_count: int, weights: list[float] | None = None) -> list[int]:
    count = max(1, count)
    target = max(1, int(target_word_count or 1))
    if weights is None:
        weights = [1 / count] * count
    if len(weights) != count:
        weights = [1 / count] * count

    budgets = [max(1, round(target * weight)) for weight in weights]
    delta = target - sum(budgets)
    budgets[-1] += delta
    if budgets[-1] < 1:
        budgets[-1] = 1
        budgets[0] += target - sum(budgets)
    return budgets


def _anchor_has_specific_structure(anchor: Mapping[str, Any]) -> bool:
    return any(_coerce_text(anchor.get(key)) for key in ("conflict", "state_change", "hook_intent", "character_intent"))


def build_budgeted_scene_plan(
    *,
    chapter_index: int,
    chapter_outline: str,
    scene_anchors: list[Mapping[str, Any]],
    target_word_count: int,
    policy: WordCountPolicy,
) -> dict[str, Any]:
    min_word_count, max_word_count = policy.target_range(target_word_count)
    usable_anchors = [
        anchor for anchor in scene_anchors
        if isinstance(anchor, Mapping) and _anchor_has_specific_structure(anchor)
    ]

    if usable_anchors:
        budgets = _allocate_budgets(len(usable_anchors), target_word_count)
        beats = [
            {
                "beat_id": _coerce_text(anchor.get("scene_id"), f"scene-{index + 1}"),
                "goal": _coerce_text(anchor.get("goal"), "推进本章核心剧情目标"),
                "conflict": _coerce_text(anchor.get("conflict"), "围绕本章目标制造压力"),
                "character_intent": _coerce_text(anchor.get("character_intent"), "保持角色动机清晰"),
                "state_change": _coerce_text(anchor.get("state_change")),
                "hook_intent": _coerce_text(anchor.get("hook_intent")),
                "word_budget": budgets[index],
                "must_include": [
                    text for text in (
                        _coerce_text(anchor.get("goal")),
                        _coerce_text(anchor.get("conflict")),
                        _coerce_text(anchor.get("state_change")),
                        _coerce_text(anchor.get("hook_intent")),
                    )
                    if text
                ],
            }
            for index, anchor in enumerate(usable_anchors)
        ]
        source = "scene_anchors"
    else:
        goal = _extract_outline_field(chapter_outline, "本章目标") or chapter_outline[:240] or "推进本章核心剧情"
        conflict = _extract_outline_field(chapter_outline, "核心冲突") or "制造本章主要压力与阻碍"
        hook = _extract_outline_field(chapter_outline, "结尾钩子") or "以反常发现或未完成动作收束"
        weights = [
            DEFAULT_BEAT_WEIGHTS["opening"],
            DEFAULT_BEAT_WEIGHTS["progression"],
            DEFAULT_BEAT_WEIGHTS["conflict"],
            DEFAULT_BEAT_WEIGHTS["hook"],
        ]
        budgets = _allocate_budgets(4, target_word_count, weights)
        beats = [
            {
                "beat_id": "opening",
                "goal": "承接上一章状态并把主角推入本章场景",
                "conflict": "延续上一章压力，不凭空跳场",
                "character_intent": "交代主角此刻想解决的问题",
                "state_change": "",
                "hook_intent": "",
                "word_budget": budgets[0],
                "must_include": [goal],
            },
            {
                "beat_id": "progression",
                "goal": goal,
                "conflict": "让角色行动遇到具体阻力",
                "character_intent": "通过行动和对话体现动机",
                "state_change": "",
                "hook_intent": "",
                "word_budget": budgets[1],
                "must_include": [goal],
            },
            {
                "beat_id": "conflict",
                "goal": "把本章核心冲突推到最高点",
                "conflict": conflict,
                "character_intent": "让角色在压力下做出选择",
                "state_change": conflict,
                "hook_intent": "",
                "word_budget": budgets[2],
                "must_include": [conflict],
            },
            {
                "beat_id": "hook",
                "goal": "收束本章并制造下一章追问",
                "conflict": "用可感知的反常或危机收尾",
                "character_intent": "保留角色未完成动作",
                "state_change": "",
                "hook_intent": hook,
                "word_budget": budgets[3],
                "must_include": [hook],
            },
        ]
        source = "outline_fallback"

    return {
        "artifact_type": "budgeted_scene_plan",
        "chapter_index": int(chapter_index),
        "target_word_count": int(target_word_count),
        "min_word_count": min_word_count,
        "max_word_count": max_word_count,
        "source": source,
        "beats": beats,
    }


def format_budgeted_scene_plan_for_prompt(plan: Mapping[str, Any]) -> str:
    if not isinstance(plan, Mapping):
        return ""
    lines = [
        "【Budgeted Scene Plan / 本章字数预算】",
        f"目标字数：{plan.get('target_word_count')} 字",
        f"目标区间：{plan.get('min_word_count')}-{plan.get('max_word_count')} 字",
        "写作原则：按以下拍点连续写成完整章节，不要拆成小作文；不得为凑字数新增主线外事件。",
    ]
    beats = plan.get("beats") or []
    for beat in beats:
        if not isinstance(beat, Mapping):
            continue
        must_include = "；".join(str(item) for item in beat.get("must_include", []) if item)
        lines.append(
            "- {beat_id}（约{budget}字）：目标={goal}；冲突={conflict}；状态变化={state_change}；钩子={hook}；必须包含={must_include}".format(
                beat_id=_coerce_text(beat.get("beat_id"), "beat"),
                budget=beat.get("word_budget", ""),
                goal=_coerce_text(beat.get("goal")),
                conflict=_coerce_text(beat.get("conflict")),
                state_change=_coerce_text(beat.get("state_change"), "无"),
                hook=_coerce_text(beat.get("hook_intent"), "无"),
                must_include=must_include or "按大纲推进",
            )
        )
    return "\n".join(lines)
