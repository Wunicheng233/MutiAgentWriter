"""
任务状态查询路由
获取Celery任务进度
"""

from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from celery.result import AsyncResult
from pydantic import BaseModel

from backend.database import get_db
from backend.models import User, GenerationTask, Project, ProjectCollaborator
from backend.task_dispatch import dispatch_tracked_task, make_task_id
from backend.deps import get_current_user
from backend.workflow_service import (
    create_feedback_item,
    create_generation_workflow_run,
    serialize_workflow_run,
    update_workflow_run_status,
)


def check_project_access(
    project_id: int,
    current_user: User,
    db: Session,
    require_owner: bool = False,
    min_role: str | None = None,
) -> Project:
    """检查当前用户是否有权限访问项目（与 projects.py 保持一致）"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return None

    # 所有者总是直接通过
    if project.user_id == current_user.id:
        return project

    # 如果要求必须是所有者
    if require_owner:
        return None

    # 检查是否是协作者
    collab = db.query(ProjectCollaborator).filter(
        ProjectCollaborator.project_id == project_id,
        ProjectCollaborator.user_id == current_user.id
    ).first()

    if not collab:
        return None

    # 角色检查
    if min_role:
        role_levels = {'viewer': 1, 'editor': 2}
        required_level = role_levels.get(min_role, 0)
        actual_level = role_levels.get(collab.role, 0)
        if actual_level < required_level:
            return None

    return project
from celery_app import celery_app
from backend.tasks.writing_tasks import generate_novel_task

router = APIRouter(prefix="/tasks", tags=["tasks"])


class ConfirmationRequest(BaseModel):
    approved: bool
    feedback: str = ""


@router.post("/{task_id}/confirm", summary="提交章节确认（通过/修改）")
def confirm_chapter(
    task_id: str,
    request: ConfirmationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    提交对当前生成章节的确认：
    - approved=True: 通过，继续生成下一章
    - approved=False: 不通过，根据用户反馈重新优化当前章节
    """
    # 查找任务记录
    task_record = db.query(GenerationTask).filter(
        GenerationTask.celery_task_id == task_id
    ).first()

    if not task_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )

    # 刷新从数据库拿到最新状态
    db.refresh(task_record)

    # 验证权限：确认操作需要 editor 或所有者权限
    project = check_project_access(task_record.project_id, current_user, db, require_owner=False, min_role='editor')
    if not project:
        # 区分"任务不存在"和"权限不足"
        existing_task = db.query(GenerationTask).filter(GenerationTask.id == task_record.id).first()
        if not existing_task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="任务不存在"
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足：需要 editor 或所有者角色才能确认章节"
        )

    if task_record.status != "waiting_confirm":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"任务当前不在等待确认状态 (status: {task_record.status})"
        )

    chapter_index = task_record.current_chapter
    if chapter_index is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="任务没有等待确认的章节"
        )

    # 如果用户不通过且提供了修改意见，需要将反馈保存到项目目录
    # 供orchestrator下次启动时读取并重新优化
    if not request.approved and request.feedback.strip():
        current_run = task_record.workflow_run
        create_feedback_item(
            db=db,
            project_id=project.id,
            workflow_run_id=current_run.id if current_run else None,
            created_by_user_id=current_user.id,
            content=request.feedback.strip(),
            chapter_index=chapter_index,
            feedback_scope="plan" if chapter_index == 0 else "chapter",
            feedback_type="user_rejection",
            action_type="adjust_plan" if chapter_index == 0 else "rewrite",
            feedback_metadata={"source_task_id": task_record.celery_task_id},
        )
        if project.file_path:
            if chapter_index == 0:
                # chapter_index = 0 表示策划方案确认
                feedback_file = Path(project.file_path) / "feedback_plan.txt"
            else:
                # 正常章节确认
                feedback_file = Path(project.file_path) / f"feedback_{chapter_index}.txt"
            with open(feedback_file, "w", encoding="utf-8") as f:
                f.write(request.feedback)

    new_task_id = make_task_id("continue")
    review_outcome = "approved" if request.approved else "rejected"

    # 先将当前任务标记为完成状态，这样才能创建新任务（避免部分唯一索引冲突）
    # 注意：必须先完成旧任务，再创建新任务，否则会触发唯一索引约束
    task_record.status = "success"
    task_record.completed_at = datetime.utcnow()
    task_record.current_step = (
        f"第{chapter_index}章已确认，已继续生成下一章"
        if request.approved
        else f"第{chapter_index}章已驳回，已启动重写"
    )
    update_workflow_run_status(
        db=db,
        generation_task=task_record,
        task_status="success",
        current_step_key="completed",
        current_chapter=chapter_index,
        metadata_updates={
            "review_decision": review_outcome,
            "review_feedback": request.feedback.strip() or None,
            "continued_with_task_id": new_task_id,
        },
    )
    db.flush()  # 确保旧任务状态更新到数据库

    # 创建新的任务记录
    new_task_record = GenerationTask(
        project_id=project.id,
        celery_task_id=new_task_id,
        status="pending",
        progress=task_record.progress,
        current_chapter=chapter_index if not request.approved else chapter_index + 1,
        current_step="继续生成，等待启动..."
    )
    db.add(new_task_record)
    db.flush()

    create_generation_workflow_run(
        db=db,
        project=project,
        generation_task=new_task_record,
        triggered_by_user_id=current_user.id,
        regenerate=not request.approved,
        parent_run=task_record.workflow_run,
    )

    # 更新原项目状态
    project.status = "generating"
    db.commit()

    dispatch_tracked_task(
        db=db,
        task=new_task_record,
        celery_task=generate_novel_task,
        args=(project.file_path, str(current_user.id)),
        project=project,
    )

    return {
        "success": True,
        "new_task_id": new_task_id,
        "message": "已提交确认，任务继续"
    }


@router.get("/{task_id}", response_model=dict, summary="获取任务状态")
def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取Celery任务的详细状态和进度
    结合数据库记录和Celery结果
    """
    # 先从数据库找
    task_record = db.query(GenerationTask).filter(
        GenerationTask.celery_task_id == task_id
    ).first()

    if not task_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )

    # 验证权限：状态查询允许协作者访问
    project = check_project_access(task_record.project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )

    # 从Celery获取最新状态
    result = AsyncResult(task_id, app=celery_app)

    response = {
        "id": task_record.id,
        "project_id": task_record.project_id,
        "celery_task_id": task_id,
        "celery_state": result.state,
        "db_status": task_record.status,
        "progress": task_record.progress,
        "current_step": task_record.current_step,
        "current_chapter": task_record.current_chapter,
        "error_message": task_record.error_message,
        "started_at": task_record.started_at,
        "completed_at": task_record.completed_at,
        "workflow_run": serialize_workflow_run(
            task_record.workflow_run,
            include_steps=True,
            include_feedback_items=True,
        ),
    }

    # 如果PROGRESS，从result.info获取更详细进度
    if result.state == "PROGRESS" and result.info:
        response.update(result.info)

    # 如果SUCCESS，结果存在
    if result.state == "SUCCESS" and result.result:
        response["result"] = result.result

    # 如果FAILURE
    if result.state == "FAILURE":
        # result.info 会重新抛出异常，需要捕获
        try:
            response["error"] = str(result.info) if result.info else "Task failed"
        except Exception:
            response["error"] = "Task failed with unknown error"

    return response
