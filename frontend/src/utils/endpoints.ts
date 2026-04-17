// API 端点封装
import api from './api'
import type {
  User,
  Token,
  Project,
  Chapter,
  GenerationTask,
  QualityAnalytics,
  ProjectCreate,
  ChapterUpdate,
} from '../types/api'

// ========== Auth ==========

export async function register(data: { username: string; email: string; password: string }): Promise<User> {
  const res = await api.post<User>('/auth/register', data)
  return res.data
}

export async function login(data: { username: string; password: string }): Promise<Token> {
  const res = await api.post<Token>('/auth/login', data)
  console.log('Login response:', res.data)
  if (res.data.access_token) {
    localStorage.setItem('access_token', res.data.access_token)
    console.log('Token saved to localStorage:', res.data.access_token)
  } else {
    console.error('No access_token in login response!', res.data)
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

export async function refreshApiKey(): Promise<User> {
  const res = await api.post<User>('/auth/refresh-api-key')
  return res.data
}

export async function updateApiKey(apiKey: string): Promise<User> {
  const res = await api.put<User>('/auth/api-key', { api_key: apiKey })
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

export async function updateProject(projectId: number, data: Partial<ProjectCreate>): Promise<Project> {
  const res = await api.put<Project>(`/projects/${projectId}`, data)
  return res.data
}

export async function deleteProject(projectId: number): Promise<{ status: string; message: string }> {
  const res = await api.delete<{ status: string; message: string }>(`/projects/${projectId}`)
  return res.data
}

export async function triggerGenerate(projectId: number): Promise<GenerationTask> {
  const res = await api.post<GenerationTask>(`/projects/${projectId}/generate`)
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

export async function getTaskStatus(taskId: string): Promise<any> {
  const res = await api.get(`/tasks/${taskId}`)
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

export async function createShareLink(projectId: number): Promise<{share_url: string; share_token: string}> {
  const res = await api.post(`/projects/${projectId}/share`)
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
