"""Extract structured writing experiences from Critic/Guardian/User feedback signals.

Uses the existing LLM pipeline (call_volc_api) to analyze failed chapters
and distill reusable lessons for future chapter generation.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from backend.core.config import settings
from backend.utils.json_utils import parse_json_result
from backend.utils.volc_engine import call_volc_api
from backend.utils.logger import logger


@dataclass
class WritingExperience:
    """A structured, reusable writing lesson extracted from feedback signals."""

    problem_type: str
    description: str
    root_cause: str
    suggestion: str
    evidence: str = ""
    related_characters: list[str] = field(default_factory=list)
    confidence: float = 0.0
    source_chapters: list[int] = field(default_factory=list)


class ExperienceExtractor:
    """Analyze feedback signals and extract reusable writing experiences.

    Usage:
        extractor = ExperienceExtractor()
        experiences = extractor.extract(
            chapter_index=3,
            critique_report={"score": 6, "issues": [...]},
            guardrail_results={"warnings": [...], "violations": [...]},
            user_feedback="角色的对话太白，不像本人",
            chapter_outline="第3章大纲",
        )
    """

    AGENT_ROLE = "experience_extractor"

    # Severity threshold: only process chapters with at least one medium+ signal
    MIN_SIGNAL_SEVERITY = "medium"

    def extract(
        self,
        chapter_index: int,
        critique_report: dict | None = None,
        guardrail_results: Any = None,
        user_feedback: str | None = None,
        chapter_outline: str = "",
    ) -> list[WritingExperience]:
        """Analyze a single chapter's feedback and extract experiences.

        Skips extraction if signals are too weak (no medium+ signals).
        Returns an empty list if the LLM found no reusable experiences.
        """
        # Prepare input for the LLM prompt
        critique_text = self._format_critique(critique_report)
        guardrail_text = self._format_guardrail(guardrail_results)
        feedback_text = user_feedback or "无"

        # Build context for prompt substitution
        prompt_context = {
            "chapter_index": str(chapter_index),
            "critique_report": critique_text,
            "guardrail_results": guardrail_text,
            "user_feedback": feedback_text,
            "chapter_outline": chapter_outline or "无",
        }

        try:
            raw_output = call_volc_api(
                agent_role=self.AGENT_ROLE,
                user_input="请分析以上章节的评审报告、检查结果和用户反馈，提取可复用的写作经验。",
                temperature=0.3,  # Low temperature for analytical consistency
                context=prompt_context,
                content_type=None,
            )
        except Exception as e:
            logger.warning(f"经验提取LLM调用失败（第{chapter_index}章）: {e}")
            return []

        experiences = self._parse_output(raw_output, chapter_index)
        logger.info(
            f"经验提取完成（第{chapter_index}章）: "
            f"提取到 {len(experiences)} 条经验"
        )
        return experiences

    # ------------------------------------------------------------------
    # Input formatters
    # ------------------------------------------------------------------

    def _format_critique(self, report: dict | None) -> str:
        if not report:
            return "无"
        parts: list[str] = []
        score = report.get("score") or report.get("overall_score")
        if score is not None:
            parts.append(f"综合评分: {score}/10")

        dimensions = report.get("dimensions", report.get("dimension_scores", {}))
        if isinstance(dimensions, dict) and dimensions:
            parts.append("维度评分:")
            for dim, score_val in dimensions.items():
                parts.append(f"  - {dim}: {score_val}/10")

        issues = report.get("issues", [])
        if isinstance(issues, list) and issues:
            parts.append(f"\n发现 {len(issues)} 个问题:")
            for i, issue in enumerate(issues[:10], 1):
                issue_type = issue.get("type") or issue.get("issue_type") or "未知"
                severity = issue.get("severity", "medium")
                desc = issue.get("fix_instruction") or issue.get("fix") or ""
                if desc:
                    parts.append(f"  {i}. [{severity}] {issue_type}: {desc}")
                else:
                    parts.append(f"  {i}. [{severity}] {issue_type}")

        return "\n".join(parts) if parts else "无"

    def _format_guardrail(self, guardrail_result: Any) -> str:
        if guardrail_result is None:
            return "无"

        parts: list[str] = []
        warnings = getattr(guardrail_result, "warnings", []) or []
        violations = getattr(guardrail_result, "violations", []) or []

        if isinstance(warnings, list):
            for w in warnings:
                if isinstance(w, str):
                    parts.append(f"  - [警告] {w}")
                elif isinstance(w, dict):
                    parts.append(f"  - [警告] {w.get('message', str(w))}")

        if isinstance(violations, list):
            for v in violations:
                if isinstance(v, dict):
                    parts.append(f"  - [违规] {v.get('message', str(v))}")

        # Also accept dict format
        if isinstance(guardrail_result, dict):
            for key in ("warnings", "violations"):
                for item in guardrail_result.get(key, []):
                    parts.append(f"  - [{key}] {item.get('message', str(item)) if isinstance(item, dict) else item}")

        return "\n".join(parts) if parts else "无"

    # ------------------------------------------------------------------
    # Output parser
    # ------------------------------------------------------------------

    def _parse_output(self, raw_output: str, chapter_index: int) -> list[WritingExperience]:
        try:
            data = parse_json_result(raw_output)
        except Exception as e:
            logger.warning(f"经验提取输出解析失败: {e}")
            return []

        if not isinstance(data, dict):
            return []

        raw_experiences = data.get("experiences", [])
        if not isinstance(raw_experiences, list):
            return []

        experiences: list[WritingExperience] = []
        for raw in raw_experiences:
            if not isinstance(raw, dict):
                continue
            try:
                exp = WritingExperience(
                    problem_type=raw.get("problem_type", "other"),
                    description=raw.get("description", ""),
                    root_cause=raw.get("root_cause", ""),
                    suggestion=raw.get("suggestion", ""),
                    evidence=raw.get("evidence", "")[:500],
                    related_characters=raw.get("related_characters", []),
                    confidence=min(max(float(raw.get("confidence", 0.0)), 0.0), 1.0),
                    source_chapters=[chapter_index],
                )
                experiences.append(exp)
            except (ValueError, TypeError) as e:
                logger.debug(f"跳过无效经验条目: {e}")

        return experiences
