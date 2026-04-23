"""
章节文件与数据库同步辅助函数

当前阶段的目标很克制：
- 保持现有 `chapter_x.txt -> Chapter` 的行为不变
- 收敛重复的解析/同步逻辑，避免后续格式漂移
"""

from __future__ import annotations

import re
from pathlib import Path

from sqlalchemy.orm import Session

from backend.models import Chapter, Project


def parse_chapter_file_content(content: str) -> tuple[str | None, str, int]:
    """将章节纯文本解析成数据库使用的标题、HTML 内容和字数。"""
    lines = content.split("\n")
    chapter_title = None
    body_lines: list[str] = []

    for index, line in enumerate(lines):
        if index == 0 and line.strip() and "第" in line and "章" in line:
            chapter_title = line.strip().lstrip("#").strip()
            continue
        if line.strip():
            body_lines.append(line)

    body = "\n".join(body_lines).strip()
    paragraphs = re.split(r"\n\s*\n", body) if body else []
    html_content = "\n".join(f"<p>{paragraph.strip()}</p>" for paragraph in paragraphs if paragraph.strip())
    chinese_chars = re.findall(r"[\u4e00-\u9fff]", html_content)
    word_count = len(chinese_chars)
    return chapter_title, html_content, word_count


def sync_chapter_file_to_db(
    db: Session,
    project: Project,
    chapter_index: int,
    chapter_file: Path,
    status: str = "generated",
) -> Chapter | None:
    """把单个章节文件同步到数据库。"""
    if not chapter_file.exists():
        return None

    content = chapter_file.read_text(encoding="utf-8")
    chapter_title, html_content, word_count = parse_chapter_file_content(content)

    chapter = db.query(Chapter).filter(
        Chapter.project_id == project.id,
        Chapter.chapter_index == chapter_index,
    ).first()

    if chapter:
        chapter.content = html_content
        chapter.word_count = word_count
        if chapter_title:
            chapter.title = chapter_title
        chapter.status = status
        return chapter

    chapter = Chapter(
        project_id=project.id,
        chapter_index=chapter_index,
        title=chapter_title,
        content=html_content,
        word_count=word_count,
        status=status,
    )
    db.add(chapter)
    return chapter
