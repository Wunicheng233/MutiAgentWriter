// API 类型定义

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
  config?: Record<string, any>
  bible?: Record<string, any>
  file_path?: string
  overall_quality_score: number
  dimension_average_scores?: Record<string, number>
  created_at: string
  updated_at: string
  chapters?: Chapter[]
  current_generation_task?: GenerationTask
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
  agent_logs?: Record<string, any>
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
}

export interface QualityAnalytics {
  overall_quality_score: number
  dimension_average_scores: Record<string, number>
  chapter_scores: Array<{
    chapter_index: number
    title?: string
    quality_score: number
    status: string
  }>
  total_chapters: number
  passed_chapters: number
}

export interface ProjectCreate {
  name: string
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
  config?: Record<string, any>
}

export interface ChapterUpdate {
  title?: string
  content?: string
  status?: string
}
