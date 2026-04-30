import React, { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { Card, Badge, Button, Input, Progress } from '../components/v2'
import { useLayoutStore } from '../store/useLayoutStore'
import { useProjectStore, type ProjectStatus } from '../store/useProjectStore'
import {
  addCollaborator,
  createShareLink,
  downloadExportFile,
  getProject,
  getTaskStatus,
  listCollaborators,
  removeCollaborator,
  triggerExport,
} from '../utils/endpoints'
import { useAuthStore } from '../store/useAuthStore'
import { useToast } from '../components/toastContext'

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
    } catch (error: unknown) {
      console.error('Share link creation error:', error)
      const message = error && typeof error === 'object' && 'response' in error
        ? (error.response as { data?: { detail?: string } })?.data?.detail || '创建失败'
        : '创建失败'
      showToast(message, 'error')
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
  const canExport = data.status === 'completed'

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
        <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Delivery</p>
        <h2 className="mt-2 text-2xl font-medium">导出分享</h2>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
            <p className="text-sm text-[var(--text-secondary)]">导出状态</p>
            <p className="mt-1 font-medium">{canExport ? '可导出' : '等待项目完成'}</p>
          </div>
          <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
            <p className="text-sm text-[var(--text-secondary)]">链接状态</p>
            <p className="mt-1 font-medium">{shareUrl ? '已生成' : '未创建'}</p>
          </div>
        </div>

        {canExport ? (
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
            项目完成后可用导出和分享
          </div>
        )}
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

    </div>
  )
}

export default ProjectExport
