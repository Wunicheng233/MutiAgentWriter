"""Lightweight trace aggregation over existing Artifact / FeedbackItem / WorkflowStepRun models.

No new database tables. All data is already stored — this module provides query
helpers to assemble a unified "execution trace" per chapter.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from backend.models import Artifact, FeedbackItem


@dataclass
class ChapterTrace:
    """Aggregated execution trace for a single chapter."""

    chapter_index: int
    draft_text: str | None = None
    critique_v2: dict | None = None
    evaluation_report: dict | None = None
    repair_traces: list[dict] = field(default_factory=list)
    stitching_reports: list[dict] = field(default_factory=list)
    feedback_items: list[dict] = field(default_factory=list)
    state_snapshot: dict | None = None
    scene_anchor_plan: dict | None = None
    has_critique: bool = False
    has_feedback: bool = False
    has_repair: bool = False

    @property
    def score(self) -> float | None:
        """Extract overall score from evaluation report, if available."""
        if self.evaluation_report:
            return self.evaluation_report.get("score") or self.evaluation_report.get("overall_score")
        return None

    @property
    def passed(self) -> bool | None:
        if self.evaluation_report:
            return self.evaluation_report.get("passed")
        return None


class TraceAggregator:
    """Aggregate execution traces from existing Artifact and FeedbackItem records.

    Usage:
        aggregator = TraceAggregator(db)
        trace = aggregator.get_chapter_trace(project_id=1, chapter_index=3)
    """

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_chapter_trace(
        self,
        project_id: int,
        chapter_index: int,
        workflow_run_id: int | None = None,
    ) -> ChapterTrace:
        """Assemble a single chapter's full execution trace."""
        trace = ChapterTrace(chapter_index=chapter_index)

        # 1. Chapter draft
        draft_artifact = self._get_latest_artifact(
            project_id, "chapter_draft", "chapter", chapter_index, workflow_run_id
        )
        if draft_artifact:
            trace.draft_text = draft_artifact.content_text

        # 2. Critic v2 diagnostic
        critique_artifact = self._get_latest_artifact(
            project_id, "chapter_critique_v2", "chapter", chapter_index, workflow_run_id
        )
        if critique_artifact and critique_artifact.content_json:
            trace.critique_v2 = critique_artifact.content_json
            trace.has_critique = True

        # 3. Evaluation report
        eval_artifact = self._get_latest_artifact(
            project_id, "chapter_evaluation", "chapter", chapter_index, workflow_run_id
        )
        if eval_artifact and eval_artifact.content_json:
            trace.evaluation_report = eval_artifact.content_json

        # 4. Repair traces
        repair_artifacts = self._get_artifacts_by_type(
            project_id, "repair_trace", "chapter", chapter_index, workflow_run_id
        )
        for art in repair_artifacts:
            if art.content_json:
                trace.repair_traces.append(art.content_json)
        trace.has_repair = len(trace.repair_traces) > 0

        # 5. Stitching reports
        stitch_artifacts = self._get_artifacts_by_type(
            project_id, "stitching_report", "chapter", chapter_index, workflow_run_id
        )
        for art in stitch_artifacts:
            if art.content_json:
                trace.stitching_reports.append(art.content_json)

        # 6. Novel state snapshot
        snapshot_artifact = self._get_latest_artifact(
            project_id, "novel_state_snapshot", "chapter", chapter_index, workflow_run_id
        )
        if snapshot_artifact and snapshot_artifact.content_json:
            trace.state_snapshot = snapshot_artifact.content_json

        # 7. Scene anchor plan
        plan_artifact = self._get_latest_artifact(
            project_id, "scene_anchor_plan", "chapter", chapter_index, workflow_run_id
        )
        if plan_artifact and plan_artifact.content_json:
            trace.scene_anchor_plan = plan_artifact.content_json

        # 8. Feedback items
        feedback_items = self._get_feedback(project_id, chapter_index, workflow_run_id)
        trace.feedback_items = feedback_items
        trace.has_feedback = len(feedback_items) > 0

        return trace

    def get_failed_chapters(
        self,
        project_id: int,
        since_chapter: int = 1,
        threshold: float = 7.0,
    ) -> list[ChapterTrace]:
        """Get chapters whose evaluation score fell below *threshold*.

        These are prime candidates for experience extraction.
        """
        artifacts = (
            self.db.query(Artifact)
            .filter(
                Artifact.project_id == project_id,
                Artifact.artifact_type == "chapter_evaluation",
                Artifact.scope == "chapter",
                Artifact.is_current.is_(True),
            )
            .all()
        )

        traces: list[ChapterTrace] = []
        seen_chapters: set[int] = set()
        for art in artifacts:
            ci = art.chapter_index
            if ci is None or ci in seen_chapters or ci < since_chapter:
                continue
            report = art.content_json or {}
            score = report.get("score") or report.get("overall_score")
            if score is not None and float(score) < threshold:
                traces.append(self.get_chapter_trace(project_id, ci, art.workflow_run_id))
                seen_chapters.add(ci)

        return traces

    def get_user_modified_chapters(
        self,
        project_id: int,
    ) -> list[ChapterTrace]:
        """Get chapters that received direct user feedback (rejection or note).

        These often contain implicit user preferences worth distilling.
        """
        feedback_items = (
            self.db.query(FeedbackItem)
            .filter(
                FeedbackItem.project_id == project_id,
                FeedbackItem.status == "applied",
                FeedbackItem.feedback_scope.in_(["chapter", "selection"]),
                FeedbackItem.chapter_index.isnot(None),
            )
            .order_by(FeedbackItem.id.desc())
            .all()
        )

        traces: list[ChapterTrace] = []
        seen_chapters: set[int] = set()
        for item in feedback_items:
            ci = item.chapter_index
            if ci is None or ci in seen_chapters:
                continue
            traces.append(self.get_chapter_trace(project_id, ci))
            seen_chapters.add(ci)

        return traces

    def get_all_traces_for_project(
        self,
        project_id: int,
        min_chapter: int = 1,
        max_chapter: int | None = None,
    ) -> list[ChapterTrace]:
        """Get traces for all generated chapters in a project."""
        artifacts = (
            self.db.query(Artifact)
            .filter(
                Artifact.project_id == project_id,
                Artifact.artifact_type == "chapter_evaluation",
                Artifact.scope == "chapter",
                Artifact.is_current.is_(True),
            )
            .all()
        )

        traces: list[ChapterTrace] = []
        seen: set[int] = set()
        for art in artifacts:
            ci = art.chapter_index
            if ci is None or ci in seen:
                continue
            if ci < min_chapter:
                continue
            if max_chapter is not None and ci > max_chapter:
                continue
            traces.append(self.get_chapter_trace(project_id, ci, art.workflow_run_id))
            seen.add(ci)

        traces.sort(key=lambda t: t.chapter_index)
        return traces

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_latest_artifact(
        self,
        project_id: int,
        artifact_type: str,
        scope: str,
        chapter_index: int,
        workflow_run_id: int | None = None,
    ) -> Artifact | None:
        query = self.db.query(Artifact).filter(
            Artifact.project_id == project_id,
            Artifact.artifact_type == artifact_type,
            Artifact.scope == scope,
            Artifact.chapter_index == chapter_index,
        )
        if workflow_run_id is not None:
            query = query.filter(Artifact.workflow_run_id == workflow_run_id)
        return query.order_by(Artifact.version_number.desc()).first()

    def _get_artifacts_by_type(
        self,
        project_id: int,
        artifact_type: str,
        scope: str,
        chapter_index: int,
        workflow_run_id: int | None = None,
    ) -> list[Artifact]:
        query = self.db.query(Artifact).filter(
            Artifact.project_id == project_id,
            Artifact.artifact_type == artifact_type,
            Artifact.scope == scope,
            Artifact.chapter_index == chapter_index,
        )
        if workflow_run_id is not None:
            query = query.filter(Artifact.workflow_run_id == workflow_run_id)
        return query.order_by(Artifact.id.asc()).all()

    def _get_feedback(
        self,
        project_id: int,
        chapter_index: int,
        workflow_run_id: int | None = None,
    ) -> list[dict]:
        query = self.db.query(FeedbackItem).filter(
            FeedbackItem.project_id == project_id,
            FeedbackItem.chapter_index == chapter_index,
        )
        if workflow_run_id is not None:
            query = query.filter(FeedbackItem.workflow_run_id == workflow_run_id)

        results: list[dict] = []
        for item in query.order_by(FeedbackItem.id.desc()).all():
            results.append({
                "id": item.id,
                "feedback_scope": item.feedback_scope,
                "feedback_type": item.feedback_type,
                "action_type": item.action_type,
                "content": item.content,
                "status": item.status,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "feedback_metadata": item.feedback_metadata,
            })
        return results
