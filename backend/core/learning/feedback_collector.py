"""Unified signal pipeline: collect feedback signals from Guardian / Critic / User.

Each signal is normalized to a standard FeedbackSignal dataclass so downstream
modules (ExperienceExtractor, SkillDistiller) can process them uniformly.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy.orm import Session

from backend.models import FeedbackItem


class SignalSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SignalSource(str, Enum):
    GUARDIAN = "guardian"
    CRITIC = "critic"
    USER = "user"
    SYSTEM = "system"


@dataclass
class FeedbackSignal:
    """A normalized, structured feedback signal ready for experience extraction."""

    source: SignalSource
    signal_type: str
    severity: SignalSeverity
    chapter_index: int
    description: str
    evidence: str = ""
    meta: dict[str, Any] = field(default_factory=dict)

    # Optional: set when a written feedback item exists in DB
    feedback_item_id: int | None = None

    @property
    def is_actionable(self) -> bool:
        """Signals with medium+ severity are worth extracting experience from."""
        order = {"low": 0, "medium": 1, "high": 2, "critical": 3}
        return order.get(self.severity.value, 0) >= 1


class FeedbackCollector:
    """Collect and normalize feedback signals from all sources.

    Usage:
        collector = FeedbackCollector()
        signals = collector.collect_from_critic(issues, dimensions)
        signals += collector.collect_from_guardian(guardrail_result)
        signals += collector.collect_from_db(db, project_id, chapter_index)
    """

    # ------------------------------------------------------------------
    # From Critic issues
    # ------------------------------------------------------------------

    SEVERITY_MAP = {
        "low": SignalSeverity.LOW,
        "medium": SignalSeverity.MEDIUM,
        "high": SignalSeverity.HIGH,
        "critical": SignalSeverity.CRITICAL,
    }

    TYPE_MAP: dict[str, str] = {
        "剧情问题": "plot_issue",
        "plot_hole": "plot_hole",
        "pacing_issue": "pacing_issue",
        "rhythm_continuity": "pacing_issue",
        "character_consistency": "character_inconsistency",
        "character_state_violation": "character_inconsistency",
        "人物": "character_inconsistency",
        "文风": "style_issue",
        "style_match": "style_issue",
        "冗余": "redundancy",
        "redundancy": "redundancy",
        "世界观": "worldview_conflict",
        "worldview_conflict": "worldview_conflict",
        "钩子": "hook_weakness",
        "hook_strength": "hook_weakness",
    }

    def collect_from_critic(
        self,
        issues: list[dict],
        dimension_scores: dict[str, float] | None = None,
        chapter_index: int = 0,
    ) -> list[FeedbackSignal]:
        """Convert Critic-format issues into normalized signals.

        Args:
            issues: List of issue dicts from Critic (each has 'type', 'severity', etc.)
            dimension_scores: Optional dict of dimension -> score (e.g. {"plot": 8, "character": 6})
            chapter_index: Chapter this critique belongs to
        """
        signals: list[FeedbackSignal] = []

        # Signals from dimensional scores (low-scoring dimensions trigger signals)
        if dimension_scores:
            low_dimensions = {
                dim: score for dim, score in dimension_scores.items()
                if isinstance(score, (int, float)) and score < 7.0
            }
            for dim, score in low_dimensions.items():
                signals.append(FeedbackSignal(
                    source=SignalSource.CRITIC,
                    signal_type=f"low_{dim}_score",
                    severity=SignalSeverity.HIGH if score < 5.0 else SignalSeverity.MEDIUM,
                    chapter_index=chapter_index,
                    description=f"{dim} 维度得分偏低 ({score}/10)",
                    evidence="",
                    meta={"dimension": dim, "score": score},
                ))

        # Signals from individual issues
        for issue in issues:
            if not isinstance(issue, dict):
                continue

            raw_type = issue.get("type") or issue.get("issue_type") or ""
            severity = issue.get("severity", "medium")
            description = issue.get("fix_instruction") or issue.get("fix") or issue.get("type", "")
            evidence = ""
            evidence_span = issue.get("evidence_span") or issue.get("location") or ""
            if isinstance(evidence_span, dict):
                evidence = evidence_span.get("quote") or evidence_span.get("text") or str(evidence_span)
            elif isinstance(evidence_span, str):
                evidence = evidence_span

            signal_type = self.TYPE_MAP.get(raw_type, raw_type)

            signals.append(FeedbackSignal(
                source=SignalSource.CRITIC,
                signal_type=signal_type,
                severity=self.SEVERITY_MAP.get(severity, SignalSeverity.MEDIUM),
                chapter_index=chapter_index,
                description=description,
                evidence=evidence[:500],
                meta={
                    "raw_type": raw_type,
                    "severity": severity,
                    "original_issue": issue,
                },
            ))

        return signals

    # ------------------------------------------------------------------
    # From Guardian (system guardrails)
    # ------------------------------------------------------------------

    def collect_from_guardian(
        self,
        guardrail_result: Any,
        chapter_index: int = 0,
    ) -> list[FeedbackSignal]:
        """Convert GuardrailResult into feedback signals.

        Args:
            guardrail_result: A GuardrailResult object (or anything with .warnings / .violations)
            chapter_index: Chapter this guardrail check belongs to
        """
        signals: list[FeedbackSignal] = []

        warnings = getattr(guardrail_result, "warnings", []) or []
        violations = getattr(guardrail_result, "violations", []) or []
        suggestions = getattr(guardrail_result, "suggestions", []) or []

        for warning in warnings:
            if isinstance(warning, str):
                signals.append(FeedbackSignal(
                    source=SignalSource.GUARDIAN,
                    signal_type="guardrail_warning",
                    severity=SignalSeverity.LOW,
                    chapter_index=chapter_index,
                    description=warning,
                    evidence="",
                ))
            elif isinstance(warning, dict):
                signals.append(FeedbackSignal(
                    source=SignalSource.GUARDIAN,
                    signal_type=warning.get("type", "guardrail_warning"),
                    severity=self.SEVERITY_MAP.get(warning.get("severity", "low"), SignalSeverity.LOW),
                    chapter_index=chapter_index,
                    description=warning.get("message", str(warning)),
                    evidence=warning.get("text", ""),
                    meta={"code": warning.get("code")},
                ))

        for violation in violations:
            if isinstance(violation, dict):
                signals.append(FeedbackSignal(
                    source=SignalSource.GUARDIAN,
                    signal_type=violation.get("type", "guardrail_violation"),
                    severity=SignalSeverity.HIGH,
                    chapter_index=chapter_index,
                    description=violation.get("message", str(violation)),
                    evidence=violation.get("text", ""),
                    meta={"code": violation.get("code")},
                ))

        for suggestion in suggestions:
            if isinstance(suggestion, str):
                signals.append(FeedbackSignal(
                    source=SignalSource.GUARDIAN,
                    signal_type="guardrail_suggestion",
                    severity=SignalSeverity.LOW,
                    chapter_index=chapter_index,
                    description=suggestion,
                ))

        return signals

    # ------------------------------------------------------------------
    # From database (User feedback items)
    # ------------------------------------------------------------------

    def collect_from_db(
        self,
        db: Session,
        project_id: int,
        chapter_index: int | None = None,
    ) -> list[FeedbackSignal]:
        """Load user feedback items from the database as signals.

        Args:
            db: SQLAlchemy session
            project_id: Project ID
            chapter_index: If set, only load feedback for this chapter
        """
        query = db.query(FeedbackItem).filter(
            FeedbackItem.project_id == project_id,
            FeedbackItem.status == "open",
        )
        if chapter_index is not None:
            query = query.filter(FeedbackItem.chapter_index == chapter_index)

        signals: list[FeedbackSignal] = []
        for item in query.order_by(FeedbackItem.id.desc()).all():
            signals.append(FeedbackSignal(
                source=SignalSource.USER,
                signal_type=f"user_{item.feedback_type}",
                severity=SignalSeverity.HIGH if item.feedback_type == "user_rejection" else SignalSeverity.MEDIUM,
                chapter_index=item.chapter_index or 0,
                description=item.content,
                evidence="",
                meta={
                    "feedback_scope": item.feedback_scope,
                    "action_type": item.action_type,
                    "feedback_type": item.feedback_type,
                },
                feedback_item_id=item.id,
            ))

        return signals

    # ------------------------------------------------------------------
    # Convenience: collect all signals for a chapter
    # ------------------------------------------------------------------

    def collect_all_for_chapter(
        self,
        db: Session,
        project_id: int,
        chapter_index: int,
        critic_issues: list[dict] | None = None,
        critic_dimensions: dict[str, float] | None = None,
        guardrail_result: Any = None,
    ) -> list[FeedbackSignal]:
        """Collect signals from all available sources for a single chapter.

        This is the main entry point used by the Celery extraction task.
        """
        signals: list[FeedbackSignal] = []

        # Critic signals (if provided at call time)
        if critic_issues is not None:
            signals.extend(self.collect_from_critic(
                critic_issues, critic_dimensions, chapter_index
            ))

        # Guardian signals (if provided at call time)
        if guardrail_result is not None:
            signals.extend(self.collect_from_guardian(guardrail_result, chapter_index))

        # User feedback (always loaded from DB)
        signals.extend(self.collect_from_db(db, project_id, chapter_index))

        return signals
