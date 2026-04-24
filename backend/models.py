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
    encrypted_api_key = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # 关系：一个用户多个项目
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    collaborations = relationship("ProjectCollaborator", back_populates="user", cascade="all, delete-orphan")
    workflow_runs = relationship("WorkflowRun", back_populates="triggered_by_user")
    feedback_items = relationship("FeedbackItem", back_populates="created_by_user")


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
    workflow_runs = relationship("WorkflowRun", back_populates="project", cascade="all, delete-orphan")
    artifacts = relationship("Artifact", back_populates="project", cascade="all, delete-orphan")
    feedback_items = relationship("FeedbackItem", back_populates="project", cascade="all, delete-orphan")
    share_links = relationship("ShareLink", back_populates="project", cascade="all, delete-orphan")
    collaborators = relationship("ProjectCollaborator", back_populates="project", cascade="all, delete-orphan")


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
    artifacts = relationship("Artifact", back_populates="chapter")
    feedback_items = relationship("FeedbackItem", back_populates="chapter")


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
    workflow_run = relationship("WorkflowRun", back_populates="generation_task", uselist=False)


class WorkflowRun(Base):
    """创作工作流运行记录 - 一次生成/续写/修订任务的持久化入口"""
    __tablename__ = "workflow_runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    generation_task_id = Column(Integer, ForeignKey("generation_tasks.id", ondelete="SET NULL"), nullable=True, unique=True)
    parent_run_id = Column(Integer, ForeignKey("workflow_runs.id", ondelete="SET NULL"), nullable=True)
    run_kind = Column(String(30), nullable=False, default="generation")  # generation / regeneration / revision / publish
    trigger_source = Column(String(30), nullable=False, default="manual")  # manual / feedback / system / publish
    status = Column(String(20), nullable=False, default="pending")  # pending / running / waiting_confirm / completed / failed / cancelled
    current_step_key = Column(String(50), nullable=True)
    current_chapter = Column(Integer, nullable=True)
    triggered_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    run_metadata = Column(JSON, nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="workflow_runs")
    generation_task = relationship("GenerationTask", back_populates="workflow_run")
    parent_run = relationship("WorkflowRun", remote_side=[id], back_populates="child_runs")
    child_runs = relationship("WorkflowRun", back_populates="parent_run")
    triggered_by_user = relationship("User", back_populates="workflow_runs")
    step_runs = relationship("WorkflowStepRun", back_populates="workflow_run", cascade="all, delete-orphan")
    artifacts = relationship("Artifact", back_populates="workflow_run", cascade="all, delete-orphan")
    feedback_items = relationship("FeedbackItem", back_populates="workflow_run")


class WorkflowStepRun(Base):
    """工作流单步执行记录 - 用于未来的重试、回放和分析"""
    __tablename__ = "workflow_step_runs"

    id = Column(Integer, primary_key=True, index=True)
    workflow_run_id = Column(Integer, ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False)
    step_key = Column(String(50), nullable=False)
    step_type = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    attempt = Column(Integer, nullable=False, default=1)
    chapter_index = Column(Integer, nullable=True)
    input_artifact_id = Column(Integer, ForeignKey("artifacts.id", ondelete="SET NULL"), nullable=True)
    output_artifact_id = Column(Integer, ForeignKey("artifacts.id", ondelete="SET NULL"), nullable=True)
    step_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    workflow_run = relationship("WorkflowRun", back_populates="step_runs")
    input_artifact = relationship("Artifact", foreign_keys=[input_artifact_id], post_update=True)
    output_artifact = relationship("Artifact", foreign_keys=[output_artifact_id], post_update=True)


class Artifact(Base):
    """创作工件 - 计划、设定、章节草稿、评分、快照等统一载体"""
    __tablename__ = "artifacts"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    workflow_run_id = Column(Integer, ForeignKey("workflow_runs.id", ondelete="SET NULL"), nullable=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    artifact_type = Column(String(50), nullable=False)
    scope = Column(String(20), nullable=False, default="project")  # project / chapter / step
    chapter_index = Column(Integer, nullable=True)
    version_number = Column(Integer, nullable=False, default=1)
    is_current = Column(Boolean, default=True)
    source = Column(String(30), nullable=False, default="system")  # system / user / agent
    content_text = Column(Text, nullable=True)
    content_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="artifacts")
    workflow_run = relationship("WorkflowRun", back_populates="artifacts")
    chapter = relationship("Chapter", back_populates="artifacts")


class FeedbackItem(Base):
    """结构化反馈记录 - 取代单纯的 feedback_x.txt 作为长期事实源"""
    __tablename__ = "feedback_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    workflow_run_id = Column(Integer, ForeignKey("workflow_runs.id", ondelete="SET NULL"), nullable=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    artifact_id = Column(Integer, ForeignKey("artifacts.id", ondelete="SET NULL"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    feedback_scope = Column(String(20), nullable=False, default="chapter")  # project / plan / chapter / selection
    feedback_type = Column(String(30), nullable=False, default="user_note")  # user_rejection / user_note / editor_note
    action_type = Column(String(30), nullable=False, default="rewrite")  # rewrite / revise / polish / adjust_plan
    chapter_index = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default="open")  # open / applied / ignored
    content = Column(Text, nullable=False)
    feedback_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="feedback_items")
    workflow_run = relationship("WorkflowRun", back_populates="feedback_items")
    chapter = relationship("Chapter", back_populates="feedback_items")
    artifact = relationship("Artifact")
    created_by_user = relationship("User", back_populates="feedback_items")


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

    project = relationship("Project", back_populates="share_links")


class ProjectCollaborator(Base):
    """项目协作者 - 支持多人协作编辑"""
    __tablename__ = "project_collaborators"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), default="viewer")  # viewer / editor
    invited_at = Column(DateTime, default=datetime.datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="collaborators")
    user = relationship("User", back_populates="collaborations")


class ReadingProgress(Base):
    """阅读进度记录 - 保存用户每个项目的最后阅读位置"""
    __tablename__ = "reading_progress"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chapter_index = Column(Integer, nullable=False)
    position = Column(Integer, nullable=False, default=1)  # 分页模式：页码；滚动模式：scrollTop
    percentage = Column(Float, default=0.0)  # 阅读百分比 0-1
    last_read_at = Column(DateTime, default=datetime.datetime.utcnow)
