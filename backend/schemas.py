"""
Pydantic 请求/响应模式
用于FastAPI请求验证和响应序列化
"""

from typing import Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_serializer


# ========== User ==========

class UserBase(BaseModel):
    username: str
    email: str


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    id: int
    api_key: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("api_key", when_used="json")
    def serialize_api_key(self, api_key: Optional[str]) -> Optional[str]:
        if not api_key:
            return None
        if len(api_key) <= 8:
            return api_key
        return f"{api_key[:4]}...{api_key[-4:]}"


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# ========== Generation Task ==========

class ArtifactSummaryResponse(BaseModel):
    id: int
    artifact_type: str
    scope: str
    chapter_index: Optional[int] = None
    version_number: int
    is_current: bool
    source: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ArtifactResponse(ArtifactSummaryResponse):
    workflow_run_id: Optional[int] = None
    chapter_id: Optional[int] = None
    content_text: Optional[str] = None
    content_json: Optional[dict | list] = None


class ArtifactListResponse(BaseModel):
    total: int
    items: List[ArtifactResponse]


class WorkflowStepRunResponse(BaseModel):
    id: int
    step_key: str
    step_type: str
    status: str
    attempt: int
    chapter_index: Optional[int] = None
    input_artifact_id: Optional[int] = None
    output_artifact_id: Optional[int] = None
    input_artifact: Optional[ArtifactSummaryResponse] = None
    output_artifact: Optional[ArtifactSummaryResponse] = None
    step_data: Optional[Dict] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class WorkflowFeedbackItemResponse(BaseModel):
    id: int
    feedback_scope: str
    feedback_type: str
    action_type: str
    chapter_index: Optional[int] = None
    status: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkflowRunResponse(BaseModel):
    id: int
    generation_task_id: Optional[int] = None
    parent_run_id: Optional[int] = None
    run_kind: str
    trigger_source: str
    status: str
    current_step_key: Optional[str] = None
    current_chapter: Optional[int] = None
    run_metadata: Optional[Dict] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    steps: Optional[List[WorkflowStepRunResponse]] = None
    feedback_items: Optional[List[WorkflowFeedbackItemResponse]] = None

    model_config = ConfigDict(from_attributes=True)


class GenerationTaskResponse(BaseModel):
    id: int
    project_id: int
    celery_task_id: str
    status: str
    progress: float
    current_step: Optional[str]
    current_chapter: Optional[int]
    error_message: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    current_workflow_run: Optional[WorkflowRunResponse] = None

    model_config = ConfigDict(from_attributes=True)


# ========== Project ==========

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    content_type: Optional[str] = "full_novel"
    # 创作需求
    novel_name: Optional[str] = None
    novel_description: Optional[str] = None
    core_requirement: Optional[str] = None
    genre: Optional[str] = None
    total_words: Optional[int] = None
    core_hook: Optional[str] = None
    target_platform: Optional[str] = None
    chapter_word_count: Optional[int] = 2000
    start_chapter: Optional[int] = 1
    end_chapter: Optional[int] = 10
    skip_plan_confirmation: Optional[bool] = False
    skip_chapter_confirmation: Optional[bool] = False
    allow_plot_adjustment: Optional[bool] = False


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict] = None
    bible: Optional[Dict] = None


class ChapterSummary(BaseModel):
    id: int
    chapter_index: int
    title: Optional[str]
    word_count: int
    quality_score: float
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str]
    content_type: str
    status: str
    config: Optional[Dict] = None
    bible: Optional[Dict] = None
    file_path: Optional[str]
    overall_quality_score: float
    dimension_average_scores: Optional[Dict] = None
    writer_perspective: Optional[str] = None
    perspective_strength: float = 0.7
    use_perspective_critic: bool = True
    created_at: datetime
    updated_at: datetime
    chapters: Optional[List[ChapterSummary]] = None
    current_generation_task: Optional[GenerationTaskResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectListResponse(BaseModel):
    total: int
    items: List[ProjectResponse]


class WorkflowRunListResponse(BaseModel):
    total: int
    items: List[WorkflowRunResponse]


# ========== Chapter ==========

class ChapterResponse(BaseModel):
    id: int
    project_id: int
    chapter_index: int
    title: Optional[str]
    content: str
    word_count: int
    quality_score: float
    status: str
    agent_logs: Optional[Dict] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None


# ========== Analytics ==========

class QualityAnalytics(BaseModel):
    overall_quality_score: float
    dimension_average_scores: Dict[str, float]
    chapter_scores: List[Dict]
    total_chapters: int
    passed_chapters: int


# ========== Error ==========

class ErrorResponse(BaseModel):
    detail: str
