"""
任务状态查询路由
获取Celery任务进度
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from celery.result import AsyncResult
from pydantic import BaseModel

from backend.database import get_db
from backend.models import User, GenerationTask, Project, Chapter
from backend.schemas import GenerationTaskResponse
from backend.deps import get_current_user
from celery_app import celery_app
from tasks.writing_tasks import generate_novel_task

router = APIRouter(prefix="/tasks", tags=["tasks"])


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

    # 验证权限：检查项目属于当前用户
    project = db.query(Project).filter(Project.id == task_record.project_id).first()
    if not project or project.user_id != current_user.id:
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
    }

    # 如果PROGRESS，从result.info获取更详细进度
    if result.state == "PROGRESS" and result.info:
        response.update(result.info)

    # 如果SUCCESS，结果存在
    if result.state == "SUCCESS" and result.result:
        response["result"] = result.result

    # 如果FAILURE
    if result.state == "FAILURE":
        response["error"] = str(result.info) if result.info else "Task failed"

    return response


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

    # 验证权限
    project = db.query(Project).filter(Project.id == task_record.project_id).first()
    if not project or project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )

    if task_record.status != "waiting_confirm":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="任务当前不在等待确认状态"
        )

    chapter_index = task_record.current_chapter
    if not chapter_index:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="任务没有等待确认的章节"
        )

    # 获取当前章节内容
    chapter = db.query(Chapter).filter(
        Chapter.project_id == project.id,
        Chapter.chapter_index == chapter_index
    ).first()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="章节不存在"
        )

    # 如果用户不通过且提供了修改意见，需要将反馈保存到项目目录
    # 供orchestrator下次启动时读取并重新优化
    if not request.approved and request.feedback.strip():
        if project.file_path:
            feedback_file = Path(project.file_path) / f"feedback_{chapter_index}.txt"
            with open(feedback_file, "w", encoding="utf-8") as f:
                f.write(request.feedback)

    # 重新启动任务继续生成
    # Celery会分配一个新的worker进程继续
    new_task = generate_novel_task.delay(project.file_path, str(current_user.id))

    # 创建新的任务记录
    new_task_record = GenerationTask(
        project_id=project.id,
        celery_task_id=new_task.id,
        status="pending",
        progress=task_record.progress,
        current_chapter=chapter_index if not request.approved else chapter_index + 1,
        current_step=f"继续生成，等待启动..."
    )
    db.add(new_task_record)
    db.commit()

    # 更新原项目状态
    project.status = "generating"
    db.commit()

    return {
        "success": True,
        "new_task_id": new_task.id,
        "message": "已提交确认，任务继续"
    }
