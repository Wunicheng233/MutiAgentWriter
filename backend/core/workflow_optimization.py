"""Quality-first workflow helpers for chapter-level novel generation.

The public functions in this module are intentionally deterministic. LLM-facing
agents can fail or drift, while the orchestration layer still needs stable
fallbacks for scene anchors, structured critique, local patches, and stitching
boundaries.
"""

from __future__ import annotations

import json
import re
from typing import Any, Mapping


CRITIC_V2_DIMENSIONS = (
    "plot_progress",
    "character_consistency",
    "style_match",
    "worldview_conflict",
    "redundancy",
    "hook_strength",
    "rhythm_continuity",
)


_REPAIR_STRATEGY_BY_TYPE = {
    "plot_progress": "scene_goal_rewrite",
    "character_consistency": "character_intent_repair",
    "style_match": "style_repair",
    "worldview_conflict": "state_consistency_repair",
    "redundancy": "compression_tension_rewrite",
    "hook_strength": "hook_rewrite",
    "rhythm_continuity": "rhythm_continuity_repair",
    "大纲偏离": "scene_goal_rewrite",
    "剧情问题": "scene_goal_rewrite",
    "人设崩塌": "character_intent_repair",
    "文风问题": "style_repair",
    "套话过多": "style_repair",
    "时代错位": "state_consistency_repair",
    "设定问题": "state_consistency_repair",
    "格式问题": "format_repair",
    "结尾乏力": "hook_rewrite",
    "结构问题": "hook_rewrite",
    "逻辑断层": "rhythm_continuity_repair",
    "情绪生硬": "rhythm_continuity_repair",
    "字数不足": "expansion_repair",
    "字数超标": "compression_tension_rewrite",
    "word_count_under_target": "expansion_repair",
    "word_count_over_target": "compression_tension_rewrite",
}


def _coerce_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _extract_json_candidates(text: str) -> list[Any]:
    candidates: list[Any] = []
    for match in re.finditer(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE):
        block = match.group(1).strip()
        try:
            candidates.append(json.loads(block))
        except json.JSONDecodeError:
            continue

    for match in re.finditer(r"(\{[\s\S]*?scene_anchors[\s\S]*?\})", text):
        block = match.group(1).strip()
        try:
            candidates.append(json.loads(block))
        except json.JSONDecodeError:
            continue

    stripped = text.strip()
    if stripped.startswith(("{", "[")):
        try:
            candidates.append(json.loads(stripped))
        except json.JSONDecodeError:
            pass
    return candidates


def _normalize_anchor(raw_anchor: Any, index: int, default_word_count: int | None = None) -> dict[str, Any]:
    if not isinstance(raw_anchor, Mapping):
        raw_anchor = {"goal": _coerce_text(raw_anchor)}

    anchor = {
        "scene_id": _coerce_text(
            raw_anchor.get("scene_id") or raw_anchor.get("id"),
            f"scene-{index}",
        ),
        "goal": _coerce_text(
            raw_anchor.get("goal") or raw_anchor.get("scene_goal") or raw_anchor.get("target"),
            "推进本章核心剧情目标",
        ),
        "conflict": _coerce_text(raw_anchor.get("conflict")),
        "character_intent": _coerce_text(
            raw_anchor.get("character_intent") or raw_anchor.get("motivation")
        ),
        "state_change": _coerce_text(raw_anchor.get("state_change") or raw_anchor.get("state_delta")),
        "hook_intent": _coerce_text(raw_anchor.get("hook_intent") or raw_anchor.get("hook")),
        "location": _coerce_text(raw_anchor.get("location")),
        "time_anchor": _coerce_text(raw_anchor.get("time_anchor") or raw_anchor.get("time")),
    }
    if default_word_count:
        anchor["target_word_count"] = int(default_word_count)
    elif raw_anchor.get("target_word_count"):
        try:
            anchor["target_word_count"] = int(raw_anchor["target_word_count"])
        except (TypeError, ValueError):
            pass
    return anchor


def parse_scene_anchors_from_outline(
    chapter_outline: str,
    default_word_count: int | None = None,
) -> list[dict[str, Any]]:
    """Parse planner scene anchors, falling back to one chapter-level anchor.

    Scene anchors are route markers for a continuous chapter draft, not separate
    generation tasks. A missing or invalid anchor payload must never block the
    older chapter-level flow.
    """
    outline_text = _coerce_text(chapter_outline, "本章按章节大纲推进")
    raw_anchors: list[Any] = []

    for candidate in _extract_json_candidates(outline_text):
        if isinstance(candidate, Mapping):
            candidate_anchors = candidate.get("scene_anchors") or candidate.get("anchors") or []
        elif isinstance(candidate, list):
            candidate_anchors = candidate
        else:
            candidate_anchors = []
        if isinstance(candidate_anchors, list) and candidate_anchors:
            raw_anchors = candidate_anchors
            break

    if not raw_anchors:
        goal = re.sub(r"```[\s\S]*?```", "", outline_text).strip()
        goal = re.sub(r"\bscene_anchors\s*:\s*\[\s*\]", "", goal, flags=re.IGNORECASE).strip()
        return [
            _normalize_anchor(
                {
                    "scene_id": "scene-1",
                    "goal": goal[:500] or "完成本章核心剧情目标",
                },
                1,
                default_word_count=default_word_count,
            )
        ]

    return [
        _normalize_anchor(raw_anchor, index + 1, default_word_count=default_word_count)
        for index, raw_anchor in enumerate(raw_anchors)
    ]


def extract_scene_anchor_blocks_by_chapter(text: str) -> dict[int, dict[str, Any]]:
    """Extract fenced scene-anchor JSON blocks keyed by chapter number."""
    blocks: dict[int, dict[str, Any]] = {}
    for match in re.finditer(r"```(?:json)?\s*([\s\S]*?scene_anchors[\s\S]*?)\s*```", text, re.IGNORECASE):
        block = match.group(1).strip()
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, Mapping) or not isinstance(data.get("scene_anchors"), list):
            continue

        chapter_num = data.get("chapter") or data.get("chapter_num")
        if chapter_num is None:
            prefix = text[:match.start()]
            chapter_matches = list(re.finditer(r"第\s*(\d+)\s*章", prefix))
            if chapter_matches:
                chapter_num = chapter_matches[-1].group(1)
        try:
            chapter_index = int(chapter_num)
        except (TypeError, ValueError):
            continue
        blocks[chapter_index] = dict(data)
    return blocks


def format_scene_anchors_for_prompt(scene_anchors: list[Mapping[str, Any]]) -> str:
    """Render anchors as concise prompt text for Writer."""
    if not scene_anchors:
        return "（无结构化 scene anchors，按本章大纲连续推进）"
    lines = ["【本章 scene anchors：仅作为连续写作的内部路标，不得拆成独立小作文】"]
    for anchor in scene_anchors:
        lines.append(
            "- {scene_id}: 目标={goal}; 冲突={conflict}; 角色动机={character_intent}; "
            "状态变化={state_change}; 结尾钩子={hook_intent}".format(
                scene_id=_coerce_text(anchor.get("scene_id"), "scene"),
                goal=_coerce_text(anchor.get("goal"), "推进剧情"),
                conflict=_coerce_text(anchor.get("conflict"), "按大纲制造冲突"),
                character_intent=_coerce_text(anchor.get("character_intent"), "保持人物动机清晰"),
                state_change=_coerce_text(anchor.get("state_change"), "记录本章动态变化"),
                hook_intent=_coerce_text(anchor.get("hook_intent"), "保留章节钩子"),
            )
        )
    return "\n".join(lines)


def route_repair_strategy(issue: Mapping[str, Any] | str) -> str:
    """Choose a bounded repair strategy from critic or guardrail issue metadata."""
    if isinstance(issue, Mapping):
        explicit_strategy = _coerce_text(issue.get("fix_strategy"))
        if explicit_strategy:
            return explicit_strategy
        issue_type = _coerce_text(issue.get("issue_type") or issue.get("type"))
    else:
        issue_type = _coerce_text(issue)
    return _REPAIR_STRATEGY_BY_TYPE.get(issue_type, "local_rewrite")


def _normalize_evidence_span(raw_span: Any, fallback: str = "") -> dict[str, Any]:
    if isinstance(raw_span, Mapping):
        quote = _coerce_text(
            raw_span.get("quote")
            or raw_span.get("text")
            or raw_span.get("content")
            or raw_span.get("span"),
            fallback,
        )
        evidence = {"quote": quote}
        if raw_span.get("start") is not None:
            evidence["start"] = raw_span.get("start")
        if raw_span.get("end") is not None:
            evidence["end"] = raw_span.get("end")
        return evidence
    return {"quote": _coerce_text(raw_span, fallback)}


def _normalize_critic_issue(raw_issue: Any, issue_type: str) -> dict[str, Any]:
    if not isinstance(raw_issue, Mapping):
        raw_issue = {"evidence_span": raw_issue}

    issue = {
        "issue_type": _coerce_text(raw_issue.get("issue_type") or raw_issue.get("type"), issue_type),
        "scene_id": _coerce_text(raw_issue.get("scene_id"), "chapter"),
        "location": _coerce_text(raw_issue.get("location"), "全文"),
        "severity": _coerce_text(raw_issue.get("severity"), "medium"),
        "evidence_span": _normalize_evidence_span(
            raw_issue.get("evidence_span") or raw_issue.get("evidence") or raw_issue.get("location"),
            fallback=_coerce_text(raw_issue.get("location")),
        ),
        "fix_strategy": _coerce_text(raw_issue.get("fix_strategy")),
        "fix_instruction": _coerce_text(
            raw_issue.get("fix_instruction") or raw_issue.get("fix") or raw_issue.get("suggestion")
        ),
    }
    if not issue["fix_strategy"]:
        issue["fix_strategy"] = route_repair_strategy(issue)
    if not issue["location"] or issue["location"] == "全文":
        quote = issue["evidence_span"].get("quote")
        if quote:
            issue["location"] = quote[:40]
    return issue


def normalize_critic_v2_payload(
    raw_payload: Any,
    legacy_issues: list[Any] | None = None,
) -> dict[str, Any]:
    """Normalize Critic v2 diagnostics into a stable artifact schema."""
    diagnostics: dict[str, list[dict[str, Any]]] = {field: [] for field in CRITIC_V2_DIMENSIONS}
    normalized_issues: list[dict[str, Any]] = []

    payload = raw_payload if isinstance(raw_payload, Mapping) else {}
    raw_diagnostics = payload.get("diagnostics") if isinstance(payload.get("diagnostics"), Mapping) else payload

    for field in CRITIC_V2_DIMENSIONS:
        field_items = raw_diagnostics.get(field, []) if isinstance(raw_diagnostics, Mapping) else []
        if isinstance(field_items, Mapping):
            field_items = [field_items]
        if not isinstance(field_items, list):
            field_items = [field_items]
        for item in field_items:
            normalized = _normalize_critic_issue(item, field)
            diagnostics[field].append(normalized)
            normalized_issues.append(normalized)

    extra_issues = payload.get("issues", []) if isinstance(payload.get("issues"), list) else []
    if legacy_issues:
        extra_issues = list(extra_issues) + list(legacy_issues)

    for item in extra_issues:
        if not isinstance(item, Mapping):
            normalized = _normalize_critic_issue(item, "plot_progress")
        else:
            issue_type = _coerce_text(item.get("issue_type") or item.get("type"), "plot_progress")
            normalized = _normalize_critic_issue(item, issue_type)
        identity = (
            normalized["issue_type"],
            normalized["scene_id"],
            normalized["evidence_span"].get("quote"),
            normalized["fix_instruction"],
        )
        if not any(
            (
                issue["issue_type"],
                issue["scene_id"],
                issue["evidence_span"].get("quote"),
                issue["fix_instruction"],
            )
            == identity
            for issue in normalized_issues
        ):
            normalized_issues.append(normalized)
            diagnostics.setdefault(normalized["issue_type"], []).append(normalized)

    return {
        "schema_version": "chapter_critique_v2",
        "diagnostics": diagnostics,
        "issues": normalized_issues,
    }


def _paragraph_spans(content: str) -> list[tuple[int, int, str]]:
    spans: list[tuple[int, int, str]] = []
    offset = 0
    for paragraph in re.split(r"\n\s*\n", content):
        index = content.find(paragraph, offset)
        if index < 0:
            continue
        end = index + len(paragraph)
        if paragraph.strip():
            spans.append((index, end, paragraph.strip()))
        offset = end
    return spans


def _find_target_paragraph_index(spans: list[tuple[int, int, str]], evidence_quote: str) -> int:
    quote = _coerce_text(evidence_quote)
    if not spans:
        return -1
    if quote:
        for index, (_, _, paragraph) in enumerate(spans):
            if quote in paragraph or paragraph in quote:
                return index
    return 0


def build_local_repair_context(chapter_content: str, evidence_quote: str) -> dict[str, Any]:
    """Return target paragraph plus previous/next adjacency context."""
    spans = _paragraph_spans(chapter_content)
    target_index = _find_target_paragraph_index(spans, evidence_quote)
    if target_index < 0:
        return {
            "previous": "",
            "target": "",
            "next": "",
            "target_start": -1,
            "target_end": -1,
            "evidence_quote": evidence_quote,
        }

    previous = spans[target_index - 1][2] if target_index > 0 else ""
    target_start, target_end, target = spans[target_index]
    next_text = spans[target_index + 1][2] if target_index + 1 < len(spans) else ""
    return {
        "previous": previous,
        "target": target,
        "next": next_text,
        "target_start": target_start,
        "target_end": target_end,
        "evidence_quote": evidence_quote,
    }


def apply_local_patch(chapter_content: str, patch: Mapping[str, Any]) -> tuple[str, bool]:
    """Apply a local replacement while preserving all non-target chapter text."""
    target_text = _coerce_text(patch.get("target_text"))
    replacement_text = _coerce_text(patch.get("replacement_text"))
    bridge_sentence = _coerce_text(patch.get("bridge_sentence"))
    if not target_text or not replacement_text:
        return chapter_content, False

    if bridge_sentence:
        replacement_text = f"{bridge_sentence}\n\n{replacement_text}"

    index = chapter_content.find(target_text)
    if index < 0:
        stripped_target = target_text.strip()
        index = chapter_content.find(stripped_target)
        target_text = stripped_target
    if index < 0:
        return chapter_content, False

    patched = chapter_content[:index] + replacement_text + chapter_content[index + len(target_text):]
    return patched, True


def build_stitching_context(chapter_content: str, evidence_quote: str) -> dict[str, Any]:
    """Build a restricted previous/target/next window for transition repair."""
    spans = _paragraph_spans(chapter_content)
    target_index = _find_target_paragraph_index(spans, evidence_quote)
    if target_index < 0:
        return {
            "prefix": "",
            "window_text": chapter_content,
            "suffix": "",
            "window_start": 0,
            "window_end": len(chapter_content),
            "target_index": -1,
        }

    window_first = max(0, target_index - 1)
    window_last = min(len(spans) - 1, target_index + 1)
    window_start = spans[window_first][0]
    window_end = spans[window_last][1]
    return {
        "prefix": chapter_content[:window_start],
        "window_text": chapter_content[window_start:window_end],
        "suffix": chapter_content[window_end:],
        "window_start": window_start,
        "window_end": window_end,
        "target_index": target_index,
        "evidence_quote": evidence_quote,
    }


def apply_stitching_patch(
    chapter_content: str,
    stitching_context: Mapping[str, Any],
    stitched_window_text: str,
) -> tuple[str, bool]:
    """Replace only the bounded stitching window and preserve the rest."""
    prefix = str(stitching_context.get("prefix", ""))
    suffix = str(stitching_context.get("suffix", ""))
    window_text = str(stitching_context.get("window_text", ""))
    replacement = _coerce_text(stitched_window_text)
    if not replacement:
        return chapter_content, False

    expected = prefix + window_text + suffix
    if expected != chapter_content:
        start = int(stitching_context.get("window_start", -1))
        end = int(stitching_context.get("window_end", -1))
        if start < 0 or end < start:
            return chapter_content, False
        prefix = chapter_content[:start]
        suffix = chapter_content[end:]

    return prefix + replacement + suffix, True
