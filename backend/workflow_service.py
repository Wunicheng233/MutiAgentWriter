"""
工作流基础服务
为长期架构演进提供最小可用的数据写入入口。
当前阶段只承接两件事：
- 生成任务触发时创建 WorkflowRun / WorkflowStepRun / Artifact
- 用户驳回章节时记录结构化 FeedbackItem
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from pathlib import Path

from backend.models import Artifact, FeedbackItem, GenerationTask, Project, WorkflowRun, WorkflowStepRun
from core.agent_contract import get_agent_contract


@dataclass(frozen=True)
class FeedbackFileMaterialization:
    feedback_item_id: int
    feedback_scope: str
    chapter_index: int | None
    content: str
    path: Path
    file_created: bool
    file_updated: bool


def _next_artifact_version(
    db: Session,
    project_id: int,
    artifact_type: str,
    scope: str,
    chapter_id: int | None = None,
    chapter_index: int | None = None,
) -> int:
    query = db.query(func.max(Artifact.version_number)).filter(
        Artifact.project_id == project_id,
        Artifact.artifact_type == artifact_type,
        Artifact.scope == scope,
    )
    if chapter_index is not None:
        query = query.filter(Artifact.chapter_index == chapter_index)
    elif chapter_id is not None:
        query = query.filter(Artifact.chapter_id == chapter_id)
    else:
        query = query.filter(Artifact.chapter_index.is_(None), Artifact.chapter_id.is_(None))

    current_max = query.scalar()
    return (current_max or 0) + 1


def _matching_artifact_query(
    db: Session,
    project_id: int,
    artifact_type: str,
    scope: str,
    chapter_id: int | None = None,
    chapter_index: int | None = None,
):
    query = db.query(Artifact).filter(
        Artifact.project_id == project_id,
        Artifact.artifact_type == artifact_type,
        Artifact.scope == scope,
    )
    if chapter_index is not None:
        return query.filter(Artifact.chapter_index == chapter_index)
    if chapter_id is not None:
        return query.filter(Artifact.chapter_id == chapter_id)
    return query.filter(Artifact.chapter_index.is_(None), Artifact.chapter_id.is_(None))


def create_artifact(
    db: Session,
    project_id: int,
    artifact_type: str,
    scope: str,
    workflow_run_id: int | None = None,
    chapter_id: int | None = None,
    chapter_index: int | None = None,
    source: str = "system",
    content_text: str | None = None,
    content_json: dict | list | None = None,
    is_current: bool = True,
) -> Artifact:
    """Create a versioned artifact and keep the current pointer consistent."""
    if not artifact_type:
        raise ValueError("artifact_type is required")
    if scope not in {"project", "chapter", "step"}:
        raise ValueError(f"Unsupported artifact scope: {scope}")
    if source not in {"system", "user", "agent"}:
        raise ValueError(f"Unsupported artifact source: {source}")

    version = _next_artifact_version(
        db=db,
        project_id=project_id,
        artifact_type=artifact_type,
        scope=scope,
        chapter_id=chapter_id,
        chapter_index=chapter_index,
    )

    if is_current:
        current_artifacts = _matching_artifact_query(
            db=db,
            project_id=project_id,
            artifact_type=artifact_type,
            scope=scope,
            chapter_id=chapter_id,
            chapter_index=chapter_index,
        ).filter(Artifact.is_current.is_(True)).all()
        for existing_artifact in current_artifacts:
            existing_artifact.is_current = False

    artifact = Artifact(
        project_id=project_id,
        workflow_run_id=workflow_run_id,
        chapter_id=chapter_id,
        artifact_type=artifact_type,
        scope=scope,
        chapter_index=chapter_index,
        version_number=version,
        is_current=is_current,
        source=source,
        content_text=content_text,
        content_json=content_json,
    )
    db.add(artifact)
    db.flush()
    return artifact


def _infer_step_type(step_key: str) -> str:
    mapping = {
        "queued_generation": "system",
        "booting": "system",
        "planning": "planner",
        "generating_settings": "planner",
        "generating_chapter": "generator",
        "waiting_confirm": "approval",
        "completed": "system",
        "failed": "system",
        "cancelled": "system",
    }
    return mapping.get(step_key, "system")


def _infer_agent_key(step_key: str) -> str | None:
    mapping = {
        "planning": "planner",
        "generating_settings": "planner",
        "generating_chapter": "writer",
    }
    return mapping.get(step_key)


def _build_agent_contract_summary(step_key: str) -> dict | None:
    agent_key = _infer_agent_key(step_key)
    if agent_key is None:
        return None

    contract = get_agent_contract(agent_key)
    return {
        "agent_key": contract.agent_key,
        "display_name": contract.display_name,
        "layer": contract.layer,
        "input_schema_ref": contract.input_schema_ref,
        "output_schema_ref": contract.output_schema_ref,
        "prompt_template_key": contract.prompt_template_key,
        "model_policy_key": contract.model_policy_key,
    }


def _sync_workflow_step_run(
    db: Session,
    workflow_run: WorkflowRun,
    task_status: str,
    step_key: str | None,
    chapter_index: int | None,
    step_data: dict | None = None,
) -> None:
    if not step_key:
        return

    now = datetime.utcnow()
    step_status_mapping = {
        "pending": "pending",
        "started": "running",
        "progress": "running",
        "waiting_confirm": "waiting_confirm",
        "success": "completed",
        "failure": "failed",
        "cancelled": "cancelled",
    }
    desired_status = step_status_mapping.get(task_status, "running")
    merged_step_data = dict(step_data or {})
    contract_summary = _build_agent_contract_summary(step_key)
    if contract_summary is not None:
        merged_step_data.setdefault("agent_contract", contract_summary)

    active_steps = db.query(WorkflowStepRun).filter(
        WorkflowStepRun.workflow_run_id == workflow_run.id,
        WorkflowStepRun.status.in_(["pending", "running", "waiting_confirm"]),
    ).all()
    for active_step in active_steps:
        same_step = active_step.step_key == step_key and active_step.chapter_index == chapter_index
        if not same_step:
            active_step.status = "completed"
            active_step.completed_at = active_step.completed_at or now

    current_step = db.query(WorkflowStepRun).filter(
        WorkflowStepRun.workflow_run_id == workflow_run.id,
        WorkflowStepRun.step_key == step_key,
        WorkflowStepRun.chapter_index == chapter_index,
    ).order_by(WorkflowStepRun.id.desc()).first()

    if current_step is None:
        current_step = WorkflowStepRun(
            workflow_run_id=workflow_run.id,
            step_key=step_key,
            step_type=_infer_step_type(step_key),
            status=desired_status,
            chapter_index=chapter_index,
            step_data=merged_step_data,
            started_at=now,
        )
        if desired_status in {"completed", "failed", "cancelled"}:
            current_step.completed_at = now
        db.add(current_step)
        db.flush()
        return

    merged_step_data = dict(current_step.step_data or {}) | merged_step_data
    current_step.step_data = merged_step_data
    current_step.step_type = _infer_step_type(step_key)
    current_step.status = desired_status
    current_step.started_at = current_step.started_at or now
    if desired_status in {"completed", "failed", "cancelled"}:
        current_step.completed_at = current_step.completed_at or now
    elif desired_status == "waiting_confirm":
        current_step.completed_at = None
    else:
        current_step.completed_at = None


def create_generation_workflow_run(
    db: Session,
    project: Project,
    generation_task: GenerationTask,
    triggered_by_user_id: int | None,
    regenerate: bool = False,
    parent_run: WorkflowRun | None = None,
) -> WorkflowRun:
    run = WorkflowRun(
        project_id=project.id,
        generation_task_id=generation_task.id,
        parent_run_id=parent_run.id if parent_run else None,
        run_kind="regeneration" if regenerate else "generation",
        trigger_source="manual" if parent_run is None else "feedback",
        status=generation_task.status or "pending",
        current_step_key="queued_generation",
        triggered_by_user_id=triggered_by_user_id,
        run_metadata={
            "regenerate": regenerate,
            "project_status_at_start": project.status,
            "source_task_id": generation_task.celery_task_id,
        },
    )
    db.add(run)
    db.flush()

    create_artifact(
        db=db,
        project_id=project.id,
        workflow_run_id=run.id,
        artifact_type="project_config_snapshot",
        scope="project",
        source="system",
        content_json=project.config or {},
    )

    step = WorkflowStepRun(
        workflow_run_id=run.id,
        step_key="queued_generation",
        step_type="system",
        status="completed",
        step_data={
            "generation_task_id": generation_task.id,
            "celery_task_id": generation_task.celery_task_id,
        },
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
    )
    db.add(step)
    db.flush()
    return run


def create_feedback_item(
    db: Session,
    project_id: int,
    workflow_run_id: int | None,
    created_by_user_id: int | None,
    content: str,
    chapter_index: int | None,
    feedback_scope: str,
    feedback_type: str,
    action_type: str,
    chapter_id: int | None = None,
    artifact_id: int | None = None,
    feedback_metadata: dict | None = None,
) -> FeedbackItem:
    now = datetime.utcnow()
    feedback_item = FeedbackItem(
        project_id=project_id,
        workflow_run_id=workflow_run_id,
        chapter_id=chapter_id,
        artifact_id=artifact_id,
        created_by_user_id=created_by_user_id,
        feedback_scope=feedback_scope,
        feedback_type=feedback_type,
        action_type=action_type,
        chapter_index=chapter_index,
        content=content,
        feedback_metadata=feedback_metadata or {},
    )
    db.add(feedback_item)
    db.flush()

    superseded_items = db.query(FeedbackItem).filter(
        FeedbackItem.project_id == project_id,
        FeedbackItem.feedback_scope == feedback_scope,
        FeedbackItem.chapter_index == chapter_index,
        FeedbackItem.status == "open",
        FeedbackItem.id != feedback_item.id,
    ).all()

    for item in superseded_items:
        item.status = "ignored"
        item.resolved_at = now
        merged_metadata = dict(item.feedback_metadata or {})
        merged_metadata.update(
            {
                "resolution_reason": "superseded",
                "superseded_by_feedback_item_id": feedback_item.id,
            }
        )
        item.feedback_metadata = merged_metadata

    db.flush()
    return feedback_item


def update_workflow_run_status(
    db: Session,
    generation_task: GenerationTask,
    task_status: str,
    current_step_key: str | None = None,
    current_chapter: int | None = None,
    metadata_updates: dict | None = None,
) -> WorkflowRun | None:
    workflow_run = generation_task.workflow_run
    if workflow_run is None:
        return None

    status_mapping = {
        "pending": "pending",
        "started": "running",
        "progress": "running",
        "waiting_confirm": "waiting_confirm",
        "success": "completed",
        "failure": "failed",
        "cancelled": "cancelled",
    }
    workflow_run.status = status_mapping.get(task_status, workflow_run.status)

    if current_step_key is not None:
        workflow_run.current_step_key = current_step_key
    if current_chapter is not None:
        workflow_run.current_chapter = current_chapter

    if metadata_updates:
        merged_metadata = dict(workflow_run.run_metadata or {})
        merged_metadata.update(metadata_updates)
        workflow_run.run_metadata = merged_metadata

    step_data = {
        "task_status": task_status,
        "workflow_status": workflow_run.status,
    }
    if metadata_updates:
        step_data.update(metadata_updates)
    _sync_workflow_step_run(
        db=db,
        workflow_run=workflow_run,
        task_status=task_status,
        step_key=current_step_key,
        chapter_index=current_chapter,
        step_data=step_data,
    )

    if workflow_run.status in {"completed", "failed", "cancelled"}:
        workflow_run.completed_at = datetime.utcnow()
    elif task_status in {"started", "progress"} and workflow_run.started_at is None:
        workflow_run.started_at = datetime.utcnow()

    db.flush()
    return workflow_run


def serialize_workflow_run(
    workflow_run: WorkflowRun | None,
    include_steps: bool = False,
    include_feedback_items: bool = False,
) -> dict | None:
    if workflow_run is None:
        return None

    payload = {
        "id": workflow_run.id,
        "run_kind": workflow_run.run_kind,
        "trigger_source": workflow_run.trigger_source,
        "status": workflow_run.status,
        "current_step_key": workflow_run.current_step_key,
        "current_chapter": workflow_run.current_chapter,
        "run_metadata": workflow_run.run_metadata or {},
        "started_at": workflow_run.started_at,
        "completed_at": workflow_run.completed_at,
    }

    if include_steps:
        ordered_steps = sorted(workflow_run.step_runs, key=lambda step: step.id)
        payload["steps"] = [
            {
                "id": step.id,
                "step_key": step.step_key,
                "step_type": step.step_type,
                "status": step.status,
                "attempt": step.attempt,
                "chapter_index": step.chapter_index,
                "step_data": step.step_data or {},
                "started_at": step.started_at,
                "completed_at": step.completed_at,
            }
            for step in ordered_steps
        ]

    if include_feedback_items:
        ordered_feedback = sorted(workflow_run.feedback_items, key=lambda item: item.id, reverse=True)
        payload["feedback_items"] = [
            {
                "id": item.id,
                "feedback_scope": item.feedback_scope,
                "feedback_type": item.feedback_type,
                "action_type": item.action_type,
                "chapter_index": item.chapter_index,
                "status": item.status,
                "content": item.content,
                "created_at": item.created_at,
            }
            for item in ordered_feedback
        ]

    return payload


def materialize_open_feedback_files(
    db: Session,
    project: Project,
) -> list[FeedbackFileMaterialization]:
    if not project.file_path:
        return []

    project_dir = Path(project.file_path)
    project_dir.mkdir(parents=True, exist_ok=True)

    open_feedback_items = db.query(FeedbackItem).filter(
        FeedbackItem.project_id == project.id,
        FeedbackItem.status == "open",
    ).order_by(FeedbackItem.id.desc()).all()

    materialized_files: list[FeedbackFileMaterialization] = []
    latest_feedback_by_target: dict[tuple[str, int | None], FeedbackItem] = {}
    for item in open_feedback_items:
        target_key = (item.feedback_scope, item.chapter_index)
        if target_key in latest_feedback_by_target:
            continue
        latest_feedback_by_target[target_key] = item

    for item in latest_feedback_by_target.values():
        if item.chapter_index == 0 or item.feedback_scope == "plan":
            feedback_file = project_dir / "feedback_plan.txt"
        elif item.chapter_index is not None:
            feedback_file = project_dir / f"feedback_{item.chapter_index}.txt"
        else:
            continue

        file_created = not feedback_file.exists()
        file_updated = False
        if feedback_file.exists():
            existing_content = feedback_file.read_text(encoding="utf-8")
            file_updated = existing_content != item.content
        if file_created or file_updated:
            feedback_file.write_text(item.content, encoding="utf-8")

        materialized_files.append(
            FeedbackFileMaterialization(
                feedback_item_id=item.id,
                feedback_scope=item.feedback_scope,
                chapter_index=item.chapter_index,
                content=item.content,
                path=feedback_file,
                file_created=file_created,
                file_updated=file_updated,
            )
        )

    return materialized_files


def mark_feedback_item_applied(
    db: Session,
    feedback_item_id: int,
) -> bool:
    item = db.query(FeedbackItem).filter(
        FeedbackItem.id == feedback_item_id,
    ).first()
    if item is None or item.status != "open":
        return False

    item.status = "applied"
    item.resolved_at = datetime.utcnow()
    db.flush()
    return True


def reconcile_consumed_feedback_files(
    db: Session,
    materialized_files: list[FeedbackFileMaterialization],
) -> list[int]:
    applied_item_ids: list[int] = []
    for materialized in materialized_files:
        if materialized.path.exists():
            continue
        if mark_feedback_item_applied(db, materialized.feedback_item_id):
            applied_item_ids.append(materialized.feedback_item_id)

    return applied_item_ids
