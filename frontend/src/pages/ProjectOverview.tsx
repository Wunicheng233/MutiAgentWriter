import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { Card, Badge, Button, Input, Progress, AgentCard } from '../components/v2'
import type { BadgeVariant } from '../components/v2'
import SkillSelector from '../components/SkillSelector'
import {
  addCollaborator,
  cleanStuckTasks,
  createShareLink,
  downloadExportFile,
  getProjectArtifacts,
  getProject,
  getProjectTokenStats,
  getTaskStatus,
  listCollaborators,
  removeCollaborator,
  resetProject,
  triggerExport,
  triggerGenerate,
  updateProject,
} from '../utils/endpoints'
import type { GenerationTask, Project, WorkflowRun } from '../types/api'
import { useAuthStore } from '../store/useAuthStore'
import { useToast } from '../components/toastContext'
import { getErrorMessage } from '../utils/errorMessage'
import {
  getAgentStates,
  getProjectStatusText,
  getTaskStatusText,
  inferCurrentFlowStep,
} from '../utils/workflow'
import {
  getArtifactDisplayName,
  getArtifactScopeLabel,
} from '../utils/artifact'

type FlowStep = {
  key: string
  title: string
  description: string
}

type AgentCardConfig = {
  key: 'planner' | 'writer' | 'critic' | 'revise'
  title: string
  subtitle: string
}

type OverviewTab = 'workflow' | 'setup' | 'delivery'

const overviewTabs: Array<{ key: OverviewTab; label: string; description: string }> = [
  { key: 'workflow', label: '工作流', description: '当前进度、运行摘要和 Agent 状态' },
  { key: 'setup', label: '创作配置', description: '需求、模式、协作者和维护操作' },
  { key: 'delivery', label: '质量交付', description: '评分、导出、分享和 artifacts' },
]

const flowSteps: FlowStep[] = [
  {
    key: 'idea',
    title: '创意设定',
    description: '整理题材、核心钩子和目标章节范围',
  },
  {
    key: 'plan',
    title: '策划拆解',
    description: 'Planner 生成设定圣经与分章大纲',
  },
  {
    key: 'draft',
    title: '章节生成',
    description: 'Writer 根据上下文和大纲产出初稿',
  },
  {
    key: 'review',
    title: '评审修订',
    description: 'Guardrails、Critic、Revise 组成质量闭环',
  },
  {
    key: 'deliver',
    title: '交付分享',
    description: '编辑、导出、创建分享链接，进入展示阶段',
  },
]

const agentCards: AgentCardConfig[] = [
  {
    key: 'planner',
    title: 'Planner',
    subtitle: '把需求扩成结构化设定与章节路线',
  },
  {
    key: 'writer',
    title: 'Writer',
    subtitle: '结合上下文与章节目标生成正文初稿',
  },
  {
    key: 'critic',
    title: 'Critic',
    subtitle: '按情节、人物、钩子、文笔、设定打分',
  },
  {
    key: 'revise',
    title: 'Revise',
    subtitle: '根据问题清单对章节进行定向修订',
  },
]

function getProjectStatusColor(status: string): BadgeVariant {
  switch (status) {
    case 'draft':
      return 'secondary'
    case 'generating':
      return 'warning'
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    default:
      return 'secondary'
  }
}

function getTaskStatusColor(task?: GenerationTask | null): BadgeVariant {
  if (!task) return 'secondary'

  switch (task.status) {
    case 'success':
      return 'success'
    case 'waiting_confirm':
      return 'warning'
    case 'failure':
      return 'error'
    case 'progress':
    case 'started':
    case 'pending':
      return 'warning'
    default:
      return 'secondary'
  }
}

function formatDateTime(value?: string): string {
  if (!value) return '暂无'
  return new Date(value).toLocaleString()
}

function getFlowStepStatus(project: Project, stepKey: string): 'done' | 'active' | 'idle' {
  const currentStep = inferCurrentFlowStep(project)
  const currentIndex = flowSteps.findIndex(step => step.key === currentStep)
  const stepIndex = flowSteps.findIndex(step => step.key === stepKey)

  if (project.status === 'completed') return 'done'
  if (project.status === 'draft') {
    if (stepKey === 'idea') return 'active'
    return 'idle'
  }
  if (stepIndex < currentIndex) return 'done'
  if (stepIndex === currentIndex) return 'active'
  return 'idle'
}

function getRunSummary(project: Project): {
  headline: string
  detail: string
  ctaLabel: string
  ctaHref?: string
} {
  const task = project.current_generation_task
  const workflow = task?.current_workflow_run

  if (project.status === 'draft') {
    return {
      headline: '项目还未开始生成',
      detail: '现在最适合从这一页直接启动比赛主路径，先产出策划方案，再进入章节创作。',
      ctaLabel: '开始生成',
    }
  }

  if (task?.status === 'waiting_confirm') {
    if (workflow?.current_chapter === 0) {
      return {
        headline: '策划方案正在等待人工确认',
        detail: '这一步最能体现人在环路。确认后系统会继续进入逐章生成。',
        ctaLabel: '进入写作台',
        ctaHref: `/projects/${project.id}/write/1`,
      }
    }
    return {
      headline: `第 ${workflow?.current_chapter || task.current_chapter || 1} 章正在等待人工确认`,
      detail: '当前章节已经过多 Agent 流程处理，现在需要作者决定继续通过还是给出修改意见。',
      ctaLabel: '处理当前章节',
      ctaHref: `/projects/${project.id}/write/${workflow?.current_chapter || task.current_chapter || 1}`,
    }
  }

  if (project.status === 'completed') {
    return {
      headline: '作品已经进入可交付状态',
      detail: '现在可以从这一页直接查看质量分析、导出文件或创建只读分享链接。',
      ctaLabel: '查看章节',
      ctaHref: `/projects/${project.id}/chapters`,
    }
  }

  if (project.status === 'failed' || task?.status === 'failure') {
    return {
      headline: '最近一次运行失败',
      detail: task?.error_message || '建议检查任务状态后重新发起生成，或者先清理卡住的任务队列。',
      ctaLabel: '重新生成',
    }
  }

  return {
    headline: '多 Agent 创作流程正在运行',
    detail: task?.current_step || '系统正在推进当前工作流，你可以从章节页观察实时结果。',
    ctaLabel: '查看章节',
    ctaHref: `/projects/${project.id}/chapters`,
  }
}

function getModeLabel(project: Project): string {
  const config = project.config
  if (!config) return '标准模式'

  if (config.skip_plan_confirmation && config.skip_chapter_confirmation) {
    return '全自动生成'
  }
  if (!config.skip_plan_confirmation && config.skip_chapter_confirmation) {
    return '策划确认模式'
  }
  if (!config.skip_plan_confirmation && !config.skip_chapter_confirmation) {
    return '逐章共创模式'
  }
  return '章节接管模式'
}

function getStepBadgeVariant(status: 'done' | 'active' | 'idle'): BadgeVariant {
  if (status === 'done') return 'agent'
  if (status === 'active') return 'status'
  return 'secondary'
}

function getAgentBadgeVariant(status: 'idle' | 'running' | 'done' | 'error'): BadgeVariant {
  if (status === 'done') return 'agent'
  if (status === 'running') return 'status'
  if (status === 'error') return 'genre'
  return 'secondary'
}

function renderWorkflowMeta(workflow?: WorkflowRun): Array<{ label: string; value: string }> {
  if (!workflow) return []

  return [
    { label: '运行 ID', value: `#${workflow.id}` },
    { label: '运行类型', value: workflow.run_kind },
    { label: '触发来源', value: workflow.trigger_source },
    { label: '当前节点', value: workflow.current_step_key || '等待系统推进' },
  ]
}

export const ProjectOverview: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const projectId = id ? parseInt(id, 10) : 0
  const isValidProjectId = !Number.isNaN(projectId) && projectId > 0
  const { showToast } = useToast()
  const user = useAuthStore(state => state.user)
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: isValidProjectId,
  })

  const { data: tokenStats } = useQuery({
    queryKey: ['project-token-stats', projectId],
    queryFn: () => getProjectTokenStats(projectId),
    enabled: isValidProjectId && !!data,
  })

  const { data: recentArtifacts } = useQuery({
    queryKey: ['project-artifacts', projectId, 'current'],
    queryFn: () => getProjectArtifacts(projectId, {
      limit: 4,
      current_only: true,
      include_content: false,
    }),
    enabled: isValidProjectId && !!data,
  })

  const { data: collaborators = [] } = useQuery({
    queryKey: ['collaborators', projectId],
    queryFn: () => listCollaborators(projectId),
    enabled: !!data,
  })

  const [exportPollingId, setExportPollingId] = useState<string | null>(null)
  const [exportTaskId, setExportTaskId] = useState<number | null>(null)
  const [exportProgress, setExportProgress] = useState(0)
  const [, setExportStep] = useState('')
  const [creatingShare, setCreatingShare] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [newCollaboratorUsername, setNewCollaboratorUsername] = useState('')
  const [addingCollaborator, setAddingCollaborator] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [activeTab, setActiveTab] = useState<OverviewTab>('workflow')
  const [editingConfig, setEditingConfig] = useState(false)
  const [cleaningStuck, setCleaningStuck] = useState(false)
  const [showCleanConfirm, setShowCleanConfirm] = useState(false)
  const [configForm, setConfigForm] = useState({
    skip_plan_confirmation: false,
    skip_chapter_confirmation: false,
    allow_plot_adjustment: false,
    chapter_word_count: 2000,
    start_chapter: 1,
    end_chapter: 10,
  })

  const updateConfigMutation = useMutation({
    mutationFn: () => updateProject(projectId, {
      config: {
        ...data?.config,
        ...configForm,
      },
    }),
    onSuccess: () => {
      showToast('配置已更新', 'success')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setEditingConfig(false)
    },
    onError: (error: unknown) => {
      showToast(getErrorMessage(error, '更新失败'), 'error')
    },
  })

  useEffect(() => {
    if (!data?.config) return

    setConfigForm({
      skip_plan_confirmation: data.config.skip_plan_confirmation ?? false,
      skip_chapter_confirmation: data.config.skip_chapter_confirmation ?? false,
      allow_plot_adjustment: data.config.allow_plot_adjustment ?? false,
      chapter_word_count: data.config.chapter_word_count ?? 2000,
      start_chapter: data.config.start_chapter ?? 1,
      end_chapter: data.config.end_chapter ?? 10,
    })
  }, [data])

  useEffect(() => {
    if (!data?.current_generation_task) return

    const shouldPoll =
      data.status === 'generating' ||
      data.current_generation_task.status === 'waiting_confirm'

    if (!shouldPoll) return

    const interval = window.setInterval(() => {
      void refetch()
    }, 3000)

    return () => window.clearInterval(interval)
  }, [data, refetch])

  const handleAddCollaborator = async () => {
    if (!newCollaboratorUsername.trim()) {
      showToast('请输入用户名', 'error')
      return
    }

    try {
      setAddingCollaborator(true)
      await addCollaborator(projectId, newCollaboratorUsername.trim())
      showToast('协作者添加成功', 'success')
      setNewCollaboratorUsername('')
      queryClient.invalidateQueries({ queryKey: ['collaborators', projectId] })
    } catch (error: unknown) {
      showToast(getErrorMessage(error, '添加失败'), 'error')
    } finally {
      setAddingCollaborator(false)
    }
  }

  const handleRemoveCollaborator = async (collabId: number) => {
    try {
      await removeCollaborator(projectId, collabId)
      showToast('协作者移除成功', 'success')
      queryClient.invalidateQueries({ queryKey: ['collaborators', projectId] })
    } catch (error: unknown) {
      showToast(getErrorMessage(error, '移除失败'), 'error')
    }
  }

  const handleResetProject = async () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true)
      setResetConfirmText('')
      return
    }

    if (resetConfirmText.trim() !== data?.name) {
      showToast('请输入完整项目名后再重置', 'error')
      return
    }

    try {
      setResetting(true)
      await resetProject(projectId)
      showToast('项目已重置为草稿，所有生成内容已清除', 'success')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setShowResetConfirm(false)
      setResetConfirmText('')
    } catch (error: unknown) {
      showToast(getErrorMessage(error, '重置失败'), 'error')
    } finally {
      setResetting(false)
    }
  }

  const handleCleanStuckTasks = async () => {
    if (!showCleanConfirm) {
      setShowCleanConfirm(true)
      return
    }

    try {
      setCleaningStuck(true)
      const result = await cleanStuckTasks(projectId)
      showToast(result.message, result.cleaned_count > 0 ? 'success' : 'info')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setShowCleanConfirm(false)
    } catch (error: unknown) {
      showToast(getErrorMessage(error, '清理失败'), 'error')
    } finally {
      setCleaningStuck(false)
    }
  }

  const handleTriggerGenerate = async () => {
    try {
      const isRegenerate = data?.status !== 'draft'
      await triggerGenerate(projectId, isRegenerate)
      showToast(isRegenerate ? '重新生成任务已提交，已有章节已清空' : '生成任务已提交', 'success')
      refetch()
    } catch (error: unknown) {
      showToast(getErrorMessage(error, '提交失败'), 'error')
    }
  }

  const handleTriggerExport = async (format: 'epub' | 'docx' | 'html') => {
    try {
      const task = await triggerExport(projectId, format)
      setExportPollingId(task.celery_task_id)
      setExportTaskId(task.id)
      setExportProgress(0)
      setExportStep(`准备导出 ${format}...`)
      showToast('导出任务已提交', 'success')
    } catch (error: unknown) {
      showToast(getErrorMessage(error, '提交失败'), 'error')
    }
  }

  const handleCreateShare = async () => {
    try {
      setCreatingShare(true)
      const result = await createShareLink(projectId)
      const fullUrl = `${window.location.origin}${result.share_url}`
      setShareUrl(fullUrl)
      await navigator.clipboard.writeText(fullUrl)
      showToast('分享链接已创建并复制到剪贴板', 'success')
    } catch (error: unknown) {
      showToast(getErrorMessage(error, '创建失败'), 'error')
    } finally {
      setCreatingShare(false)
    }
  }

  useEffect(() => {
    if (!exportPollingId || !exportTaskId) return

    const interval = window.setInterval(async () => {
      try {
        const status = await getTaskStatus(exportPollingId)
        setExportProgress(status.progress * 100)
        setExportStep(status.current_step || '')

        if (status.celery_state === 'SUCCESS') {
          const { blob, filename } = await downloadExportFile(projectId, exportTaskId)
          const downloadUrl = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = downloadUrl
          link.download = filename
          document.body.appendChild(link)
          link.click()
          link.remove()
          URL.revokeObjectURL(downloadUrl)
          setExportPollingId(null)
          setExportTaskId(null)
          showToast('导出完成，开始下载', 'success')
        }

        if (status.celery_state === 'FAILURE') {
          setExportPollingId(null)
          setExportTaskId(null)
          showToast(status.error || '导出失败', 'error')
        }
      } catch (error) {
        console.error(error)
      }
    }, 2000)

    return () => window.clearInterval(interval)
  }, [exportPollingId, exportTaskId, projectId, showToast])

  if (isLoading) {
    return (
      
        <p className="text-[var(--text-secondary)]">加载中...</p>
      
    )
  }

  if (!data) {
    return (
      
        <p className="text-[var(--text-secondary)]">项目不存在</p>
      
    )
  }

  const config = data.config
  const workflow = data.current_generation_task?.current_workflow_run
  const runSummary = getRunSummary(data)
  const targetStart = config?.start_chapter ?? 1
  const targetEnd = config?.end_chapter ?? 10
  const targetChapters = Math.max(targetEnd - targetStart + 1, 0)
  const completedChapters = data.chapters?.length ?? 0
  const completedChapterRatio = targetChapters > 0 ? Math.min((completedChapters / targetChapters) * 100, 100) : 0
  const workflowProgress = data.current_generation_task ? Math.min(data.current_generation_task.progress * 100, 100) : completedChapterRatio
  const workflowMeta = renderWorkflowMeta(workflow)
  const agentStates = getAgentStates(data)
  const isOwner = !!data && !!user && data.user_id === user.id

  return (
    
      <div className="mx-auto max-w-content space-y-8">
        <Card variant="elevated" className="overflow-hidden">
          <div className="flex flex-col gap-10 p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <Link to="/">
                  <Button variant="secondary" size="sm">返回书架</Button>
                </Link>
                <Badge variant={getProjectStatusColor(data.status)}>
                  {getProjectStatusText(data.status)}
                </Badge>
                <Badge variant={getTaskStatusColor(data.current_generation_task)}>
                  {getTaskStatusText(data.current_generation_task)}
                </Badge>
                <Badge variant="secondary">{getModeLabel(data)}</Badge>
              </div>

              <h1 className="text-[clamp(2rem,4vw,2.75rem)] leading-tight">{data.name}</h1>
              <p className="mt-4 max-w-xl text-[var(--text-body)]">
                {data.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
                <span>目标章节 {targetStart} - {targetEnd}</span>
                <span>每章约 {config?.chapter_word_count ?? 2000} 字</span>
                {config?.genre && <span>{config.genre}</span>}
              </div>

              {config?.core_hook && (
                <div className="mt-6 rounded-comfortable border border-terracotta/15 bg-terracotta/5 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-terracotta/70">Concept</p>
                  <p className="mt-2 text-lg text-[var(--text-primary)]">{config.core_hook}</p>
                </div>
              )}
            </div>

            <div className="w-full max-w-lg rounded-2xl border border-sage/15 bg-sage/5 p-6">
              <p className="text-xs uppercase tracking-[0.25em] text-sage">Current Focus</p>
              <h2 className="mt-3 text-xl">{runSummary.headline}</h2>
              <p className="mt-2 text-[var(--text-secondary)]">{runSummary.detail}</p>

              <div className="mt-6">
                <Progress value={workflowProgress} />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {runSummary.ctaHref ? (
                  <Link to={runSummary.ctaHref}>
                    <Button variant="primary">{runSummary.ctaLabel}</Button>
                  </Link>
                ) : (
                  <Button variant="primary" onClick={handleTriggerGenerate}>
                    {runSummary.ctaLabel}
                  </Button>
                )}
                <Link to={`/projects/${projectId}/chapters`}>
                  <Button variant="secondary">查看章节</Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>

        {exportPollingId && (
          <Progress value={exportProgress} />
        )}

        <div className="grid gap-3 rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-2 shadow-ambient md:grid-cols-3">
          {overviewTabs.map(tab => {
            const active = activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-standard px-4 py-3 text-left transition-all ${
                  active
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-ambient'
                    : 'text-[var(--text-secondary)] hover:bg-white/50 hover:text-[var(--text-primary)]'
                }`}
              >
                <span className="block font-sans text-sm font-medium">{tab.label}</span>
                <span className="mt-1 block text-xs leading-relaxed">{tab.description}</span>
              </button>
            )
          })}
        </div>

        <div className={`${activeTab === 'workflow' ? 'grid' : 'hidden'} gap-6 xl:grid-cols-[1.3fr_0.9fr]`}>
          <Card className="p-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)]">Flow Story</p>
                <h2 className="mt-2 text-2xl">创作主路径</h2>
              </div>
              <Badge variant="secondary">Workflow First</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              {flowSteps.map((step, index) => {
                const status = getFlowStepStatus(data, step.key)

                return (
                  <div
                    key={step.key}
                    className={`rounded-comfortable border p-4 ${
                      status === 'active'
                        ? 'border-sage/35 bg-sage/10'
                        : status === 'done'
                          ? 'border-sage/20 bg-[var(--bg-secondary)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-[var(--text-secondary)]">0{index + 1}</span>
                      <Badge variant={getStepBadgeVariant(status)}>
                        {status === 'done' ? 'done' : status === 'active' ? 'now' : 'next'}
                      </Badge>
                    </div>
                    <h3 className="mt-4 text-lg">{step.title}</h3>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{step.description}</p>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-8">
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)]">Run Detail</p>
            <h2 className="mt-2 text-2xl">当前运行</h2>

            <div className="mt-6 space-y-3">
              {workflowMeta.length > 0 ? (
                workflowMeta.map(item => (
                  <div key={item.label} className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">{item.label}</p>
                    <p className="mt-1 text-body">{item.value}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-standard border border-dashed border-[var(--border-default)] p-4 text-[var(--text-secondary)]">
                  当前还没有活动中的 workflow run。启动生成后，这里会展示真实运行状态。
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                  <p className="text-[var(--text-secondary)]">开始时间</p>
                  <p className="mt-1 text-body">{formatDateTime(data.current_generation_task?.started_at)}</p>
                </div>
                <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                  <p className="text-[var(--text-secondary)]">当前章节</p>
                  <p className="mt-1 text-body">
                    {workflow?.current_chapter ?? data.current_generation_task?.current_chapter ?? '待生成'}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className={`${activeTab === 'workflow' ? 'block' : 'hidden'} p-8`}>
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)]">Agent Strip</p>
              <h2 className="mt-2 text-2xl">智能体状态</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {agentCards.map(agent => (
              <AgentCard
                key={agent.key}
                name={agent.title}
                subtitle={agent.subtitle}
                status={agentStates[agent.key]}
              />
            ))}
          </div>
        </Card>

        <div className={`${activeTab === 'setup' || activeTab === 'delivery' ? 'grid' : 'hidden'} gap-8 xl:grid-cols-[1.1fr_0.9fr]`}>
          <Card className={`${activeTab === 'setup' ? 'p-8' : 'hidden'}`}>
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)]">Project Setup</p>
                <h2 className="mt-2 text-2xl">创作配置</h2>
              </div>
              {data.status === 'draft' && (
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => setEditingConfig(!editingConfig)}
                >
                  {editingConfig ? '取消编辑' : '编辑配置'}
                </Button>
              )}
            </div>

            {!editingConfig ? (
              <div className="mt-5 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <p className="text-[var(--text-secondary)]">小说名称</p>
                    <p className="mt-1 text-body">{config?.novel_name || data.name}</p>
                  </div>
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <p className="text-[var(--text-secondary)]">生成模式</p>
                    <p className="mt-1 text-body">{getModeLabel(data)}</p>
                  </div>
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <p className="text-[var(--text-secondary)]">章节范围</p>
                    <p className="mt-1 text-body">{targetStart} - {targetEnd}</p>
                  </div>
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <p className="text-[var(--text-secondary)]">Token 消耗</p>
                    <p className="mt-1 text-body">
                      {tokenStats && tokenStats.total_tokens > 0
                        ? `${tokenStats.total_tokens.toLocaleString()} tokens`
                        : '尚无消耗记录'}
                    </p>
                    {tokenStats && tokenStats.total_tokens > 0 && (
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">约 ${tokenStats.estimated_cost_usd.toFixed(4)}</p>
                    )}
                  </div>
                </div>

                {config?.core_requirement && (
                  <div className="rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Core Requirement</p>
                    <div className="mt-3 max-h-72 overflow-y-auto whitespace-pre-line pr-2 text-body">
                      {config.core_requirement}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <p className="text-[var(--text-secondary)]">跳过策划确认</p>
                    <p className="mt-1 text-body">{config?.skip_plan_confirmation ? '是' : '否'}</p>
                  </div>
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <p className="text-[var(--text-secondary)]">跳过章节确认</p>
                    <p className="mt-1 text-body">{config?.skip_chapter_confirmation ? '是' : '否'}</p>
                  </div>
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <p className="text-[var(--text-secondary)]">允许剧情调整</p>
                    <p className="mt-1 text-body">{config?.allow_plot_adjustment ? '是' : '否'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="每章字数"
                    type="number"
                    value={configForm.chapter_word_count}
                    onChange={event => setConfigForm(prev => ({ ...prev, chapter_word_count: parseInt(event.target.value, 10) || 0 }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="起始章节"
                    type="number"
                    value={configForm.start_chapter}
                    onChange={event => setConfigForm(prev => ({ ...prev, start_chapter: parseInt(event.target.value, 10) || 1 }))}
                  />
                  <Input
                    label="结束章节"
                    type="number"
                    value={configForm.end_chapter}
                    onChange={event => setConfigForm(prev => ({ ...prev, end_chapter: parseInt(event.target.value, 10) || 1 }))}
                  />
                </div>
                <div className="space-y-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={configForm.skip_plan_confirmation}
                      onChange={event => setConfigForm(prev => ({ ...prev, skip_plan_confirmation: event.target.checked }))}
                      className="rounded border-[var(--border-default)] text-sage focus:ring-sage"
                    />
                    <span>跳过策划方案人工确认</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={configForm.skip_chapter_confirmation}
                      onChange={event => setConfigForm(prev => ({ ...prev, skip_chapter_confirmation: event.target.checked }))}
                      className="rounded border-[var(--border-default)] text-sage focus:ring-sage"
                    />
                    <span>跳过章节级人工确认</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={configForm.allow_plot_adjustment}
                      onChange={event => setConfigForm(prev => ({ ...prev, allow_plot_adjustment: event.target.checked }))}
                      className="rounded border-[var(--border-default)] text-sage focus:ring-sage"
                    />
                    <span>允许每章后调整下一章剧情</span>
                  </label>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    variant="primary"
                    onClick={() => updateConfigMutation.mutate()}
                    disabled={updateConfigMutation.isPending}
                  >
                    {updateConfigMutation.isPending ? '保存中...' : '保存配置'}
                  </Button>
                </div>
              </div>
            )}

            {/* Skill 配置 */}
            <div className="mt-8 pt-6 border-t border-[var(--border-default)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                    Skill Runtime
                  </p>
                  <h2 className="mt-1 text-2xl">启用创作 Skill</h2>
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                Skill 会按 Planner、Writer、Revise 的职责精确注入，Critic 保持中立质量标尺。
              </p>
              <SkillSelector
                projectId={projectId}
                enabledSkills={config?.skills?.enabled ?? []}
              />
            </div>
          </Card>

          <div className={activeTab === 'delivery' ? 'space-y-8' : 'hidden'}>
            <Card className="p-8">
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)]">Quality</p>
              <h2 className="mt-2 text-2xl">质量与交付</h2>

              <div className="mt-6 space-y-4">
                {data.overall_quality_score > 0 ? (
                  <div>
                    <p className="text-sm text-[var(--text-secondary)] mb-2">总体评分 {data.overall_quality_score.toFixed(1)}/10</p>
                    <Progress value={data.overall_quality_score * 10} />
                  </div>
                ) : (
                  <div className="rounded-standard border border-dashed border-[var(--border-default)] p-4 text-[var(--text-secondary)]">
                    尚无评分数据。完成至少一章评审后，这里会显示质量闭环结果。
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                    <p className="text-[var(--text-secondary)]">已完成章节</p>
                    <p className="mt-1 text-body">{completedChapters}</p>
                  </div>
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                    <p className="text-[var(--text-secondary)]">分享状态</p>
                    <p className="mt-1 text-body">{shareUrl ? '已生成链接' : '待创建'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link to={`/projects/${projectId}/analytics`}>
                    <Button variant="secondary">查看详细质量分析</Button>
                  </Link>
                  {data.status !== 'draft' && (
                    <Button variant="secondary" onClick={() => setShowCleanConfirm(true)} disabled={cleaningStuck}>
                      清理任务队列
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">Delivery</p>
              <h2 className="mt-2 text-2xl">导出与分享</h2>

              {data.status === 'completed' ? (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={() => handleTriggerExport('epub')} disabled={!!exportPollingId}>
                      导出 EPUB
                    </Button>
                    <Button variant="secondary" onClick={() => handleTriggerExport('docx')} disabled={!!exportPollingId}>
                      导出 DOCX
                    </Button>
                    <Button variant="secondary" onClick={() => handleTriggerExport('html')} disabled={!!exportPollingId}>
                      导出 HTML
                    </Button>
                    <Button variant="secondary" onClick={handleCreateShare} disabled={creatingShare}>
                      {creatingShare ? '创建中...' : shareUrl ? '分享链接已复制' : '创建分享链接'}
                    </Button>
                  </div>
                  {shareUrl && (
                    <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3 text-sm text-[var(--text-secondary)] break-all">
                      {shareUrl}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-standard border border-dashed border-[var(--border-default)] p-4 text-[var(--text-secondary)]">
                  项目完成后即可在这里一键导出成品，并生成无需登录的只读分享页。
                </div>
              )}
            </Card>

            <Card>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">Current Artifacts</p>
              <h2 className="mt-2 text-2xl">当前关键产物</h2>
              <p className="mt-2 text-[var(--text-secondary)]">
                这些是项目当前版本的核心 artifacts。长期来看，它们会成为创作状态、评审结果和工作流回放的统一事实层。
              </p>

              <div className="mt-5 space-y-3">
                {recentArtifacts?.items.map(artifact => (
                  <div key={artifact.id} className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[var(--text-primary)]">{getArtifactDisplayName(artifact.artifact_type)}</span>
                          <Badge variant="secondary">{artifact.scope}</Badge>
                          {artifact.is_current && <Badge variant="agent">current</Badge>}
                        </div>
                        <div className="mt-2 text-[var(--text-secondary)]">
                          v{artifact.version_number} · {getArtifactScopeLabel(artifact)} · {artifact.source}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link to={`/projects/${projectId}/artifacts/${artifact.id}`}>
                          <Button variant="tertiary" size="sm">查看详情</Button>
                        </Link>
                        {artifact.workflow_run_id && (
                          <Link to={`/projects/${projectId}/workflows/${artifact.workflow_run_id}`}>
                            <Button variant="tertiary" size="sm">查看 Run</Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {!recentArtifacts?.items.length && (
                  <div className="rounded-standard border border-dashed border-[var(--border-default)] p-4 text-[var(--text-secondary)]">
                    还没有沉淀可展示的当前 artifacts。
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {isOwner && activeTab === 'setup' && (
          <Card>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">Team</p>
            <h2 className="mt-2 text-2xl">协作者</h2>

            <div className="mt-5 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="flex-1">
                  <Input
                    label="用户名"
                    placeholder="输入已注册用户名"
                    value={newCollaboratorUsername}
                    onChange={event => setNewCollaboratorUsername(event.target.value)}
                  />
                </div>
                <div className="pt-[26px]">
                  <Button variant="primary" onClick={handleAddCollaborator} disabled={addingCollaborator}>
                    {addingCollaborator ? '添加中...' : '添加协作者'}
                  </Button>
                </div>
              </div>

              {collaborators.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {collaborators.map(collab => (
                    <div key={collab.id} className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-[var(--text-primary)]">{collab.username}</div>
                          <div className="mt-1 text-sm text-[var(--text-secondary)]">{collab.email}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">{collab.role}</div>
                        </div>
                        <Button variant="tertiary" size="sm" onClick={() => handleRemoveCollaborator(collab.id)}>
                          移除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[var(--text-secondary)]">暂无协作者。比赛演示时可以用这一块证明作品支持多人参与和协作浏览。</p>
              )}
            </div>
          </Card>
        )}

        {showCleanConfirm && activeTab === 'delivery' && (
          <div className="rounded-standard border border-muted-gold/35 bg-muted-gold/10 p-4">
            <p className="text-sm text-body">
              <strong>确认清理任务队列吗？</strong> 这会将所有未完成的任务标记为失败，但不会删除已经生成的章节内容。
            </p>
            <div className="mt-3 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowCleanConfirm(false)} disabled={cleaningStuck}>
                取消
              </Button>
              <Button variant="secondary" onClick={handleCleanStuckTasks} disabled={cleaningStuck}>
                {cleaningStuck ? '清理中...' : '确认清理'}
              </Button>
            </div>
          </div>
        )}

        {showResetConfirm && activeTab === 'setup' && (
          <div className="rounded-standard border border-terracotta/25 bg-terracotta/5 p-4">
            <p className="text-sm text-body">
              <strong>确认重置项目吗？</strong> 这会删除所有已生成章节和任务记录，项目将回到草稿状态。请输入完整项目名后再确认。
            </p>
            <div className="mt-3">
              <Input
                label={`输入项目名：${data.name}`}
                value={resetConfirmText}
                onChange={event => setResetConfirmText(event.target.value)}
              />
            </div>
            <div className="mt-3 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowResetConfirm(false)
                  setResetConfirmText('')
                }}
                disabled={resetting}
              >
                取消
              </Button>
              <Button
                variant="secondary"
                onClick={handleResetProject}
                disabled={resetting || resetConfirmText.trim() !== data.name}
              >
                {resetting ? '重置中...' : '确认重置'}
              </Button>
            </div>
          </div>
        )}

        {data.status !== 'draft' && activeTab === 'setup' && (
          <div className="flex justify-end">
            <Button variant="tertiary" onClick={handleResetProject}>
              展开重置确认
            </Button>
          </div>
        )}
      </div>
    
  )
}

export default ProjectOverview
