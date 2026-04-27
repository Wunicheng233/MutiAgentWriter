import React, { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { Card, Badge, Button, Input, Progress } from '../components/v2'
import { useLayoutStore } from '../store/useLayoutStore'
import { useProjectStore, type ProjectStatus } from '../store/useProjectStore'
import {
  addCollaborator,
  cleanStuckTasks,
  createShareLink,
  downloadExportFile,
  getProject,
  getProjectArtifacts,
  getTaskStatus,
  listCollaborators,
  removeCollaborator,
  resetProject,
  triggerExport,
} from '../utils/endpoints'
import { useAuthStore } from '../store/useAuthStore'
import { useToast } from '../components/toastContext'
import {
  getArtifactDisplayName,
  getArtifactScopeLabel,
} from '../utils/artifact'

export const ProjectExport: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const projectId = id ? parseInt(id, 10) : 0
  const isValidProjectId = !Number.isNaN(projectId) && projectId > 0
  const { showToast } = useToast()
  const user = useAuthStore(state => state.user)
  const queryClient = useQueryClient()

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

  const { data: recentArtifacts } = useQuery({
    queryKey: ['project-artifacts', projectId, 'current'],
    queryFn: () => getProjectArtifacts(projectId, {
      limit: 10,
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
  const [creatingShare, setCreatingShare] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [newCollaboratorUsername, setNewCollaboratorUsername] = useState('')
  const [addingCollaborator, setAddingCollaborator] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [showCleanConfirm, setShowCleanConfirm] = useState(false)
  const [cleaningStuck, setCleaningStuck] = useState(false)

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
    } catch {
      showToast('添加失败', 'error')
    } finally {
      setAddingCollaborator(false)
    }
  }

  const handleRemoveCollaborator = async (collabId: number) => {
    try {
      await removeCollaborator(projectId, collabId)
      showToast('协作者移除成功', 'success')
      queryClient.invalidateQueries({ queryKey: ['collaborators', projectId] })
    } catch {
      showToast('移除失败', 'error')
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
    } catch {
      showToast('重置失败', 'error')
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
    } catch {
      showToast('清理失败', 'error')
    } finally {
      setCleaningStuck(false)
    }
  }

  const handleTriggerExport = async (format: 'epub' | 'docx' | 'html') => {
    try {
      const task = await triggerExport(projectId, format)
      setExportPollingId(task.celery_task_id)
      setExportTaskId(task.id)
      setExportProgress(0)
      showToast('导出任务已提交', 'success')
    } catch {
      showToast('提交失败', 'error')
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
    } catch {
      showToast('创建失败', 'error')
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
    return <p className="text-[var(--text-secondary)]">加载中...</p>
  }

  if (!data) {
    return <p className="text-[var(--text-secondary)]">项目不存在</p>
  }

  const isOwner = !!data && !!user && data.user_id === user.id
  const completedChapters = data.chapters?.length ?? 0

  return (
    <div className="mx-auto max-w-content space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/projects/${projectId}/overview`}>
            <Button variant="tertiary" size="sm">返回概览</Button>
          </Link>
        </div>
        <Badge variant="secondary">导出分享</Badge>
      </div>

      {exportPollingId && (
        <Progress value={exportProgress} />
      )}

      <Card className="p-6">
        <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Quality</p>
        <h2 className="mt-2 text-2xl font-medium">质量与交付</h2>

        <div className="mt-6 space-y-4">
          {data.overall_quality_score > 0 ? (
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-2">总体评分 {data.overall_quality_score.toFixed(1)}/10</p>
              <Progress value={data.overall_quality_score * 10} />
            </div>
          ) : (
            <div className="rounded-standard border border-dashed border-[var(--border-default)] p-4 text-center text-[var(--text-secondary)]">
              尚无评分数据
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
              <p className="text-sm text-[var(--text-secondary)]">已完成章节</p>
              <p className="mt-1 font-medium">{completedChapters}</p>
            </div>
            <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
              <p className="text-sm text-[var(--text-secondary)]">分享状态</p>
              <p className="mt-1 font-medium">{shareUrl ? '已生成链接' : '待创建'}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to={`/projects/${projectId}/analytics`}>
              <Button variant="secondary" size="sm">质量分析</Button>
            </Link>
            {data.status !== 'draft' && (
              <Button variant="secondary" size="sm" onClick={() => setShowCleanConfirm(true)} disabled={cleaningStuck}>
                清理队列
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Delivery</p>
        <h2 className="mt-2 text-2xl font-medium">导出分享</h2>

        {data.status === 'completed' ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="sm" onClick={() => handleTriggerExport('epub')} disabled={!!exportPollingId}>
                EPUB
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleTriggerExport('docx')} disabled={!!exportPollingId}>
                DOCX
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleTriggerExport('html')} disabled={!!exportPollingId}>
                HTML
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCreateShare} disabled={creatingShare}>
                {creatingShare ? '创建中...' : shareUrl ? '已复制' : '分享链接'}
              </Button>
            </div>
            {shareUrl && (
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3 text-sm text-[var(--text-secondary)] break-all">
                {shareUrl}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-standard border border-dashed border-[var(--border-default)] p-4 text-center text-[var(--text-secondary)]">
            项目完成后可用
          </div>
        )}
      </Card>

      <Card className="p-6">
        <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Current Artifacts</p>
        <h2 className="mt-2 text-2xl font-medium">关键产物</h2>

        <div className="mt-5 space-y-3">
          {recentArtifacts?.items.map(artifact => (
            <div key={artifact.id} className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{getArtifactDisplayName(artifact.artifact_type)}</span>
                    <Badge variant="secondary">{artifact.scope}</Badge>
                    {artifact.is_current && <Badge variant="success">current</Badge>}
                  </div>
                  <div className="mt-2 text-sm text-[var(--text-secondary)]">
                    v{artifact.version_number} · {getArtifactScopeLabel(artifact)} · {artifact.source}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Link to={`/projects/${projectId}/artifacts/${artifact.id}`}>
                    <Button variant="tertiary" size="sm">详情</Button>
                  </Link>
                  {artifact.workflow_run_id && (
                    <Link to={`/projects/${projectId}/workflows/${artifact.workflow_run_id}`}>
                      <Button variant="tertiary" size="sm">Run</Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}

          {!recentArtifacts?.items.length && (
            <div className="rounded-standard border border-dashed border-[var(--border-default)] p-4 text-center text-[var(--text-secondary)]">
              暂无
            </div>
          )}
        </div>
      </Card>

      {isOwner && (
        <Card className="p-6">
          <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Team</p>
          <h2 className="mt-2 text-2xl font-medium">协作者</h2>

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
                <Button variant="primary" size="sm" onClick={handleAddCollaborator} disabled={addingCollaborator}>
                  {addingCollaborator ? '添加中...' : '添加'}
                </Button>
              </div>
            </div>

            {collaborators.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {collaborators.map(collab => (
                  <div key={collab.id} className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{collab.username}</div>
                        <div className="mt-1 text-sm text-[var(--text-secondary)]">{collab.email}</div>
                        <div className="mt-1 font-medium text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">{collab.role}</div>
                      </div>
                      <Button variant="tertiary" size="sm" onClick={() => handleRemoveCollaborator(collab.id)}>
                        移除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-[var(--text-secondary)]">暂无协作者</p>
            )}
          </div>
        </Card>
      )}

      {showCleanConfirm && (
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

      {showResetConfirm && (
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

      {data.status !== 'draft' && (
        <div className="flex justify-end">
          <Button variant="tertiary" onClick={handleResetProject}>
            展开重置确认
          </Button>
        </div>
      )}
    </div>
  )
}

export default ProjectExport
