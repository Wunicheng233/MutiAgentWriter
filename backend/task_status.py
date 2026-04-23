"""
任务状态常量

长期目标：
- 让“什么算活跃任务”成为中心化规则
- 避免不同 API 对 waiting_confirm 等中间态判断不一致
"""

from sqlalchemy.orm import Query, Session

from backend.models import GenerationTask


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
