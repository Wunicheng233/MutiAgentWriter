import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useNavigate } from 'react-router-dom'

import { Card, Badge, Button, Progress, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, Empty, StatsCard, Skeleton } from '../components/v2'
import type { BadgeVariant } from '../components/v2'
import { useProjectStore, type ProjectStatus } from '../store/useProjectStore'
import { getProject, getProjectWorkflowRuns, listChapters } from '../utils/endpoints'
import { getProjectStatusText, getTaskStatusText } from '../utils/workflow'

function getChapterStatusColor(status: string): BadgeVariant {
  switch (status) {
    case 'generated':
      return 'success'
    case 'edited':
      return 'agent'
    case 'draft':
      return 'secondary'
    default:
      return 'secondary'
  }
}

function getRunStatusColor(status: string): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success'
    case 'running':
      return 'status'
    case 'waiting_confirm':
      return 'warning'
    case 'failed':
    case 'cancelled':
      return 'error'
    default:
      return 'secondary'
  }
}

function getRunStatusText(status: string): string {
  switch (status) {
    case 'pending':
      return '待执行'
    case 'running':
      return '执行中'
    case 'waiting_confirm':
      return '等待确认'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    case 'cancelled':
      return '已取消'
    default:
      return status
  }
}

function getRunKindText(runKind: string): string {
  switch (runKind) {
    case 'generation':
      return '首次生成'
    case 'regeneration':
      return '重新生成'
    case 'revision':
      return '修订'
    case 'publish':
      return '发布'
    default:
      return runKind
  }
}

function formatDateTime(value?: string): string {
  if (!value) return '暂无'
  return new Date(value).toLocaleString()
}

export const ChapterList: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const projectId = id ? parseInt(id, 10) : 0
  const isValidProjectId = !Number.isNaN(projectId) && projectId > 0

  const setCurrentProject = useProjectStore(state => state.setCurrentProject)
  const setProjectStatus = useProjectStore(state => state.setProjectStatus)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: isValidProjectId,
  })

  // 初始化 ProjectStore
  useEffect(() => {
    if (!project || !id) return

    setCurrentProject(id, project.name)

    const progress = project.current_generation_task?.progress ?? 0
    const progressPercent = project.status === 'completed' ? 100 : progress * 100
    setProjectStatus(project.status as ProjectStatus, progressPercent)
  }, [id, project, setCurrentProject, setProjectStatus])

  const { data: chapters, isLoading } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => listChapters(projectId),
    enabled: isValidProjectId,
  })

  const { data: workflowHistory } = useQuery({
    queryKey: ['project-workflow-runs', projectId],
    queryFn: () => getProjectWorkflowRuns(projectId, {
      limit: 6,
      include_steps: true,
      include_feedback_items: true,
    }),
    enabled: isValidProjectId && !!project,
  })

  const targetStart = project?.config?.start_chapter ?? 1
  const targetEnd = project?.config?.end_chapter ?? 10
  const targetChapters = Math.max(targetEnd - targetStart + 1, 0)
  const completedChapters = chapters?.length ?? 0
  const completionRate = targetChapters > 0 ? Math.min((completedChapters / targetChapters) * 100, 100) : 0
  const averageScore = chapters && chapters.length > 0
    ? chapters.reduce((sum, chapter) => sum + (chapter.quality_score || 0), 0) / chapters.length
    : 0
  const activeRun = workflowHistory?.items.find(run => run.status === 'running' || run.status === 'waiting_confirm')

  return (
    
      <div className="mx-auto max-w-content space-y-6">
        <Card className="border-[var(--border-default)] bg-[linear-gradient(135deg,rgba(91,127,110,0.08),rgba(255,255,255,0.95),rgba(163,139,90,0.05))]">
          <div className="flex flex-col gap-5">
            {/* 顶部标题栏 - 标题+状态在左，返回按钮在右 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-semibold text-[var(--text-primary)]">
                  章节与运行记录
                  {project && <span className="ml-3 text-lg font-normal text-[var(--text-secondary)]">· {project.name}</span>}
                </h1>
                {project && <Badge variant="secondary">{getProjectStatusText(project.status)}</Badge>}
                {project?.current_generation_task && (
                  <Badge variant={project.current_generation_task.status === 'waiting_confirm' ? 'warning' : 'status'} className={project.current_generation_task.status === 'running' ? 'badge-pulse' : ''}>
                    {getTaskStatusText(project.current_generation_task)}
                  </Badge>
                )}
              </div>
              <Link to={`/projects/${id}/overview`}>
                <Button variant="secondary">返回概览</Button>
              </Link>
            </div>

            {/* 进度条 + 统计卡片 */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-5">
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[var(--text-secondary)]">章节完成度</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{completedChapters}/{targetChapters || '-'} 章</p>
                </div>
                <Progress value={completionRate} className="h-2" />
              </div>

              {/* 四个统计卡片横向排列 */}
              <div className="flex gap-3 flex-wrap justify-center lg:justify-end">
                <StatsCard label="目标范围" value={`${targetStart} - ${targetEnd}`} />
                <StatsCard label="当前章节" value={completedChapters} variant="primary" />
                <StatsCard
                  label="平均评分"
                  value={averageScore > 0 ? averageScore.toFixed(1) : '待生成'}
                />
                <StatsCard label="历史运行" value={workflowHistory?.total ?? 0} />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-[var(--border-default)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)]">Chapters</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">章节列表</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to={`/projects/${id}/analytics`}>
                  <Button variant="secondary">质量分析</Button>
                </Link>
              </div>
            </div>

            {isLoading && (
                <div className="mt-5 space-y-3">
                  <Skeleton className="h-20 rounded-lg" />
                  <Skeleton className="h-20 rounded-lg" />
                  <Skeleton className="h-20 rounded-lg" />
                </div>
              )}

            <div className="space-y-3">
              {chapters?.map(chapter => (
                <div key={chapter.id} className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 transition-all duration-200 hover:border-[var(--border-strong)] group cursor-pointer" onClick={() => navigate(`/projects/${id}/editor/${chapter.chapter_index}`)}>
                  <div className="flex items-start justify-between gap-4">
                    {/* 左侧：章节信息 */}
                    <div className="min-w-0 flex-1">
                      {/* 标题 - 保证在同一行 */}
                      <h3 className="font-serif text-lg text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
                        {chapter.title || `第${chapter.chapter_index}章`}
                      </h3>
                      {/* 状态徽章 - 在标题下方 */}
                      <div className="mt-2">
                        <Badge variant={getChapterStatusColor(chapter.status)}>
                          {chapter.status === 'generated' ? '已生成' : chapter.status === 'edited' ? '已编辑' : '草稿'}
                        </Badge>
                      </div>
                      {/* 元信息 */}
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
                        <span>字数 {chapter.word_count}</span>
                        <span>评分 {chapter.quality_score?.toFixed(1) || '-'}</span>
                        <span>{formatDateTime(chapter.created_at)}</span>
                      </div>
                    </div>

                    {/* 右侧：更多操作下拉菜单 */}
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <button
                          className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-default)] hover:scale-105 active:bg-[var(--border-strong)] active:scale-95 transition-all duration-150"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                          </svg>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => navigate(`/projects/${id}/read/${chapter.chapter_index}`)}>
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            阅读
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => navigate(`/projects/${id}/editor/${chapter.chapter_index}`)}>
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            编辑
                          </span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}

              {!chapters?.length && (
                <Empty
                  icon="list"
                  title="还没有章节"
                  description="开始生成后，章节会在这里出现。你可以随时编辑和润色。"
                />
              )}
            </div>
          </Card>

          <Card className="border-[var(--border-default)]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)]">Workflow History</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">运行历史</h2>
              </div>
              {activeRun && (
                <Badge variant={getRunStatusColor(activeRun.status)} className="badge-pulse mt-3 md:mt-0">
                  当前活跃 Run #{activeRun.id}
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              {workflowHistory?.items.map(run => {
                const stepCount = run.steps?.length ?? 0
                const feedbackCount = run.feedback_items?.length ?? 0
                const isActive = run.status === 'running' || run.status === 'waiting_confirm'

                return (
                  <Link key={run.id} to={`/projects/${id}/workflows/${run.id}`}>
                    <div className={`rounded-comfortable border p-5 transition-all duration-200 hover:shadow-[var(--shadow-default)] hover:-translate-y-0.5 cursor-pointer ${
                      isActive
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                        : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--border-strong)]'
                    }`}>
                      <div className="flex flex-col md:flex-row md:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-medium text-[var(--text-primary)]">Run #{run.id}</h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant={getRunStatusColor(run.status)} className={isActive ? 'badge-pulse' : ''}>
                              {getRunStatusText(run.status)}
                            </Badge>
                            <Badge variant="secondary">{getRunKindText(run.run_kind)}</Badge>
                          </div>
                        </div>
                        <div className="text-sm text-[var(--text-secondary)] shrink-0 md:text-right md:mt-1">
                          <div>{formatDateTime(run.started_at)}</div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">当前节点</p>
                          <p className="mt-1 text-[var(--text-primary)] font-mono">{run.current_step_key || '暂无'}</p>
                        </div>
                        <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">当前章节</p>
                          <p className="mt-1 text-[var(--text-primary)]">{run.current_chapter ?? '项目级'}</p>
                        </div>
                        <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">步骤数</p>
                          <p className="mt-1 text-[var(--text-primary)]">{stepCount}</p>
                        </div>
                        <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">反馈项</p>
                          <p className="mt-1 text-[var(--text-primary)]">{feedbackCount}</p>
                        </div>
                      </div>

                      {run.feedback_items && run.feedback_items.length > 0 && (
                        <div className="mt-4 rounded-standard border border-[var(--accent-warm)]/15 bg-[var(--accent-warm)]/5 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2">最新反馈</p>
                          <p className="text-sm text-[var(--text-body)]">{run.feedback_items[0].content}</p>
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}

              {!workflowHistory?.items.length && (
                <Empty
                  icon="document"
                  title="还没有运行记录"
                  description="触发生成后，这里会开始沉淀项目运行记录，方便后续回放和问题定位。"
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    
  )
}

export default ChapterList
