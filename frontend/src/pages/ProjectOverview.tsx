import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { Card, Badge, Button, Progress, Divider, StatsCard } from '../components/v2'
import { useLayoutStore } from '../store/useLayoutStore'
import { useProjectStore, type ProjectStatus } from '../store/useProjectStore'
import type { BadgeVariant } from '../components/v2'
import {
  getProject,
  getProjectTokenStats,
  triggerGenerate,
} from '../utils/endpoints'
import type { GenerationTask, Project, WorkflowRun } from '../types/api'
import { useToast } from '../components/toastContext'
import { getErrorMessage } from '../utils/errorMessage'
import {
  getAgentStates,
  getProjectStatusText,
  getTaskStatusText,
  inferCurrentFlowStep,
} from '../utils/workflow'

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
      detail: task?.error_message || '建议检查任务状态后重新发起生成。',
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
  if (status === 'done') return 'success'
  if (status === 'active') return 'status'
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

  const setCurrentProject = useProjectStore(state => state.setCurrentProject)
  const setProjectStatus = useProjectStore(state => state.setProjectStatus)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: isValidProjectId,
  })

  // 初始化 ProjectStore
  useEffect(() => {
    if (!data || !id) return

    setCurrentProject(id, data.name)

    const progress = data.current_generation_task?.progress ?? 0
    const progressPercent = data.status === 'completed' ? 100 : progress * 100
    setProjectStatus(data.status as ProjectStatus, progressPercent)
  }, [id, data, setCurrentProject, setProjectStatus])

  const { data: tokenStats } = useQuery({
    queryKey: ['project-token-stats', projectId],
    queryFn: () => getProjectTokenStats(projectId),
    enabled: isValidProjectId && !!data,
  })

  const { autoExpandHeaderInProject, setHeaderCollapsed } = useLayoutStore()

  useEffect(() => {
    if (id && autoExpandHeaderInProject) {
      setHeaderCollapsed(false)
    }
  }, [id, autoExpandHeaderInProject, setHeaderCollapsed])

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

  if (isLoading) {
    return <p className="text-[var(--text-secondary)]">加载中...</p>
  }

  if (!data) {
    return <p className="text-[var(--text-secondary)]">项目不存在</p>
  }

  const config = data.config
  const workflow = data.current_generation_task?.current_workflow_run
  const runSummary = getRunSummary(data)
  const targetStart = config?.start_chapter ?? 1
  const targetEnd = config?.end_chapter ?? 10
  const completedChapters = data.chapters?.length ?? 0
  const completedChapterRatio = targetEnd >= targetStart ? Math.min((completedChapters / (targetEnd - targetStart + 1)) * 100, 100) : 0
  // 项目已完成时强制显示100%，否则用任务进度或章节完成率
  const workflowProgress = data.status === 'completed' ? 100 : data.current_generation_task ? Math.min(data.current_generation_task.progress * 100, 100) : completedChapterRatio
  const workflowMeta = renderWorkflowMeta(workflow)
  const agentStates = getAgentStates(data)

  return (
    <div className="mx-auto max-w-content space-y-6">
      {/* 顶部项目信息栏 */}
      <Card className="border-[var(--border-default)]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
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
          <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
            <span>目标章节 {targetStart} - {targetEnd}</span>
            <span>每章约 {config?.chapter_word_count ?? 2000} 字</span>
            {config?.genre && <span>{config.genre}</span>}
            {tokenStats && tokenStats.total_tokens > 0 && (
              <span>约 ${tokenStats.estimated_cost_usd.toFixed(4)}</span>
            )}
          </div>
        </div>

        <Divider className="my-4" />
        <div className="flex flex-col gap-4 md:flex-row md:justify-between">
          <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-semibold text-[var(--text-primary)]">{data.name}</h1>
              {config?.core_hook && (
                <p className="mt-2 text-[var(--text-secondary)]">{config.core_hook}</p>
              )}
            </div>
            <div className="w-full md:w-96 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--text-secondary)]">项目进度</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{Math.round(workflowProgress)}%</p>
              </div>
              <Progress value={workflowProgress} />
              <div className="flex flex-wrap gap-2">
                {runSummary.ctaHref ? (
                  <Link to={runSummary.ctaHref}>
                    <Button variant="primary" size="sm">{runSummary.ctaLabel}</Button>
                  </Link>
                ) : (
                  <Button variant="primary" size="sm" onClick={handleTriggerGenerate}>
                    {runSummary.ctaLabel}
                  </Button>
                )}
                {/* 主按钮不是"查看章节"时才显示章节按钮 */}
                {runSummary.ctaLabel !== '查看章节' && (
                  <Link to={`/projects/${projectId}/chapters`}>
                    <Button variant="secondary" size="sm">章节</Button>
                  </Link>
                )}
                <Link to={`/projects/${projectId}/outline`}>
                  <Button variant="secondary" size="sm">大纲</Button>
                </Link>
                <Link to={`/projects/${projectId}/export`}>
                  <Button variant="secondary" size="sm">导出</Button>
                </Link>
              </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-[var(--border-default)] p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">创作主路径</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            {flowSteps.map((step, _index) => {
              const status = getFlowStepStatus(data, step.key)
              const isDone = status === 'done'
              const isActive = status === 'active'

              return (
                <div
                  key={step.key}
                  className={`rounded-standard border p-4 text-center flex flex-col items-center ${
                    isActive
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                      : isDone
                        ? 'border-[var(--border-default)] bg-[var(--bg-secondary)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <div className={`text-lg font-medium mb-2 ${
                    isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                  }`}>
                    {step.title}
                  </div>
                  <Badge variant={getStepBadgeVariant(status)}>
                    {status === 'done' ? '已完成' : status === 'active' ? '进行中' : '待开始'}
                  </Badge>
                </div>
              )
            })}
          </div>
        </Card>

        <Card className="border-[var(--border-default)] p-6">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">当前运行</h2>

          <div className="space-y-3">
            {workflowMeta.length > 0 ? (
              workflowMeta.map(item => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-[var(--border-default)] last:border-0">
                  <span className="text-[var(--text-secondary)]">{item.label}</span>
                  <span className="font-medium text-[var(--text-primary)]">{item.value}</span>
                </div>
              ))
            ) : (
              <p className="text-[var(--text-secondary)] text-center py-4">暂无运行记录</p>
            )}

            <div className="grid grid-cols-2 gap-3 pt-3">
              <StatsCard label="开始时间" value={formatDateTime(data.current_generation_task?.started_at)} />
              <StatsCard
                label="当前章节"
                value={workflow?.current_chapter ?? data.current_generation_task?.current_chapter ?? '待生成'}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-[var(--border-default)] p-6">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">智能体状态</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {agentCards.map(agent => (
            <div
              key={agent.key}
              className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-center"
            >
              <h3 className="text-lg font-medium text-[var(--text-primary)]">{agent.title}</h3>
              <Badge variant={agentStates[agent.key] === 'done' ? 'success' : agentStates[agent.key] === 'running' ? 'status' : 'secondary'} className="mt-3">
                {agentStates[agent.key] === 'done' ? '已完成' : agentStates[agent.key] === 'running' ? '运行中' : '等待'}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default ProjectOverview
