// API 端点封装
import api from './api'
import type {
  User,
  Token,
  LLMConnectionTestResult,
  UpdateLLMSettingsPayload,
  GenerationQuota,
  GenerationPreflight,
  Project,
  ArtifactDetail,
  ArtifactListResponse,
  Chapter,
  GenerationTask,
  QualityAnalytics,
  ProjectCreate,
  ChapterUpdate,
  TaskStatus,
  WorkflowRun,
  WorkflowRunListResponse,
  SkillDefinition,
  EnabledSkillConfig,
  ChatRequest,
  ChatResponse,
  ProblemReport,
  ProblemReportCreate,
} from '../types/api'

// ========== Auth ==========

export async function register(data: { username: string; email: string; password: string }): Promise<User> {
  const res = await api.post<User>('/auth/register', data)
  return res.data
}

export async function login(data: { username: string; password: string }): Promise<Token> {
  const res = await api.post<Token>('/auth/login', data)
  if (res.data.access_token) {
    localStorage.setItem('access_token', res.data.access_token)
  }
  return res.data
}

export async function logout(): Promise<void> {
  localStorage.removeItem('access_token')
}

export async function getMe(): Promise<User> {
  const res = await api.get<User>('/auth/me')
  return res.data
}

export async function getGenerationQuota(): Promise<GenerationQuota> {
  const res = await api.get<GenerationQuota>('/auth/me/generation-quota')
  return res.data
}

export async function clearApiKey(): Promise<User> {
  const res = await api.delete<User>('/auth/api-key')
  return res.data
}

export async function updateApiKey(apiKey: string): Promise<User> {
  const res = await api.put<User>('/auth/api-key', { api_key: apiKey })
  return res.data
}

export async function updateLLMSettings(data: UpdateLLMSettingsPayload): Promise<User> {
  const res = await api.put<User>('/auth/llm-settings', data)
  return res.data
}

export async function resetLLMSettings(): Promise<User> {
  const res = await api.delete<User>('/auth/llm-settings')
  return res.data
}

export async function testLLMSettings(data: UpdateLLMSettingsPayload): Promise<LLMConnectionTestResult> {
  const res = await api.post<LLMConnectionTestResult>('/auth/llm-settings/test', data)
  return res.data
}

// ========== Feedback ==========

export async function submitProblemReport(data: ProblemReportCreate): Promise<ProblemReport> {
  const res = await api.post<ProblemReport>('/feedback/problem-reports', data)
  return res.data
}

// ========== Projects ==========

export async function listProjects(params?: { skip?: number; limit?: number }): Promise<{ total: number; items: Project[] }> {
  const res = await api.get<{ total: number; items: Project[] }>('/projects', { params })
  return res.data
}

export async function createProject(data: ProjectCreate): Promise<Project> {
  const res = await api.post<Project>('/projects', data)
  return res.data
}

export async function getProject(projectId: number): Promise<Project> {
  const res = await api.get<Project>(`/projects/${projectId}`)
  return res.data
}

export async function getGenerationPreflight(projectId: number): Promise<GenerationPreflight> {
  const res = await api.get<GenerationPreflight>(`/projects/${projectId}/generation-preflight`)
  return res.data
}

export async function getProjectWorkflowRuns(
  projectId: number,
  params?: { limit?: number; include_steps?: boolean; include_feedback_items?: boolean }
): Promise<WorkflowRunListResponse> {
  const res = await api.get<WorkflowRunListResponse>(`/projects/${projectId}/workflow-runs`, { params })
  return res.data
}

export async function getProjectWorkflowRun(
  projectId: number,
  runId: number,
  params?: { include_steps?: boolean; include_feedback_items?: boolean }
) : Promise<WorkflowRun> {
  const res = await api.get<WorkflowRun>(`/projects/${projectId}/workflow-runs/${runId}`, { params })
  return res.data
}

export async function getProjectArtifacts(
  projectId: number,
  params?: {
    limit?: number
    workflow_run_id?: number
    chapter_index?: number
    artifact_type?: string
    scope?: string
    current_only?: boolean
    include_content?: boolean
  }
): Promise<ArtifactListResponse> {
  const res = await api.get<ArtifactListResponse>(`/projects/${projectId}/artifacts`, { params })
  return res.data
}

export async function getProjectArtifact(
  projectId: number,
  artifactId: number
): Promise<ArtifactDetail> {
  const res = await api.get<ArtifactDetail>(`/projects/${projectId}/artifacts/${artifactId}`)
  return res.data
}

export async function updateProject(projectId: number, data: Partial<ProjectCreate>): Promise<Project> {
  const res = await api.put<Project>(`/projects/${projectId}`, data)
  return res.data
}

// ========== Skills ==========

export async function listSkills(): Promise<{ skills: SkillDefinition[] }> {
  const res = await api.get<{ skills: SkillDefinition[] }>('/skills')
  return res.data
}

export async function updateProjectSkills(
  projectId: number,
  data: { enabled: EnabledSkillConfig[] }
): Promise<Project> {
  const res = await api.post<Project>(`/projects/${projectId}/skills`, data)
  return res.data
}

export async function deleteProject(projectId: number): Promise<{ status: string; message: string }> {
  const res = await api.delete<{ status: string; message: string }>(`/projects/${projectId}`)
  return res.data
}

export async function triggerGenerate(projectId: number, regenerate: boolean = false): Promise<GenerationTask> {
  const res = await api.post<GenerationTask>(`/projects/${projectId}/generate?regenerate=${regenerate}`)
  return res.data
}

export async function cancelGeneration(projectId: number): Promise<{ status: string; message: string; cancelled_count: number }> {
  const res = await api.post<{ status: string; message: string; cancelled_count: number }>(`/projects/${projectId}/cancel-generation`)
  return res.data
}

export async function resumeGeneration(projectId: number): Promise<GenerationTask> {
  const res = await api.post<GenerationTask>(`/projects/${projectId}/resume-generation`)
  return res.data
}

export async function getProjectAnalytics(projectId: number): Promise<QualityAnalytics> {
  const res = await api.get<QualityAnalytics>(`/projects/${projectId}/analytics`)
  return res.data
}

// ========== Chapters ==========

export async function listChapters(projectId: number): Promise<Chapter[]> {
  const res = await api.get<Chapter[]>(`/projects/${projectId}/chapters`)
  return res.data
}

export async function getChapter(projectId: number, chapterIndex: number): Promise<Chapter> {
  const res = await api.get<Chapter>(`/projects/${projectId}/chapters/${chapterIndex}`)
  return res.data
}

export async function updateChapter(
  projectId: number,
  chapterIndex: number,
  data: ChapterUpdate
): Promise<Chapter> {
  const res = await api.put<Chapter>(`/projects/${projectId}/chapters/${chapterIndex}`, data)
  return res.data
}

export async function regenerateChapter(projectId: number, chapterIndex: number): Promise<GenerationTask> {
  const res = await api.post<GenerationTask>(`/projects/${projectId}/chapters/${chapterIndex}/regenerate`)
  return res.data
}

// ========== Tasks ==========

export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const res = await api.get<TaskStatus>(`/tasks/${taskId}`)
  return res.data
}

export async function confirmTask(
  taskId: string,
  approved: boolean,
  feedback: string = ''
): Promise<{success: boolean; new_task_id: string}> {
  const res = await api.post(`/tasks/${taskId}/confirm`, { approved, feedback })
  return res.data
}

// ========== Export ==========

export async function triggerExport(projectId: number, format: 'epub' | 'docx' | 'html'): Promise<GenerationTask> {
  const res = await api.post<GenerationTask>(`/projects/${projectId}/export?format=${format}`)
  return res.data
}

export function getExportDownloadUrl(projectId: number, taskId: number): string {
  return `${api.defaults.baseURL}/projects/${projectId}/export/download?task_id=${taskId}`
}

export async function downloadExportFile(
  projectId: number,
  taskId: number
): Promise<{ blob: Blob; filename: string }> {
  const res = await api.get<Blob>(`/projects/${projectId}/export/download`, {
    params: { task_id: taskId },
    responseType: 'blob',
  })

  const disposition = res.headers['content-disposition'] || ''
  const filenameMatch =
    disposition.match(/filename\*=UTF-8''([^;]+)/) ||
    disposition.match(/filename="?([^"]+)"?/)
  const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : `export-${projectId}-${taskId}`

  return {
    blob: res.data,
    filename,
  }
}

// ========== Chapter Versions ==========

export interface ChapterVersionInfo {
  id: number
  version_number: number
  word_count: number
  created_at: string
}

export interface ChapterVersionDetail extends ChapterVersionInfo {
  content: string
}

export async function listChapterVersions(
  projectId: number,
  chapterIndex: number
): Promise<{ versions: ChapterVersionInfo[] }> {
  const res = await api.get<{ versions: ChapterVersionInfo[] }>(
    `/projects/${projectId}/chapters/${chapterIndex}/versions`
  )
  return res.data
}

export async function getChapterVersion(
  projectId: number,
  chapterIndex: number,
  versionId: number
): Promise<ChapterVersionDetail> {
  const res = await api.get<ChapterVersionDetail>(
    `/projects/${projectId}/chapters/${chapterIndex}/versions/${versionId}`
  )
  return res.data
}

export async function restoreChapterVersion(
  projectId: number,
  chapterIndex: number,
  versionId: number
): Promise<Chapter> {
  const res = await api.post<Chapter>(
    `/projects/${projectId}/chapters/${chapterIndex}/versions/${versionId}/restore`
  )
  return res.data
}

// ========== Token Statistics ==========

export interface TokenStats {
  total_prompt_tokens: number
  total_completion_tokens: number
  total_tokens: number
  system_api_tokens?: number
  user_api_tokens?: number
  estimated_cost_usd: number
}

export interface MonthlyTokenStats extends TokenStats {
  month: string
}

export async function getProjectTokenStats(projectId: number): Promise<TokenStats> {
  const res = await api.get<TokenStats>(`/projects/${projectId}/token-stats`)
  return res.data
}

export async function getUserMonthlyTokenStats(): Promise<MonthlyTokenStats> {
  const res = await api.get<MonthlyTokenStats>('/auth/me/token-stats')
  return res.data
}

// ========== Sharing ==========

export interface SharedChapterInfo {
  chapter_index: number
  title: string
  word_count: number
}

export interface SharedProject {
  title: string
  description: string | null
  author: string
  chapters: SharedChapterInfo[]
}

export interface SharedChapterDetail {
  chapter_index: number
  title: string
  content: string
}

export interface ShareLinkStatus {
  exists: boolean
  share_url: string | null
  share_token: string | null
  is_active: boolean
  expires_at: string | null
  view_count: number
  last_viewed_at: string | null
}

export interface CreateShareLinkResult {
  share_url: string
  share_token: string
  expires_at: string | null
  view_count: number
  last_viewed_at: string | null
}

export async function getShareLinkStatus(projectId: number): Promise<ShareLinkStatus> {
  const res = await api.get<ShareLinkStatus>(`/projects/${projectId}/share`)
  return res.data
}

export async function createShareLink(projectId: number, expiresInDays: number = 7): Promise<CreateShareLinkResult> {
  const res = await api.post<CreateShareLinkResult>(`/projects/${projectId}/share`, { expires_in_days: expiresInDays })
  return res.data
}

export async function getSharedProject(token: string): Promise<SharedProject> {
  const res = await api.get<SharedProject>(`/share/${token}`)
  return res.data
}

export async function getSharedChapter(token: string, chapterIndex: number): Promise<SharedChapterDetail> {
  const res = await api.get<SharedChapterDetail>(`/share/${token}/chapters/${chapterIndex}`)
  return res.data
}

// ========== Collaboration ==========

export interface Collaborator {
  id: number
  username: string
  email: string
  role: string
  invited_at: string
}

export async function listCollaborators(projectId: number): Promise<Collaborator[]> {
  const res = await api.get<Collaborator[]>(`/projects/${projectId}/collaborators`)
  return res.data
}

export async function addCollaborator(projectId: number, username: string, role: string = 'viewer'): Promise<{status: string; message: string}> {
  const res = await api.post(`/projects/${projectId}/collaborators`, { username, role })
  return res.data
}

export async function removeCollaborator(projectId: number, collabId: number): Promise<{status: string; message: string}> {
  const res = await api.delete(`/projects/${projectId}/collaborators/${collabId}`)
  return res.data
}

export async function resetProject(projectId: number): Promise<{status: string; message: string}> {
  const res = await api.post(`/projects/${projectId}/reset`)
  return res.data
}

export async function cleanStuckTasks(projectId: number): Promise<{status: string; message: string; cleaned_count: number}> {
  const res = await api.post(`/projects/${projectId}/clean-stuck-tasks`)
  return res.data
}

// ========== Reading Progress ==========

export interface ReadingProgress {
  project_id: number
  chapter_index: number
  position: number
  percentage: number
  last_read_at: string
}

export async function getReadingProgress(
  projectId: number
): Promise<ReadingProgress> {
  const res = await api.get<ReadingProgress>(`/projects/${projectId}/progress`)
  return res.data
}

export async function saveReadingProgress(
  projectId: number,
  data: { chapter_index: number; position: number; percentage: number }
): Promise<{status: string}> {
  const res = await api.post(`/projects/${projectId}/progress`, data)
  return res.data
}

// ==================== Perspectives API ====================

export interface Perspective {
  id: string;
  name: string;
  genre: string;
  description: string;
  strength_recommended: number;
  builtin: boolean;
  strengths: string[];
  weaknesses: string[];
}

export interface PerspectiveDetail extends Perspective {
  preview: {
    planner_injection: string;
    writer_injection: string;
    critic_injection: string;
  };
}

export interface UpdateProjectPerspectiveRequest {
  perspective: string | null;
  perspective_strength: number;
  use_perspective_critic: boolean;
}

export async function listPerspectives(): Promise<{ perspectives: Perspective[] }> {
  const res = await api.get<{ perspectives: Perspective[] }>('/perspectives/')
  return res.data
}

export async function getPerspectiveDetail(perspectiveId: string): Promise<PerspectiveDetail> {
  const res = await api.get<PerspectiveDetail>(`/perspectives/${perspectiveId}`)
  return res.data
}

export async function updateProjectPerspective(
  projectId: number,
  data: UpdateProjectPerspectiveRequest
): Promise<{
  status: string;
  writer_perspective: string | null;
  perspective_strength: number;
  use_perspective_critic: boolean;
}> {
  const res = await api.put(`/perspectives/project/${projectId}`, data)
  return res.data
}

// ========== AI Assistant ==========

export async function aiChat(request: ChatRequest): Promise<ChatResponse> {
  const response = await api.post<ChatResponse>('v1/ai/chat', request)
  return response.data
}
