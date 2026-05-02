// API 类型定义
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export interface ProjectConfig {
  novel_name?: string
  novel_description?: string
  core_requirement?: string
  genre?: string
  total_words?: number
  core_hook?: string
  target_platform?: string
  chapter_word_count?: number
  start_chapter?: number
  end_chapter?: number
  skip_plan_confirmation?: boolean
  skip_chapter_confirmation?: boolean
  allow_plot_adjustment?: boolean
  skills?: ProjectSkillsConfig
  [key: string]: unknown
}

export interface ProjectSkillsConfig {
  enabled?: EnabledSkillConfig[]
  [key: string]: unknown
}

export interface SkillDefinition {
  id: string
  name: string
  description: string
  version: string
  author: string
  applies_to: string[]
  priority: number
  tags: string[]
  config_schema: Record<string, JsonValue>
  safety_tags: string[]
  dependencies: string[]
}

export interface EnabledSkillConfig {
  [key: string]: unknown
  skill_id: string
  applies_to_override?: string[]
  config?: Record<string, JsonValue>
}

export interface User {
  id: number
  username: string
  email: string
  api_key?: string
  is_active: boolean
  created_at: string
}

export interface Token {
  access_token: string
  token_type: string
  user: User
}

export interface Project {
  id: number
  user_id: number
  name: string
  description?: string
  content_type: string
  status: string
  config?: ProjectConfig
  bible?: Record<string, JsonValue>
  file_path?: string
  overall_quality_score: number
  dimension_average_scores?: Record<string, number>
  created_at: string
  updated_at: string
  chapters?: Chapter[]
  current_generation_task?: GenerationTask
  // 视角配置（部分 API 可能不返回这些字段）
  writer_perspective?: string | null
  perspective_strength?: number
  use_perspective_critic?: boolean
}

export interface ArtifactSummary {
  id: number
  workflow_run_id?: number
  chapter_id?: number
  artifact_type: string
  scope: string
  chapter_index?: number
  version_number: number
  is_current: boolean
  source: string
  created_at: string
}

export interface ArtifactDetail extends ArtifactSummary {
  content_text?: string | null
  content_json?: JsonValue[] | { [key: string]: JsonValue } | null
}

export interface WorkflowStepRun {
  id: number
  step_key: string
  step_type: string
  status: string
  attempt: number
  chapter_index?: number
  input_artifact_id?: number
  output_artifact_id?: number
  input_artifact?: ArtifactSummary
  output_artifact?: ArtifactSummary
  step_data?: Record<string, JsonValue>
  started_at: string
  completed_at?: string
}

export interface WorkflowFeedbackItem {
  id: number
  feedback_scope: string
  feedback_type: string
  action_type: string
  chapter_index?: number
  status: string
  content: string
  created_at: string
}

export interface WorkflowRun {
  id: number
  generation_task_id?: number
  parent_run_id?: number
  run_kind: string
  trigger_source: string
  status: string
  current_step_key?: string
  current_chapter?: number
  run_metadata?: Record<string, JsonValue>
  started_at: string
  completed_at?: string
  steps?: WorkflowStepRun[]
  feedback_items?: WorkflowFeedbackItem[]
}

export interface Chapter {
  id: number
  project_id: number
  chapter_index: number
  title?: string
  content: string
  word_count: number
  quality_score: number
  status: string
  agent_logs?: Record<string, JsonValue>
  created_at: string
  updated_at: string
}

export interface GenerationTask {
  id: number
  project_id: number
  celery_task_id: string
  status: string
  progress: number
  current_step?: string
  current_chapter?: number
  error_message?: string
  started_at: string
  completed_at?: string
  current_workflow_run?: WorkflowRun
}

export interface TaskStatus {
  progress: number
  current_step?: string
  current_chapter?: number
  celery_state?: string
  db_status?: string
  error?: string
}

export interface ChapterScore {
  chapter_index: number
  title?: string
  quality_score: number
  status: string
  word_count: number
}

export interface QualityAnalytics {
  overall_quality_score: number
  dimension_average_scores: Record<string, number>
  chapter_scores: ChapterScore[]
  total_chapters: number
  passed_chapters: number
}

export interface WorkflowRunListResponse {
  total: number
  items: WorkflowRun[]
}

export interface ArtifactListResponse {
  total: number
  items: ArtifactDetail[]
}

export interface ProjectCreate {
  name?: string
  description?: string
  content_type?: string
  novel_name?: string
  novel_description?: string
  core_requirement?: string
  genre?: string
  total_words?: number
  core_hook?: string
  target_platform?: string
  chapter_word_count?: number
  start_chapter?: number
  end_chapter?: number
  skip_plan_confirmation?: boolean
  skip_chapter_confirmation?: boolean
  allow_plot_adjustment?: boolean
  config?: ProjectConfig
}

export interface ChapterUpdate {
  title?: string
  content?: string
  status?: string
}

// ========== AI Assistant API ==========

export interface ChatRequest {
  user_input: string
  context?: Record<string, unknown>
}

export interface ChatResponse {
  content: string
}
