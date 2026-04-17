"""
SQLAlchemy ORM 数据模型
- User: 用户表
- Project: 项目表
- Chapter: 章节表
- GenerationTask: 生成任务追踪表
"""

import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float, Boolean
from sqlalchemy.orm import relationship
from backend.database import Base


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    api_key = Column(String(100), unique=True, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # 关系：一个用户多个项目
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")


class Project(Base):
    """项目表"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    content_type = Column(String(20), default="full_novel")  # full_novel / short_story / script
    status = Column(String(20), default="draft")  # draft / generating / completed / failed
    # 配置信息：存储策划方案、需求等JSON
    config = Column(JSON, nullable=True)
    # 设定圣经：存储人设世界观等JSON
    bible = Column(JSON, nullable=True)
    # 文件系统路径：项目输出目录相对路径
    file_path = Column(String(255), nullable=True)
    # 质量评分
    overall_quality_score = Column(Float, default=0.0)
    dimension_average_scores = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # 关系
    owner = relationship("User", back_populates="projects")
    chapters = relationship("Chapter", back_populates="project", cascade="all, delete-orphan")
    generation_tasks = relationship("GenerationTask", back_populates="project", cascade="all, delete-orphan")


class Chapter(Base):
    """章节表"""
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    chapter_index = Column(Integer, nullable=False)  # 章节号，从1开始
    title = Column(String(200), nullable=True)
    content = Column(Text, nullable=False)  # 章节完整内容
    word_count = Column(Integer, default=0)
    quality_score = Column(Float, default=0.0)
    # 状态：draft / generated / edited
    status = Column(String(20), default="draft")
    # Agent日志：存储各Agent的输出摘要
    agent_logs = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # 复合唯一索引：project_id + chapter_index 在 migrations 中创建
    project = relationship("Project", back_populates="chapters")


class GenerationTask(Base):
    """生成任务追踪表，关联Celery任务"""
    __tablename__ = "generation_tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    celery_task_id = Column(String(50), unique=True, nullable=False)
    status = Column(String(20), default="pending")  # pending / started / progress / success / failure
    progress = Column(Float, default=0.0)  # 0-1
    current_step = Column(Text, nullable=True)  # 使用Text存储长文本
    current_chapter = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="generation_tasks")


class ChapterVersion(Base):
    """章节版本历史 - 保存每次修改历史供回滚"""
    __tablename__ = "chapter_versions"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)  # 从1开始递增
    content = Column(Text, nullable=False)
    word_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # 不保存关系到chapter，因为不需要查询不多，每次保存都是独立版本，通过chapter_id关联


class TokenUsage(Base):
    """Token 使用记录 - 统计API调用成本"""
    __tablename__ = "token_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    agent_name = Column(String(30), nullable=False)
    model = Column(String(100), nullable=True)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ShareLink(Base):
    """只读分享链接 - 无需登录即可访问"""
    __tablename__ = "share_links"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    share_token = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=True)  # 可选过期时间
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ProjectCollaborator(Base):
    """项目协作者 - 支持多人协作编辑"""
    __tablename__ = "project_collaborators"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), default="viewer")  # viewer / editor
    invited_at = Column(DateTime, default=datetime.datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)

