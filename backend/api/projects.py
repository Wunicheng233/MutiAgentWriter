"""
项目管理路由
列出、创建、获取、更新、删除项目
触发生成任务
"""

import logging
import os
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

logger = logging.getLogger(__name__)

from backend.database import get_db
from backend.models import User, Project, Chapter, GenerationTask, WorkflowRun, Artifact
from backend.task_dispatch import dispatch_tracked_task, make_task_id
from backend.task_status import (
    active_project_tasks_query,
    get_active_project_task,
    mark_active_project_tasks_terminal,
)
from backend.schemas import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    ArtifactListResponse,
    ArtifactResponse,
    WorkflowRunResponse,
    WorkflowRunListResponse,
    ChapterSummary,
    GenerationTaskResponse,
    QualityAnalytics,
)
from backend.deps import get_current_user
from backend.workflow_service import create_generation_workflow_run, serialize_workflow_run
from core.config import settings

# 导入Celery任务（可选）
try:
    from tasks.writing_tasks import generate_novel_task
    from celery.result import AsyncResult
    from celery_app import celery_app
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False

router = APIRouter(prefix="/projects", tags=["projects"])

# 项目文件根目录
PROJECTS_ROOT = settings.root_dir / "data" / "projects"


@router.get("", response_model=ProjectListResponse, summary="列出用户所有项目")
def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """列出当前认证用户的所有项目，按创建时间倒序"""
    query = db.query(Project).filter(Project.user_id == current_user.id).order_by(desc(Project.created_at))
    total = query.count()
    projects = query.offset(skip).limit(limit).all()
    return {
        "total": total,
        "items": projects
    }


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED, summary="创建新项目")
def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建新项目，保存基础信息并创建文件目录"""
    # 创建项目记录
    project = Project(
        user_id=current_user.id,
        name=project_in.name,
        description=project_in.description,
        content_type=project_in.content_type or "full_novel",
        status="draft",
        config={
            "novel_name": project_in.novel_name or project_in.name,
            "novel_description": project_in.novel_description,
            "core_requirement": project_in.core_requirement,
            "genre": project_in.genre,
            "total_words": project_in.total_words,
            "core_hook": project_in.core_hook,
            "target_platform": project_in.target_platform or "网络小说",
            "chapter_word_count": project_in.chapter_word_count or 2000,
            "start_chapter": project_in.start_chapter or 1,
            "end_chapter": project_in.end_chapter or 10,
            "skip_plan_confirmation": project_in.skip_plan_confirmation or False,
            "skip_chapter_confirmation": project_in.skip_chapter_confirmation or False,
            "allow_plot_adjustment": project_in.allow_plot_adjustment or False,
        }
    )

    # 创建项目文件目录：data/projects/{user_id}/{project_id}/
    db.add(project)
    db.flush()  # 获取id

    project_dir = PROJECTS_ROOT / str(current_user.id) / str(project.id)
    project_dir.mkdir(parents=True, exist_ok=True)
    project.file_path = str(project_dir)

    db.commit()
    db.refresh(project)

    return project


@router.get("/{project_id}", response_model=ProjectResponse, summary="获取项目详情")
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取项目详情，包括配置和章节列表"""
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    # 查询当前是否有正在运行的任务，包括等待人工确认的任务。
    running_task = get_active_project_task(db, project_id)

    # 将 running_task 添加到返回结果，并附带 workflow 摘要
    result = project.__dict__.copy()
    if running_task:
        current_generation_task = {
            **running_task.__dict__,
            "current_workflow_run": serialize_workflow_run(
                running_task.workflow_run,
                include_steps=False,
                include_feedback_items=False,
            ),
        }
        result['current_generation_task'] = current_generation_task
    else:
        result['current_generation_task'] = None

    return result


@router.get(
    "/{project_id}/workflow-runs",
    response_model=WorkflowRunListResponse,
    summary="获取项目工作流运行历史",
)
def list_workflow_runs(
    project_id: int,
    limit: int = Query(10, ge=1, le=50),
    include_steps: bool = Query(True),
    include_feedback_items: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回项目最近的 workflow runs，供前端展示运行历史和回放摘要。"""
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    query = db.query(WorkflowRun).filter(
        WorkflowRun.project_id == project_id
    ).order_by(
        desc(WorkflowRun.started_at),
        desc(WorkflowRun.id),
    )
    total = query.count()
    workflow_runs = query.limit(limit).all()

    return {
        "total": total,
        "items": [
            serialize_workflow_run(
                workflow_run,
                include_steps=include_steps,
                include_feedback_items=include_feedback_items,
            )
            for workflow_run in workflow_runs
        ],
    }


@router.get(
    "/{project_id}/artifacts",
    response_model=ArtifactListResponse,
    summary="获取项目 artifacts 列表",
)
def list_artifacts(
    project_id: int,
    limit: int = Query(20, ge=1, le=100),
    workflow_run_id: int | None = Query(None),
    chapter_index: int | None = Query(None),
    artifact_type: str | None = Query(None),
    scope: str | None = Query(None),
    current_only: bool = Query(False),
    include_content: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回项目 artifacts，可按 run / chapter / type 过滤。"""
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    query = db.query(Artifact).filter(
        Artifact.project_id == project_id
    )
    if workflow_run_id is not None:
        query = query.filter(Artifact.workflow_run_id == workflow_run_id)
    if chapter_index is not None:
        query = query.filter(Artifact.chapter_index == chapter_index)
    if artifact_type:
        query = query.filter(Artifact.artifact_type == artifact_type)
    if scope:
        query = query.filter(Artifact.scope == scope)
    if current_only:
        query = query.filter(Artifact.is_current.is_(True))

    query = query.order_by(desc(Artifact.created_at), desc(Artifact.id))
    total = query.count()
    artifacts = query.limit(limit).all()

    def serialize_artifact(artifact: Artifact) -> dict:
        payload = {
            "id": artifact.id,
            "workflow_run_id": artifact.workflow_run_id,
            "chapter_id": artifact.chapter_id,
            "artifact_type": artifact.artifact_type,
            "scope": artifact.scope,
            "chapter_index": artifact.chapter_index,
            "version_number": artifact.version_number,
            "is_current": artifact.is_current,
            "source": artifact.source,
            "created_at": artifact.created_at,
        }
        if include_content:
            payload["content_text"] = artifact.content_text
            payload["content_json"] = artifact.content_json
        else:
            payload["content_text"] = None
            payload["content_json"] = None
        return payload

    return {
        "total": total,
        "items": [serialize_artifact(artifact) for artifact in artifacts],
    }


@router.get(
    "/{project_id}/artifacts/{artifact_id}",
    response_model=ArtifactResponse,
    summary="获取单个 artifact 详情",
)
def get_artifact(
    project_id: int,
    artifact_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回单个 artifact 的完整内容。"""
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    artifact = db.query(Artifact).filter(
        Artifact.project_id == project_id,
        Artifact.id == artifact_id,
    ).first()
    if artifact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact 不存在"
        )

    return {
        "id": artifact.id,
        "workflow_run_id": artifact.workflow_run_id,
        "chapter_id": artifact.chapter_id,
        "artifact_type": artifact.artifact_type,
        "scope": artifact.scope,
        "chapter_index": artifact.chapter_index,
        "version_number": artifact.version_number,
        "is_current": artifact.is_current,
        "source": artifact.source,
        "created_at": artifact.created_at,
        "content_text": artifact.content_text,
        "content_json": artifact.content_json,
    }


@router.get(
    "/{project_id}/workflow-runs/{run_id}",
    response_model=WorkflowRunResponse,
    summary="获取单次工作流运行详情",
)
def get_workflow_run(
    project_id: int,
    run_id: int,
    include_steps: bool = Query(True),
    include_feedback_items: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回单次 workflow run 的完整详情，供运行回放与问题排查页面使用。"""
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    workflow_run = db.query(WorkflowRun).filter(
        WorkflowRun.project_id == project_id,
        WorkflowRun.id == run_id,
    ).first()
    if workflow_run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="工作流运行不存在"
        )

    return serialize_workflow_run(
        workflow_run,
        include_steps=include_steps,
        include_feedback_items=include_feedback_items,
    )


@router.put("/{project_id}", response_model=ProjectResponse, summary="更新项目")
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新项目信息"""
    # 更新需要所有者权限
    project = check_project_access(project_id, current_user, db, require_owner=True)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    # 更新字段
    for field, value in project_in.model_dump(exclude_unset=True).items():
        if hasattr(project, field):
            setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", summary="删除项目")
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除项目（数据库记录+文件）"""
    project = check_project_access(project_id, current_user, db, require_owner=True)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    # 删除文件（如果存在）
    if project.file_path:
        try:
            project_dir = Path(project.file_path)
            if project_dir.exists():
                import shutil
                shutil.rmtree(project_dir)
        except Exception as e:
            # 文件删除失败不阻止数据库删除
            pass

    db.delete(project)
    db.commit()

    return {"status": "ok", "message": "项目已删除"}


@router.get("/{project_id}/chapters", response_model=List[ChapterSummary], summary="列出项目所有章节")
def list_chapters(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取项目所有章节摘要列表"""
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    chapters = db.query(Chapter).filter(
        Chapter.project_id == project_id
    ).order_by(Chapter.chapter_index).all()

    return chapters


@router.get("/{project_id}/plan-preview", summary="获取策划方案预览")
def get_plan_preview(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取策划方案预览（前 2000 字）"""
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    if not project.file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="项目文件路径不存在"
        )

    # 读取 novel_plan.md 或者 setting_bible.md
    project_path = Path(project.file_path)
    plan_path = project_path / "novel_plan.md"
    setting_path = project_path / "setting_bible.md"

    content = ""
    if plan_path.exists():
        with open(plan_path, "r", encoding="utf-8") as f:
            content = f.read()
    elif setting_path.exists():
        with open(setting_path, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="策划方案文件不存在，请先生成策划方案"
        )

    # 返回前 3000 字符作为预览
    preview = content[:3000]
    if len(content) > 3000:
        preview += "\n\n...（内容已截断，完整内容保存到项目文件）"

    return {
        "preview": preview,
        "full_length": len(content),
    }


@router.post("/{project_id}/generate", response_model=GenerationTaskResponse, summary="触发生成任务")
def trigger_generation(
    project_id: int,
    regenerate: bool = Query(False, description="重新生成：清空所有已有章节文件后再开始"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    触发生成任务：
    - 检查是否已有运行中的任务
    - 创建GenerationTask记录
    - 提交到Celery队列异步执行
    """
    if not CELERY_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Celery 异步任务未配置，请先安装 celery 和 redis"
        )

    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    # 检查是否已有运行中的任务
    running_task = get_active_project_task(db, project_id)
    if running_task:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"已有运行中的任务 (task_id={running_task.celery_task_id})，请等待完成"
        )

    # 如果是重新生成，清空所有已生成的章节文件和数据库记录
    if regenerate:
        # 删除数据库中的章节记录
        db.query(Chapter).filter(Chapter.project_id == project_id).delete()
        # 删除文件系统中的章节文件
        if project.file_path:
            try:
                project_dir = Path(project.file_path)
                chapters_dir = project_dir / "chapters"
                if chapters_dir.exists():
                    for f in chapters_dir.glob("chapter_*.txt"):
                        f.unlink()
                    for f in chapters_dir.glob("feedback_*.txt"):
                        f.unlink()
                # 删除根目录的残留文件
                for f in project_dir.glob("chapter_*.txt"):
                    f.unlink()
                for f in project_dir.glob("feedback_*.txt"):
                    f.unlink()
                # 删除评分信息
                info_file = project_dir / "info.json"
                if info_file.exists():
                    info_file.unlink()
                logger.info(f"Regenerate: cleared all existing chapters for project {project_id}")
            except Exception as e:
                logger.warning(f"Failed to clear existing chapters for regenerate: {e}")
        db.commit()

    project_dir = project.file_path
    celery_task_id = make_task_id("generate")

    # 创建任务记录
    task = GenerationTask(
        project_id=project.id,
        celery_task_id=celery_task_id,
        status="pending",
        progress=0.0,
    )
    db.add(task)
    db.flush()

    create_generation_workflow_run(
        db=db,
        project=project,
        generation_task=task,
        triggered_by_user_id=current_user.id,
        regenerate=regenerate,
    )

    project.status = "generating"
    db.commit()
    db.refresh(task)

    dispatch_tracked_task(
        db=db,
        task=task,
        celery_task=generate_novel_task,
        args=(project_dir, str(current_user.id)),
        project=project,
    )

    return task


@router.get("/{project_id}/analytics", response_model=QualityAnalytics, summary="获取质量分析")
def get_analytics(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取项目质量分析报告（各章节评分和维度平均分）"""
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    chapters = db.query(Chapter).filter(
        Chapter.project_id == project_id
    ).order_by(Chapter.chapter_index).all()

    chapter_scores = []
    total_chapters = len(chapters)
    passed_chapters = sum(1 for c in chapters if c.status == "generated" and c.quality_score >= 8.0)

    for chapter in chapters:
        chapter_scores.append({
            "chapter_index": chapter.chapter_index,
            "title": chapter.title,
            "quality_score": chapter.quality_score,
            "status": chapter.status,
        })

    return {
        "overall_quality_score": project.overall_quality_score or 0.0,
        "dimension_average_scores": project.dimension_average_scores or {},
        "chapter_scores": chapter_scores,
        "total_chapters": total_chapters,
        "passed_chapters": passed_chapters,
    }


@router.post("/{project_id}/export", response_model=GenerationTaskResponse, summary="触发导出")
def trigger_export(
    project_id: int,
    format: str = Query(..., pattern="^(epub|docx|html)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    触发生成导出文件，返回 Celery 任务 ID 供轮询
    """
    if not CELERY_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Celery 异步任务未配置，请先安装 celery 和 redis"
        )

    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    # 检查是否已有运行中的导出任务；这里复用 GenerationTask 记录任务。
    running_task = get_active_project_task(db, project_id)
    if running_task:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"已有运行中的任务，请等待完成"
        )

    # 检查是否有章节
    chapters_count = db.query(Chapter).filter(Chapter.project_id == project_id).count()
    if chapters_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="项目没有章节，请先生成内容"
        )

    # 导入导出任务
    from tasks.export_tasks import export_project_task
    celery_task_id = make_task_id("export")

    # 创建任务记录
    task = GenerationTask(
        project_id=project.id,
        celery_task_id=celery_task_id,
        status="pending",
        progress=0.0,
        current_step=f"准备导出 {format}...",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    dispatch_tracked_task(
        db=db,
        task=task,
        celery_task=export_project_task,
        args=(project_id, format),
        project=None,
    )

    return task


@router.get("/{project_id}/export/download", summary="下载导出文件")
def download_export(
    project_id: int,
    task_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """下载已完成的导出文件，仅允许项目拥有者或协作者访问。"""
    from fastapi.responses import FileResponse
    from celery.result import AsyncResult

    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    # 先检查任务是否存在且已完成
    task = db.query(GenerationTask).filter(
        GenerationTask.id == task_id,
        GenerationTask.project_id == project_id
    ).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )

    if task.status != "success":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"任务未完成，当前状态: {task.status}"
        )

    # 获取 Celery 任务结果
    if not CELERY_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Celery 不可用"
        )

    result = AsyncResult(task.celery_task_id)
    if not result.ready():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="任务尚未完成"
        )

    if result.failed():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {result.result.get('error', '未知错误')}"
        )

    task_result = result.result
    file_path = task_result.get('file_path')
    filename = task_result.get('filename')

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文件不存在，可能已被清理"
        )

    # 根据格式设置 media type
    format = task_result.get('format')
    media_types = {
        'epub': 'application/epub+zip',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'html': 'text/html',
    }
    media_type = media_types.get(format, 'application/octet-stream')

    return FileResponse(
        file_path,
        media_type=media_type,
        filename=filename
    )


from pydantic import BaseModel
from backend.models import TokenUsage, ProjectCollaborator
from core.config import settings


def check_project_access(
    project_id: int,
    current_user: User,
    db: Session,
    require_owner: bool = False
) -> Project:
    """
    检查当前用户是否有权限访问项目
    - 如果是所有者：总是允许
    - 如果是协作者：
      - require_owner=False: 允许
      - require_owner=True: 只允许所有者
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return None

    # 所有者直接通过
    if project.user_id == current_user.id:
        return project

    if require_owner:
        # 需要所有者权限，协作者不行
        return None

    # 检查是否是协作者
    collab = db.query(ProjectCollaborator).filter(
        ProjectCollaborator.project_id == project_id,
        ProjectCollaborator.user_id == current_user.id
    ).first()

    if collab:
        # editor 和 viewer 都允许访问
        return project

    return None

class TokenUsageStats(BaseModel):
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float

@router.get("/{project_id}/token-stats", response_model=TokenUsageStats, summary="获取项目Token使用统计")
def get_project_token_stats(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取项目累计Token使用和估算成本"""
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    from sqlalchemy import func
    stats = db.query(
        func.sum(TokenUsage.prompt_tokens).label("total_prompt"),
        func.sum(TokenUsage.completion_tokens).label("total_completion"),
        func.sum(TokenUsage.total_tokens).label("total"),
    ).filter(
        TokenUsage.project_id == project_id,
        TokenUsage.user_id == current_user.id
    ).first()

    total_prompt = stats[0] or 0
    total_completion = stats[1] or 0
    total = stats[2] or 0

    # 计算估算成本
    estimated_cost = (
        (total_prompt / 1000) * settings.default_prompt_price +
        (total_completion / 1000) * settings.default_completion_price
    )

    return {
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "total_tokens": total,
        "estimated_cost_usd": round(estimated_cost, 4),
    }


import secrets
import datetime
from backend.models import ShareLink, Chapter
from pydantic import BaseModel

class CreateShareResponse(BaseModel):
    share_url: str
    share_token: str

@router.post("/{project_id}/share", response_model=CreateShareResponse, summary="创建分享链接")
def create_share_link(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建只读分享链接，无需登录即可访问"""
    project = check_project_access(project_id, current_user, db, require_owner=True)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    # 检查是否已经存在分享链接
    existing = db.query(ShareLink).filter(ShareLink.project_id == project_id).first()
    if existing:
        # 返回已有链接
        share_url = f"/share/{existing.share_token}"
        return {
            "share_url": share_url,
            "share_token": existing.share_token
        }

    # 创建新分享链接，token使用32字节随机字符串
    share_token = secrets.token_urlsafe(32)
    share_link = ShareLink(
        project_id=project_id,
        share_token=share_token,
    )
    db.add(share_link)
    db.commit()

    share_url = f"/share/{share_token}"
    return {
        "share_url": share_url,
        "share_token": share_token
    }


# ========== Collaborators ==========

from pydantic import BaseModel
from backend.models import ProjectCollaborator, User

class CollaboratorInfo(BaseModel):
    id: int
    username: str
    email: str
    role: str
    invited_at: str

class AddCollaboratorRequest(BaseModel):
    username: str
    role: str = "viewer"

@router.get("/{project_id}/collaborators", response_model=list[CollaboratorInfo], summary="列出项目协作者")
def list_collaborators(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """列出项目所有协作者，只有项目所有者可以查看"""
    project = check_project_access(project_id, current_user, db, require_owner=True)
    if not project:
        raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="项目不存在"
    )

    collaborators = db.query(ProjectCollaborator)\
        .join(User)\
        .filter(ProjectCollaborator.project_id == project_id)\
        .all()

    result = []
    for collab in collaborators:
        user = collab.user
        result.append({
            "id": collab.id,
            "username": user.username,
            "email": user.email,
            "role": collab.role,
            "invited_at": collab.invited_at.isoformat() if collab.invited_at else None,
        })

    return result


@router.post("/{project_id}/collaborators", summary="添加协作者")
def add_collaborator(
    project_id: int,
    request: AddCollaboratorRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """添加协作者到项目，只有项目所有者可以添加"""
    project = check_project_access(project_id, current_user, db, require_owner=True)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
        detail="项目不存在"
    )

    # 查找用户
    user = db.query(User).filter(User.username == request.username).first()
    if not user:
        raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"用户 {request.username} 不存在"
    )

    # 检查是否已是协作者
    existing = db.query(ProjectCollaborator).filter(
        ProjectCollaborator.project_id == project_id,
        ProjectCollaborator.user_id == user.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该用户已是协作者"
        )

    # 添加协作者，自动接受因为直接添加
    collab = ProjectCollaborator(
        project_id=project_id,
        user_id=user.id,
        role=request.role,
        accepted_at=datetime.datetime.utcnow()
    )
    db.add(collab)
    db.commit()

    return {"status": "ok", "message": f"已添加 {user.username} 为协作者"}


@router.delete("/{project_id}/collaborators/{collab_id}", summary="移除协作者")
def remove_collaborator(
    project_id: int,
    collab_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """移除协作者，只有项目所有者可以移除"""
    project = check_project_access(project_id, current_user, db, require_owner=True)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    collab = db.query(ProjectCollaborator).filter(
        ProjectCollaborator.id == collab_id,
        ProjectCollaborator.project_id == project_id
    ).first()
    if not collab:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="协作者不存在"
        )

    db.delete(collab)
    db.commit()

    return {"status": "ok", "message": "协作者已移除"}


@router.post("/{project_id}/reset", summary="重置项目为草稿")
def reset_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    重置项目：
    - 将项目状态改回 draft
    - 取消所有未完成的生成任务
    - 删除所有已生成的章节记录
    - 清空项目目录中的生成文件
    """
    project = check_project_access(project_id, current_user, db, require_owner=True)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    # 1. 查找所有未完成的任务，先标记为 cancelled，再尽力从队列中撤销
    running_tasks = active_project_tasks_query(db, project_id).all()

    mark_active_project_tasks_terminal(
        db=db,
        project_id=project_id,
        task_status="cancelled",
        current_step_key="cancelled",
        error_message="Project reset cancelled this task",
        metadata_updates={"cancelled_by": "project_reset"},
    )

    if CELERY_AVAILABLE:
        for task in running_tasks:
            try:
                # 尝试从 Celery 队列中撤销任务；运行中的任务仍依赖任务自身读取 cancelled 状态退出。
                celery_app.control.revoke(task.celery_task_id)
            except Exception as e:
                logger.warning(f"Failed to revoke celery task {task.celery_task_id}: {e}")

    # 2. 删除所有已生成的章节
    db.query(Chapter).filter(Chapter.project_id == project_id).delete()

    # 3. 重置项目状态
    project.status = "draft"
    project.overall_quality_score = 0
    project.dimension_average_scores = None
    db.commit()

    # 4. 清空项目目录中的生成文件
    if project.file_path:
        try:
            project_dir = Path(project.file_path)
            if project_dir.exists():
                # 删除根目录的 chapter_*.txt, feedback_*.txt (兼容旧格式)
                for f in project_dir.glob("chapter_*.txt"):
                    f.unlink()
                for f in project_dir.glob("feedback_*.txt"):
                    f.unlink()
                # 删除 chapters/ 子目录中的章节文件
                chapters_dir = project_dir / "chapters"
                if chapters_dir.exists():
                    for f in chapters_dir.glob("chapter_*.txt"):
                        f.unlink()
                    for f in chapters_dir.glob("feedback_*.txt"):
                        f.unlink()
                # 删除 bible.json 如果存在
                bible_file = project_dir / "bible.json"
                if bible_file.exists():
                    bible_file.unlink()
                # 删除 info.json 中的分数信息
                info_file = project_dir / "info.json"
                if info_file.exists():
                    info_file.unlink()
        except Exception as e:
            logger.warning(f"Failed to clean project directory: {e}")

    return {"status": "ok", "message": "项目已重置为草稿，所有生成内容已清除"}


# ========== Reading Progress ==========

import datetime
from backend.models import ReadingProgress
from pydantic import BaseModel

class ReadingProgressRequest(BaseModel):
    chapter_index: int
    position: int
    percentage: float

class ReadingProgressResponse(BaseModel):
    project_id: int
    chapter_index: int
    position: int
    percentage: float
    last_read_at: str

@router.get("/{project_id}/progress", response_model=ReadingProgressResponse, summary="获取阅读进度")
def get_reading_progress(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取项目最后阅读进度"""
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    progress = db.query(ReadingProgress).filter(
        ReadingProgress.project_id == project_id,
        ReadingProgress.user_id == current_user.id
    ).first()

    if not progress:
        return {
            "project_id": project_id,
            "chapter_index": 1,
            "position": 1,
            "percentage": 0,
            "last_read_at": datetime.datetime.utcnow().isoformat()
        }

    return {
        "project_id": progress.project_id,
        "chapter_index": progress.chapter_index,
        "position": progress.position,
        "percentage": progress.percentage,
        "last_read_at": progress.last_read_at.isoformat() if progress.last_read_at else "",
    }

@router.post("/{project_id}/progress", summary="保存阅读进度")
def save_reading_progress(
    project_id: int,
    request: ReadingProgressRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """保存当前阅读进度，upsert"""
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    progress = db.query(ReadingProgress).filter(
        ReadingProgress.project_id == project_id,
        ReadingProgress.user_id == current_user.id
    ).first()

    if progress:
        progress.chapter_index = request.chapter_index
        progress.position = request.position
        progress.percentage = request.percentage
        progress.last_read_at = datetime.datetime.utcnow()
    else:
        progress = ReadingProgress(
            project_id=project_id,
            user_id=current_user.id,
            chapter_index=request.chapter_index,
            position=request.position,
            percentage=request.percentage,
            last_read_at=datetime.datetime.utcnow()
        )
        db.add(progress)

    db.commit()
    return {"status": "ok"}


@router.post("/{project_id}/clean-stuck-tasks", summary="清理项目中卡住的任务")
def clean_stuck_tasks(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    清理项目中所有卡住的未完成任务：
    - 将所有 pending/started/progress 状态的任务标记为 failure
    - 用户可以重新触发导出/生成
    """
    project = check_project_access(project_id, current_user, db, require_owner=True)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    # 查找所有卡住的未完成任务
    stuck_tasks = mark_active_project_tasks_terminal(
        db=db,
        project_id=project_id,
        task_status="failure",
        current_step_key="failed",
        error_message="User manually cleaned up stuck task",
        metadata_updates={"failed_by": "manual_cleanup"},
    )
    count = len(stuck_tasks)
    if count > 0:
        db.commit()
        return {
            "status": "ok",
            "message": f"已清理 {count} 个卡住的任务",
            "cleaned_count": count
        }
    else:
        return {
            "status": "ok",
            "message": "没有找到卡住的任务",
            "cleaned_count": 0
        }
