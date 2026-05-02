import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { Card, Badge, Button } from '../components/v2'
import type { BadgeVariant } from '../components/v2'
import {
  cleanStuckTasks,
  getProjectArtifacts,
  getProject,
  getProjectWorkflowRun,
  regenerateChapter,
  triggerGenerate,
} from '../utils/endpoints'
import type { JsonValue, WorkflowRun } from '../types/api'
import { getProjectStatusText } from '../utils/workflow'
import { useToast } from '../components/toastContext'
import {
  getArtifactDisplayName,
  getArtifactPreview,
  getArtifactScopeLabel,
} from '../utils/artifact'

function getRunStatusColor(status: string): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success'
    case 'running':
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

function getStepStatusColor(status: string): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success'
    case 'running':
    case 'waiting_confirm':
      return 'status'
    case 'failed':
    case 'cancelled':
      return 'error'
    default:
      return 'secondary'
  }
}

function formatDateTime(value?: string): string {
  if (!value) return '暂无'
  return new Date(value).toLocaleString()
}

function renderJsonValue(value: JsonValue): string {
  if (value === null) return 'null'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}


type WorkflowEvent = {
  at?: string
  percent?: number
  step?: string
  chapter?: number | null
  message?: string
}

const workflowV2ArtifactTypes = new Set([
  'scene_anchor_plan',
  'chapter_critique_v2',
  'repair_trace',
  'stitching_report',
  'novel_state_snapshot',
])

function isRecord(value: JsonValue | undefined): value is { [key: string]: JsonValue } {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function getWorkflowEvents(run: WorkflowRun): WorkflowEvent[] {
  const rawEvents = run.run_metadata?.event_log
  if (!Array.isArray(rawEvents)) return []
  return rawEvents
    .filter(isRecord)
    .map(event => ({
      at: typeof event.at === 'string' ? event.at : undefined,
      percent: typeof event.percent === 'number' ? event.percent : undefined,
      step: typeof event.step === 'string' ? event.step : undefined,
      chapter: typeof event.chapter === 'number' ? event.chapter : null,
      message: typeof event.message === 'string' ? event.message : undefined,
    }))
    .filter(event => event.message)
}

function getEventBadgeVariant(event: WorkflowEvent): BadgeVariant {
  const message = event.message || ''
  if (message.includes('Local Revise') || message.includes('Stitching')) return 'success'
  if (message.includes('Critic')) return 'status'
  if (message.includes('Failure Router')) return 'error'
  return 'secondary'
}

export const WorkflowRunDetail: React.FC = () => {
  const { id, runId } = useParams<{ id: string; runId: string }>()
  const projectId = id ? parseInt(id, 10) : 0
  const workflowRunId = runId ? parseInt(runId, 10) : 0
  const isValidParams = projectId > 0 && !Number.isNaN(workflowRunId)
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: isValidParams,
  })

  const { data: run, isLoading } = useQuery({
    queryKey: ['project-workflow-run', projectId, workflowRunId],
    queryFn: () => getProjectWorkflowRun(projectId, workflowRunId, {
      include_steps: true,
      include_feedback_items: true,
    }),
    enabled: isValidParams,
  })

  const { data: runArtifacts } = useQuery({
    queryKey: ['project-artifacts', projectId, 'run', workflowRunId],
    queryFn: () => getProjectArtifacts(projectId, {
      workflow_run_id: workflowRunId,
      include_content: true,
      limit: 20,
    }),
    enabled: isValidParams && !!run,
  })

  const restartProjectMutation = useMutation({
    mutationFn: (regenerate: boolean) => triggerGenerate(projectId, regenerate),
    onSuccess: () => {
      showToast('项目级重试任务已提交', 'success')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-workflow-runs', projectId] })
    },
    onError: () => {
      showToast('提交项目级重试失败', 'error')
    },
  })

  const regenerateChapterMutation = useMutation({
    mutationFn: (chapterIndex: number) => regenerateChapter(projectId, chapterIndex),
    onSuccess: () => {
      showToast('章节重生成任务已提交', 'success')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-workflow-runs', projectId] })
    },
    onError: () => {
      showToast('提交章节重生成失败', 'error')
    },
  })

  const cleanTasksMutation = useMutation({
    mutationFn: () => cleanStuckTasks(projectId),
    onSuccess: result => {
      showToast(result.message, result.cleaned_count > 0 ? 'success' : 'info')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-workflow-runs', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-workflow-run', projectId, workflowRunId] })
    },
    onError: () => {
      showToast('清理任务队列失败', 'error')
    },
  })

  if (isLoading) {
    return (
      
        <p className="text-[var(--text-secondary)]">加载中...</p>
      
    )
  }

  if (!run) {
    return (
      
        <p className="text-[var(--text-secondary)]">运行记录不存在</p>
      
    )
  }

  const eventLog = getWorkflowEvents(run)
  const metadataEntries = Object.entries(run.run_metadata || {}).filter(([key]) => key !== 'event_log')
  const stepCount = run.steps?.length ?? 0
  const feedbackCount = run?.feedback_items?.length ?? 0
  const workflowV2Artifacts = (runArtifacts?.items || []).filter(artifact => workflowV2ArtifactTypes.has(artifact.artifact_type))
  const hasRelatedChapter = typeof run?.current_chapter === 'number' && run.current_chapter > 0
  const isActiveRun = run?.status === 'running' || run?.status === 'waiting_confirm'
  const isFailedRun = run?.status === 'failed' || run?.status === 'cancelled'
  const currentActiveRunId = project?.current_generation_task?.current_workflow_run?.id
  const hasOtherActiveRun = !!currentActiveRunId && currentActiveRunId !== run.id

  if (!isValidParams) {
    return (
      
        <div className="mx-auto max-w-content text-center py-16">
          <p className="text-lg mb-2">Invalid page parameters</p>
          <p className="text-sm text-[var(--text-secondary)]">Please check the URL and try again.</p>
        </div>
      
    )
  }

  return (
    
      <div className="mx-auto max-w-content space-y-6">
        <Card className="border-[rgba(var(--accent-primary-rgb),0.20)] bg-[linear-gradient(135deg,rgba(var(--accent-primary-rgb),0.12),var(--bg-secondary),rgba(var(--accent-gold-rgb),0.08))] p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Link to={`/projects/${projectId}/chapters`}>
                  <Button variant="secondary" size="sm">返回章节</Button>
                </Link>
                {project && <Badge variant="secondary">{getProjectStatusText(project.status)}</Badge>}
                <Badge variant={getRunStatusColor(run.status)}>
                  {getRunStatusText(run.status)}
                </Badge>
                <Badge variant="secondary">{getRunKindText(run.run_kind)}</Badge>
              </div>

              <h1 className="text-3xl md:text-4xl font-medium">运行详情 #{run.id}</h1>
              {project && <p className="mt-2 text-[var(--text-secondary)]">{project.name}</p>}
            </div>

            <div className="grid w-full max-w-xl grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                <p className="text-sm text-[var(--text-secondary)]">开始时间</p>
                <p className="mt-1 font-medium">{formatDateTime(run.started_at)}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                <p className="text-sm text-[var(--text-secondary)]">结束时间</p>
                <p className="mt-1 font-medium">{formatDateTime(run.completed_at)}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                <p className="text-sm text-[var(--text-secondary)]">步骤数</p>
                <p className="mt-1 font-medium">{stepCount}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                <p className="text-sm text-[var(--text-secondary)]">反馈项</p>
                <p className="mt-1 font-medium">{feedbackCount}</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Run Summary</p>
            <h2 className="mt-2 text-2xl font-medium">运行摘要</h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Run 类型</p>
                <p className="mt-1 font-medium">{getRunKindText(run.run_kind)}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">触发来源</p>
                <p className="mt-1 font-medium">{run.trigger_source}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">当前节点</p>
                <p className="mt-1 font-medium">{run.current_step_key || '-'}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">当前章节</p>
                <p className="mt-1 font-medium">{run.current_chapter ?? '项目级'}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Generation Task</p>
                <p className="mt-1 font-medium">{run.generation_task_id ?? '-'}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">父级 Run</p>
                <p className="mt-1 font-medium">{run.parent_run_id ?? '-'}</p>
              </div>
            </div>

            {run.current_chapter ? (
              <div className="mt-5">
                <Link to={`/projects/${projectId}/editor/${run.current_chapter}`}>
                  <Button variant="secondary" size="sm">打开相关章节</Button>
                </Link>
              </div>
            ) : null}
          </Card>

          <Card className="p-6">
            <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Run Metadata</p>
            <h2 className="mt-2 text-2xl font-medium">上下文元数据</h2>

            {metadataEntries.length > 0 ? (
              <div className="mt-5 space-y-3">
                {metadataEntries.map(([key, value]) => (
                  <div key={key} className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <p className="font-medium text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">{key}</p>
                    <p className="mt-2 break-words font-medium">{renderJsonValue(value)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-standard border border-dashed border-[var(--border-default)] p-4 text-center text-[var(--text-secondary)]">
                无
              </div>
            )}
          </Card>
        </div>

        <Card className="p-6">
          <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Live Process</p>
          <h2 className="mt-2 text-2xl font-medium">生成过程事件流</h2>

          <div className="mt-5 space-y-3">
            {eventLog.slice().reverse().map((event, index) => (
              <div key={`${event.at || index}-${event.message}`} className="rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant={getEventBadgeVariant(event)}>{event.step || 'event'}</Badge>
                      {event.chapter ? <Badge variant="secondary">第 {event.chapter} 章</Badge> : null}
                      {typeof event.percent === 'number' ? (
                        <span className="text-sm text-[var(--text-secondary)]">{Math.round(event.percent * 100)}%</span>
                      ) : null}
                    </div>
                    <p className="mt-3">{event.message}</p>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] md:text-right">{formatDateTime(event.at)}</p>
                </div>
              </div>
            ))}

            {!eventLog.length && (
              <div className="rounded-standard border border-dashed border-[var(--border-default)] p-4 text-center text-[var(--text-secondary)]">
                无
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Workflow v2 Evidence</p>
          <h2 className="mt-2 text-2xl font-medium">局部诊断与修复证据</h2>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {workflowV2Artifacts.map(artifact => {
              const preview = getArtifactPreview(artifact, 360)

              return (
                <div key={artifact.id} className="rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-medium">{getArtifactDisplayName(artifact.artifact_type)}</h3>
                    <Badge variant="secondary">{getArtifactScopeLabel(artifact)}</Badge>
                    {artifact.is_current && <Badge variant="success">current</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    #{artifact.id} · v{artifact.version_number} · {formatDateTime(artifact.created_at)}
                  </p>
                  {preview && (
                    <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-xs">
                      {preview}
                    </pre>
                  )}
                  <div className="mt-3">
                    <Link to={`/projects/${projectId}/artifacts/${artifact.id}`}>
                      <Button variant="tertiary" size="sm">查看详情</Button>
                    </Link>
                  </div>
                </div>
              )
            })}

            {!workflowV2Artifacts.length && (
              <div className="rounded-standard border border-dashed border-[var(--border-default)] p-4 text-center text-[var(--text-secondary)] lg:col-span-2">
                无
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Recovery Actions</p>
          <h2 className="mt-2 text-2xl font-medium">恢复与下一步</h2>

          <div className="mt-5 flex flex-wrap gap-3">
            {run.status === 'waiting_confirm' && hasRelatedChapter && (
              <Link to={`/projects/${projectId}/overview?confirm-chapter=true`}>
                <Button variant="primary">处理章节确认</Button>
              </Link>
            )}

            {run.status === 'waiting_confirm' && run.current_chapter === 0 && (
              <Link to={`/projects/${projectId}/overview?confirm-plan=true`}>
                <Button variant="primary">处理策划确认</Button>
              </Link>
            )}

            {isFailedRun && hasRelatedChapter && (
              <Button
                variant="primary"
                onClick={() => regenerateChapterMutation.mutate(run.current_chapter!)}
                disabled={regenerateChapterMutation.isPending || hasOtherActiveRun}
              >
                {regenerateChapterMutation.isPending ? '提交中...' : '重生成章节'}
              </Button>
            )}

            {isFailedRun && (
              <Button
                variant="secondary"
                onClick={() => restartProjectMutation.mutate(true)}
                disabled={restartProjectMutation.isPending || hasOtherActiveRun}
              >
                {restartProjectMutation.isPending ? '提交中...' : '重新生成项目'}
              </Button>
            )}

            {run.status === 'running' && (
              <Button
                variant="secondary"
                onClick={() => cleanTasksMutation.mutate()}
                disabled={cleanTasksMutation.isPending}
              >
                {cleanTasksMutation.isPending ? '清理中...' : '清理卡住任务'}
              </Button>
            )}

            {hasOtherActiveRun && currentActiveRunId && (
              <Link to={`/projects/${projectId}/workflows/${currentActiveRunId}`}>
                <Button variant="secondary">查看活跃 Run</Button>
              </Link>
            )}

            {!isActiveRun && !isFailedRun && (
              <Link to={`/projects/${projectId}/chapters`}>
                <Button variant="secondary">返回章节</Button>
              </Link>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Artifacts</p>
          <h2 className="mt-2 text-2xl font-medium">运行产物</h2>

          <div className="mt-5 space-y-4">
            {runArtifacts?.items.map(artifact => {
              const preview = getArtifactPreview(artifact)

              return (
                <div key={artifact.id} className="rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-medium">{getArtifactDisplayName(artifact.artifact_type)}</h3>
                        <Badge variant="secondary">{artifact.scope}</Badge>
                        {artifact.is_current && <Badge variant="success">current</Badge>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
                        <span>v{artifact.version_number}</span>
                        <span>{artifact.source}</span>
                        <span>{getArtifactScopeLabel(artifact)}</span>
                        <span>{formatDateTime(artifact.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] md:text-right">
                      <div>#{artifact.id}</div>
                      <div className="mt-3">
                        <Link to={`/projects/${projectId}/artifacts/${artifact.id}`}>
                          <Button variant="tertiary" size="sm">查看详情</Button>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {preview && (
                    <div className="mt-4 rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
                      <p className="font-medium text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Preview</p>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{preview}</pre>
                    </div>
                  )}
                </div>
              )
            })}

            {!runArtifacts?.items.length && (
              <div className="rounded-standard border border-dashed border-[var(--border-default)] p-4 text-center text-[var(--text-secondary)]">
                无
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Step Timeline</p>
          <h2 className="mt-2 text-2xl font-medium">步骤时间线</h2>

          <div className="mt-5 space-y-4">
            {run.steps?.map((step, index) => {
              const contractSummary = step.step_data?.agent_contract
              const chapterNumber = step.chapter_index ?? run.current_chapter

              return (
                <div key={step.id} className="rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm text-[var(--text-secondary)]">0{index + 1}</span>
                        <h3 className="text-lg font-medium">{step.step_key}</h3>
                        <Badge variant={getStepStatusColor(step.status)}>
                          {getRunStatusText(step.status)}
                        </Badge>
                        <Badge variant="secondary">{step.step_type}</Badge>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
                        <span>尝试 {step.attempt}</span>
                        <span>章节 {chapterNumber ?? '项目级'}</span>
                        <span>{formatDateTime(step.started_at)}</span>
                        <span>{formatDateTime(step.completed_at)}</span>
                      </div>
                    </div>

                    {chapterNumber ? (
                      <Link to={`/projects/${projectId}/editor/${chapterNumber}`}>
                        <Button variant="tertiary" size="sm">打开章节</Button>
                      </Link>
                    ) : null}
                  </div>

                  {(step.input_artifact || step.output_artifact) && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-sm">
                        <p className="text-[var(--text-secondary)]">输入 Artifact</p>
                        {step.input_artifact ? (
                          <div className="mt-1">
                            <p className="font-medium">
                              {getArtifactDisplayName(step.input_artifact.artifact_type)} v{step.input_artifact.version_number}
                            </p>
                            <Link to={`/projects/${projectId}/artifacts/${step.input_artifact.id}`}>
                              <Button variant="tertiary" size="sm">查看</Button>
                            </Link>
                          </div>
                        ) : (
                          <p className="mt-1 font-medium">-</p>
                        )}
                      </div>
                      <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-sm">
                        <p className="text-[var(--text-secondary)]">输出 Artifact</p>
                        {step.output_artifact ? (
                          <div className="mt-1">
                            <p className="font-medium">
                              {getArtifactDisplayName(step.output_artifact.artifact_type)} v{step.output_artifact.version_number}
                            </p>
                            <Link to={`/projects/${projectId}/artifacts/${step.output_artifact.id}`}>
                              <Button variant="tertiary" size="sm">查看</Button>
                            </Link>
                          </div>
                        ) : (
                          <p className="mt-1 font-medium">-</p>
                        )}
                      </div>
                    </div>
                  )}

                  {contractSummary && typeof contractSummary === 'object' && !Array.isArray(contractSummary) && (
                    <div className="mt-4 rounded-standard border border-[rgba(var(--accent-primary-rgb),0.15)] bg-[rgba(var(--accent-primary-rgb),0.05)] p-3">
                      <p className="font-medium text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Agent Contract</p>
                      <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                        {Object.entries(contractSummary).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-[var(--text-secondary)]">{key}：</span>
                            <span className="font-medium">{typeof value === 'string' ? value : renderJsonValue(value as JsonValue)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {!run.steps?.length && (
              <div className="rounded-standard border border-dashed border-[var(--border-default)] p-4 text-center text-[var(--text-secondary)]">
                无
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Feedback Trace</p>
          <h2 className="mt-2 text-2xl font-medium">反馈记录</h2>

          <div className="mt-5 space-y-4">
            {run.feedback_items?.map(item => (
              <div key={item.id} className="rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="secondary">{item.feedback_scope}</Badge>
                      <Badge variant="secondary">{item.feedback_type}</Badge>
                      <Badge variant={item.status === 'open' ? 'status' : 'secondary'}>
                        {item.status}
                      </Badge>
                    </div>
                    <p className="mt-3 whitespace-pre-line">{item.content}</p>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    <div>动作 {item.action_type}</div>
                    <div>章节 {item.chapter_index ?? '项目级'}</div>
                    <div>{formatDateTime(item.created_at)}</div>
                  </div>
                </div>
              </div>
            ))}

            {!run.feedback_items?.length && (
              <div className="rounded-standard border border-dashed border-[var(--border-default)] p-4 text-center text-[var(--text-secondary)]">
                无
              </div>
            )}
          </div>
        </Card>
      </div>
    
  )
}

export default WorkflowRunDetail
