"""
章节管理路由
获取、更新、重新生成章节
"""

import logging
import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database import get_db
from backend.models import User, Project, Chapter, GenerationTask, ChapterVersion
from backend.schemas import ChapterResponse, ChapterUpdate, GenerationTaskResponse
from backend.deps import get_current_user
from core.config import settings

logger = logging.getLogger(__name__)

# 导入Celery任务
try:
    from tasks.writing_tasks import generate_novel_task
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False

router = APIRouter(prefix="/projects/{project_id}/chapters", tags=["chapters"])


@router.get("/{chapter_index}", response_model=ChapterResponse, summary="获取章节内容")
def get_chapter(
    project_id: int,
    chapter_index: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取指定章节的完整内容"""
    # 验证项目权限（支持协作者）
    from backend.api.projects import check_project_access
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    chapter = db.query(Chapter).filter(
        Chapter.project_id == project_id,
        Chapter.chapter_index == chapter_index
    ).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="章节不存在"
        )

    return chapter


@router.put("/{chapter_index}", response_model=ChapterResponse, summary="更新章节内容")
def update_chapter(
    project_id: int,
    chapter_index: int,
    chapter_in: ChapterUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新章节内容（人工编辑），同时同步更新文件系统"""
    # 验证项目权限 - 更新需要所有者权限（协作者目前只读）
    from backend.api.projects import check_project_access
    project = check_project_access(project_id, current_user, db, require_owner=True)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    chapter = db.query(Chapter).filter(
        Chapter.project_id == project_id,
        Chapter.chapter_index == chapter_index
    ).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="章节不存在"
        )

    # 更新字段
    for field, value in chapter_in.model_dump(exclude_unset=True).items():
        if hasattr(chapter, field):
            setattr(chapter, field, value)

    # 计算字数：统计汉字数量，HTML标签不计入
    import re
    if chapter_in.content is not None:
        chinese_chars = re.findall(r'[\u4e00-\u9fff]', chapter_in.content)
        chapter.word_count = len(chinese_chars)

    # 状态改为edited
    if chapter_in.content is not None:
        chapter.status = "edited"

    # 保存版本历史 - 每次内容更新都保存一个版本
    if chapter_in.content is not None:
        # 获取当前最大版本号
        max_version = db.query(ChapterVersion.version_number)\
            .filter(ChapterVersion.chapter_id == chapter.id)\
            .order_by(desc(ChapterVersion.version_number))\
            .first()
        next_version = (max_version[0] + 1) if max_version else 1

        # 创建新版本
        version = ChapterVersion(
            chapter_id=chapter.id,
            version_number=next_version,
            content=chapter_in.content,
            word_count=chapter.word_count,
        )
        db.add(version)

        # 清理旧版本 - 只保留最近10个版本
        all_versions = db.query(ChapterVersion)\
            .filter(ChapterVersion.chapter_id == chapter.id)\
            .order_by(desc(ChapterVersion.version_number))\
            .offset(10)\
            .all()
        for old_ver in all_versions:
            db.delete(old_ver)

    db.commit()
    db.refresh(chapter)

    # 同步写回文件
    if project.file_path:
        try:
            chapter_file = Path(project.file_path) / f"chapter_{chapter_index}.txt"
            with open(chapter_file, "w", encoding="utf-8") as f:
                f.write(chapter.content)
        except Exception as e:
            # 文件写入失败不返回错误，只记录日志
            import logging
            logging.warning(f"Failed to write chapter file: {e}")

    return chapter


@router.post("/{chapter_index}/regenerate", response_model=GenerationTaskResponse, summary="重新生成章节")
def regenerate_chapter(
    project_id: int,
    chapter_index: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    重新生成单个章节：
    - 创建单独的异步任务
    - TODO: 目前完整生成会从start_chapter开始，后续优化支持只生成单章
    """
    if not CELERY_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Celery 异步任务未配置"
        )

    # 验证项目权限 - 需要所有者权限
    from backend.api.projects import check_project_access
    project = check_project_access(project_id, current_user, db, require_owner=True)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    chapter = db.query(Chapter).filter(
        Chapter.project_id == project_id,
        Chapter.chapter_index == chapter_index
    ).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="章节不存在"
        )

    # 检查是否已有运行中的任务
    running_task = db.query(GenerationTask).filter(
        GenerationTask.project_id == project_id,
        GenerationTask.status.in_(["pending", "started", "progress"])
    ).first()
    if running_task:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"已有运行中的任务 (task_id={running_task.celery_task_id})"
        )

    # 提交Celery任务
    # TODO: 后续支持只生成单章，目前完整生成
    project_dir = project.file_path
    celery_task = generate_novel_task.delay(project_dir, str(current_user.id))

    # 创建任务记录
    task = GenerationTask(
        project_id=project.id,
        celery_task_id=celery_task.id,
        status="pending",
        progress=0.0,
        current_chapter=chapter_index,
    )
    db.add(task)
    project.status = "generating"
    db.commit()
    db.refresh(task)

    return task


# ========== 版本历史 ==========

from pydantic import BaseModel

class VersionListResponse(BaseModel):
    versions: list[dict]

@router.get("/{chapter_index}/versions", summary="获取章节版本历史列表")
def list_versions(
    project_id: int,
    chapter_index: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取章节所有保存的版本列表（只返回元数据）"""
    # 验证项目权限（支持协作者只读访问）
    from backend.api.projects import check_project_access
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    chapter = db.query(Chapter).filter(
        Chapter.project_id == project_id,
        Chapter.chapter_index == chapter_index
    ).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="章节不存在"
        )

    versions = db.query(ChapterVersion)\
        .filter(ChapterVersion.chapter_id == chapter.id)\
        .order_by(desc(ChapterVersion.version_number))\
        .all()

    return {
        "versions": [
            {
                "id": v.id,
                "version_number": v.version_number,
                "word_count": v.word_count,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            } for v in versions
        ]
    }


@router.get("/{chapter_index}/versions/{version_id}", summary="获取版本内容")
def get_version_content(
    project_id: int,
    chapter_index: int,
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取指定版本的完整内容"""
    # 验证项目权限（支持协作者只读访问）
    from backend.api.projects import check_project_access
    project = check_project_access(project_id, current_user, db, require_owner=False)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    chapter = db.query(Chapter).filter(
        Chapter.project_id == project_id,
        Chapter.chapter_index == chapter_index
    ).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="章节不存在"
        )

    version = db.query(ChapterVersion)\
        .filter(ChapterVersion.id == version_id, ChapterVersion.chapter_id == chapter.id)\
        .first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )

    return {
        "id": version.id,
        "version_number": version.version_number,
        "content": version.content,
        "word_count": version.word_count,
        "created_at": version.created_at.isoformat() if version.created_at else None,
    }


@router.post("/{chapter_index}/versions/{version_id}/restore", summary="恢复到指定版本")
def restore_version(
    project_id: int,
    chapter_index: int,
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """将章节恢复到指定版本"""
    # 验证项目权限 - 修改需要所有者权限
    from backend.api.projects import check_project_access
    project = check_project_access(project_id, current_user, db, require_owner=True)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    chapter = db.query(Chapter).filter(
        Chapter.project_id == project_id,
        Chapter.chapter_index == chapter_index
    ).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="章节不存在"
        )

    version = db.query(ChapterVersion)\
        .filter(ChapterVersion.id == version_id, ChapterVersion.chapter_id == chapter.id)\
        .first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )

    # 保存当前内容作为新版本（避免丢失）
    max_version = db.query(ChapterVersion.version_number)\
        .filter(ChapterVersion.chapter_id == chapter.id)\
        .order_by(desc(ChapterVersion.version_number))\
        .first()
    next_version = (max_version[0] + 1) if max_version else 1
    new_version = ChapterVersion(
        chapter_id=chapter.id,
        version_number=next_version,
        content=chapter.content,
        word_count=chapter.word_count,
    )
    db.add(new_version)

    # 恢复版本内容到当前章节
    chapter.content = version.content
    chapter.word_count = version.word_count
    chapter.status = "edited"

    db.commit()
    db.refresh(chapter)

    # 同步写回文件
    if project.file_path:
        try:
            chapter_file = Path(project.file_path) / f"chapter_{chapter_index}.txt"
            with open(chapter_file, "w", encoding="utf-8") as f:
                f.write(chapter.content)
        except Exception as e:
            import logging
            logging.warning(f"Failed to write chapter file: {e}")

    return chapter
