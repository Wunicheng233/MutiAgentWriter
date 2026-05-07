"""
任务状态常量

长期目标：
- 让“什么算活跃任务”成为中心化规则
- 避免不同 API 对 waiting_confirm 等中间态判断不一致
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Query, Session

from backend.models import GenerationTask, WorkflowRun
from backend.workflow_service import update_workflow_run_status


ACTIVE_TASK_STATUSES = (
    "pending",
    "started",
    "progress",
    "waiting_confirm",
)


def active_project_tasks_query(db: Session, project_id: int) -> Query:
    """Return all active tasks for a project using the shared lifecycle rule."""
    return db.query(GenerationTask).filter(
        GenerationTask.project_id == project_id,
        GenerationTask.status.in_(ACTIVE_TASK_STATUSES),
    )


def get_active_project_task(db: Session, project_id: int) -> GenerationTask | None:
    """Return the active task the UI/API should surface first."""
    return (
        active_project_tasks_query(db, project_id)
        .order_by(GenerationTask.started_at.desc(), GenerationTask.id.desc())
        .first()
    )


def get_active_user_generation_task(db: Session, user_id: int) -> GenerationTask | None:
    """Return an active generation task triggered by the given user."""
    return (
        db.query(GenerationTask)
        .join(WorkflowRun, WorkflowRun.generation_task_id == GenerationTask.id)
        .filter(
            GenerationTask.status.in_(ACTIVE_TASK_STATUSES),
            WorkflowRun.run_kind.in_(("generation", "regeneration")),
            WorkflowRun.triggered_by_user_id == user_id,
        )
        .order_by(GenerationTask.started_at.desc(), GenerationTask.id.desc())
        .first()
    )


def mark_task_terminal(
    *,
    db: Session,
    task: GenerationTask,
    task_status: str,
    current_step_key: str,
    error_message: str | None = None,
    metadata_updates: dict | None = None,
) -> None:
    """Move a tracked task and its workflow run into a terminal state."""
    now = datetime.utcnow()
    task.status = task_status
    task.completed_at = task.completed_at or now
    if error_message is not None:
        task.error_message = error_message

    update_workflow_run_status(
        db=db,
        generation_task=task,
        task_status=task_status,
        current_step_key=current_step_key,
        current_chapter=task.current_chapter,
        metadata_updates=metadata_updates,
    )


def mark_active_project_tasks_terminal(
    *,
    db: Session,
    project_id: int,
    task_status: str,
    current_step_key: str,
    error_message: str | None = None,
    metadata_updates: dict | None = None,
) -> list[GenerationTask]:
    """Move every active task for a project into the requested terminal state."""
    tasks = active_project_tasks_query(db, project_id).all()
    for task in tasks:
        mark_task_terminal(
            db=db,
            task=task,
            task_status=task_status,
            current_step_key=current_step_key,
            error_message=error_message,
            metadata_updates=metadata_updates,
        )
    return tasks
