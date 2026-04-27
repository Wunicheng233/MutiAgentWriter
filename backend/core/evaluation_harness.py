"""
Evaluation harness v1 for chapter-level quality checks.

The current production flow still uses the legacy Critic agent tuple:
    (passed, score, dimensions, issues)

This module is the narrow compatibility layer that turns that tuple into a
stable, serializable report. Future offline evals, A/B tests, and prompt
regression suites should build on this boundary instead of calling Critic
directly from orchestration code.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Mapping

from .workflow_optimization import normalize_critic_v2_payload


DEFAULT_DIMENSIONS: dict[str, float] = {
    "plot": 5.0,
    "character": 5.0,
    "hook": 5.0,
    "writing": 5.0,
    "setting": 5.0,
}


def _clamp_score(value: Any, default: float = 5.0) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        score = default
    return max(1.0, min(10.0, score))


@dataclass(frozen=True)
class EvaluationIssue:
    issue_type: str
    location: str
    fix: str
    source: str = "critic"
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_raw(cls, raw_issue: Any, source: str = "critic") -> "EvaluationIssue":
        if not isinstance(raw_issue, Mapping):
            return cls(
                issue_type="未知问题",
                location="全文",
                fix=str(raw_issue),
                source=source,
            )

        metadata = {
            key: value
            for key, value in raw_issue.items()
            if key not in {"type", "issue_type", "location", "fix", "source"}
        }
        return cls(
            issue_type=str(raw_issue.get("type") or raw_issue.get("issue_type") or "未知问题"),
            location=str(raw_issue.get("location") or "全文"),
            fix=str(raw_issue.get("fix") or raw_issue.get("suggestion") or ""),
            source=str(raw_issue.get("source") or source),
            metadata=metadata,
        )

    def to_dict(self) -> dict[str, Any]:
        payload = {
            "type": self.issue_type,
            "location": self.location,
            "fix": self.fix,
            "source": self.source,
        }
        if self.metadata:
            payload["metadata"] = self.metadata
        return payload

    def to_legacy_dict(self) -> dict[str, Any]:
        payload = {
            "type": self.issue_type,
            "location": self.location,
            "fix": self.fix,
        }
        payload.update(self.metadata)
        return payload


@dataclass(frozen=True)
class ChapterEvaluationReport:
    chapter_index: int
    passed: bool
    score: float
    dimensions: dict[str, float]
    issues: list[EvaluationIssue]
    evaluator_agent: str = "critic"
    content_type: str = "novel"
    revision_round: int = 0
    harness_version: str = "chapter-evaluation-v1"
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "harness_version": self.harness_version,
            "chapter_index": self.chapter_index,
            "passed": self.passed,
            "score": self.score,
            "dimensions": self.dimensions,
            "issues": [issue.to_dict() for issue in self.issues],
            "evaluator_agent": self.evaluator_agent,
            "content_type": self.content_type,
            "revision_round": self.revision_round,
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata,
        }

    def as_legacy_tuple(self) -> tuple[bool, float, dict[str, float], list[dict[str, Any]]]:
        return (
            self.passed,
            self.score,
            self.dimensions,
            [issue.to_legacy_dict() for issue in self.issues],
        )


def normalize_dimensions(raw_dimensions: Mapping[str, Any] | None) -> dict[str, float]:
    dimensions = dict(DEFAULT_DIMENSIONS)
    for key, value in (raw_dimensions or {}).items():
        if key in dimensions:
            dimensions[key] = _clamp_score(value)
    return dimensions


def build_chapter_evaluation_report(
    chapter_index: int,
    passed: Any,
    score: Any,
    dimensions: Mapping[str, Any] | None,
    issues: list[Any] | None,
    content_type: str = "novel",
    revision_round: int = 0,
    evaluator_agent: str = "critic",
    metadata: dict[str, Any] | None = None,
    harness_version: str = "chapter-evaluation-v1",
) -> ChapterEvaluationReport:
    normalized_issues = [
        EvaluationIssue.from_raw(issue, source=evaluator_agent)
        for issue in (issues or [])
    ]
    normalized_score = _clamp_score(score)
    return ChapterEvaluationReport(
        chapter_index=chapter_index,
        passed=bool(passed) and normalized_score >= 1.0,
        score=normalized_score,
        dimensions=normalize_dimensions(dimensions),
        issues=normalized_issues,
        evaluator_agent=evaluator_agent,
        content_type=content_type,
        revision_round=max(0, int(revision_round or 0)),
        harness_version=harness_version,
        metadata=metadata or {},
    )


def evaluate_chapter_with_critic(
    critic: Any,
    chapter_content: str,
    setting_bible: str,
    chapter_outline: str,
    content_type: str,
    chapter_index: int,
    revision_round: int = 0,
    perspective: str = None,
    perspective_strength: float = 0.7,
    scene_anchors_context: str = "",
    novel_state_snapshot: str = "",
) -> ChapterEvaluationReport:
    # Build kwargs dict for compatibility with both old and new Critic interfaces
    critic_kwargs = {
        "perspective": perspective,
        "perspective_strength": perspective_strength,
    }
    # Only add new args if they have values or method supports them
    import inspect
    sig = inspect.signature(critic.critic_chapter)
    if "scene_anchors_context" in sig.parameters:
        critic_kwargs["scene_anchors_context"] = scene_anchors_context
    if "novel_state_snapshot" in sig.parameters:
        critic_kwargs["novel_state_snapshot"] = novel_state_snapshot

    critic_result = critic.critic_chapter(
        chapter_content,
        setting_bible,
        chapter_outline,
        content_type,
        **critic_kwargs,
    )
    if not isinstance(critic_result, tuple):
        raise TypeError("Critic must return a tuple")

    metadata: dict[str, Any] = {}
    harness_version = "chapter-evaluation-v1"
    if len(critic_result) >= 5:
        passed, score, dimensions, issues, critique_v2 = critic_result[:5]
        normalized_v2 = normalize_critic_v2_payload(critique_v2, legacy_issues=issues)
        metadata["critique_v2"] = normalized_v2
        harness_version = "chapter-evaluation-v2"
        if not issues:
            issues = normalized_v2["issues"]
    else:
        passed, score, dimensions, issues = critic_result[:4]

    return build_chapter_evaluation_report(
        chapter_index=chapter_index,
        passed=passed,
        score=score,
        dimensions=dimensions,
        issues=issues,
        content_type=content_type,
        revision_round=revision_round,
        evaluator_agent="critic",
        metadata=metadata,
        harness_version=harness_version,
    )
