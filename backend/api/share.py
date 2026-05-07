"""
分享链接公开访问路由
无需认证即可访问只读分享内容
"""

from __future__ import annotations

import datetime
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import ShareLink, Chapter
from backend.rate_limiter import limit_requests

from pydantic import BaseModel

class SharedProjectResponse(BaseModel):
    title: str
    description: str | None
    author: str
    chapters: list[dict]

router = APIRouter(prefix="/share", tags=["share"])


def _get_active_share_link(db: Session, token: str) -> ShareLink:
    share_link = db.query(ShareLink).filter(
        ShareLink.share_token == token
    ).first()

    if not share_link or not share_link.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分享链接不存在或已过期"
        )

    if share_link.expires_at and share_link.expires_at < datetime.datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="分享链接已过期"
        )

    return share_link


@router.get("/{token}", response_model=SharedProjectResponse, summary="获取分享项目信息", dependencies=[Depends(limit_requests(60))])
def get_shared_project(
    token: str,
    db: Session = Depends(get_db)
):
    """获取公开分享的项目信息和章节列表"""
    share_link = _get_active_share_link(db, token)
    share_link.view_count = int(share_link.view_count or 0) + 1
    share_link.last_viewed_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(share_link)

    project = share_link.project
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    config = project.config or {}
    title = config.get('novel_name', project.name)
    description = config.get('novel_description', project.description)
    author = project.owner.username if project.owner else 'Anonymous'

    chapters = db.query(Chapter)\
        .filter(Chapter.project_id == project.id)\
        .order_by(Chapter.chapter_index)\
        .all()

    return {
        "title": title,
        "description": description,
        "author": author,
        "chapters": [
            {
                "chapter_index": c.chapter_index,
                "title": c.title or f"第{c.chapter_index}章",
                "word_count": c.word_count,
            } for c in chapters
        ]
    }


@router.get("/{token}/chapters/{chapter_index}", summary="获取分享章节内容", dependencies=[Depends(limit_requests(60))])
def get_shared_chapter(
    token: str,
    chapter_index: int,
    db: Session = Depends(get_db)
):
    """获取公开分享的章节内容"""
    share_link = _get_active_share_link(db, token)

    chapter = db.query(Chapter).filter(
        Chapter.project_id == share_link.project_id,
        Chapter.chapter_index == chapter_index
    ).first()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="章节不存在"
        )

    return {
        "chapter_index": chapter.chapter_index,
        "title": chapter.title or f"第{chapter.chapter_index}章",
        "content": chapter.content,
    }
