"""
Synchronize harness evaluation reports into database artifacts.

The orchestrator writes evaluation reports to info.json today. This module is
the bridge that brings those reports into the long-term Artifact data model.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from backend.models import Artifact, Chapter, Project
from backend.workflow_service import record_chapter_evaluation_artifact


def sync_evaluation_reports_to_artifacts(
    db: Session,
    project: Project,
    workflow_run_id: int | None,
    evaluation_reports: list[dict[str, Any]] | None,
) -> list[Artifact]:
    if not evaluation_reports:
        return []

    artifacts: list[Artifact] = []
    for report in evaluation_reports:
        chapter_index = report.get("chapter_index")
        if chapter_index is None:
            continue

        chapter = db.query(Chapter).filter(
            Chapter.project_id == project.id,
            Chapter.chapter_index == int(chapter_index),
        ).first()
        if chapter is None:
            continue

        artifacts.append(
            record_chapter_evaluation_artifact(
                db=db,
                project_id=project.id,
                chapter=chapter,
                workflow_run_id=workflow_run_id,
                evaluation_report=report,
                source="agent",
            )
        )

    return artifacts
