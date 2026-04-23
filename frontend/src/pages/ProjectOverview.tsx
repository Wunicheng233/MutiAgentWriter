import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import type { BadgeVariant } from '../components/Badge'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { ProgressBar } from '../components/ProgressBar'
import { getProject, triggerGenerate, triggerExport, downloadExportFile, getTaskStatus, getProjectTokenStats, createShareLink, listCollaborators, addCollaborator, removeCollaborator, resetProject, updateProject, cleanStuckTasks } from '../utils/endpoints'
import { useAuthStore } from '../store/useAuthStore'
import { useToast } from '../components/toastContext'
import { getErrorMessage } from '../utils/errorMessage'

export const ProjectOverview: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const projectId = parseInt(id!)
  const { showToast } = useToast()
  const user = useAuthStore(state => state.user)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  })

  const { data: tokenStats } = useQuery({
    queryKey: ['project-token-stats', projectId],
    queryFn: () => getProjectTokenStats(projectId),
    enabled: !!data,
  })

  const [exportPollingId, setExportPollingId] = useState<string | null>(null)
  const [exportTaskId, setExportTaskId] = useState<number | null>(null)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStep, setExportStep] = useState('')
  const [creatingShare, setCreatingShare] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [newCollaboratorUsername, setNewCollaboratorUsername] = useState('')
  const [addingCollaborator, setAddingCollaborator] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [editingConfig, setEditingConfig] = useState(false)
  const [cleaningStuck, setCleaningStuck] = useState(false)
  const [showCleanConfirm, setShowCleanConfirm] = useState(false)
  const queryClient = useQueryClient()

  // 可编辑的配置状态
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

  // 当数据加载完成，同步到表单
  useEffect(() => {
    if (data?.config) {
      setConfigForm({
        skip_plan_confirmation: data.config.skip_plan_confirmation ?? false,
        skip_chapter_confirmation: data.config.skip_chapter_confirmation ?? false,
        allow_plot_adjustment: data.config.allow_plot_adjustment ?? false,
        chapter_word_count: data.config.chapter_word_count ?? 2000,
        start_chapter: data.config.start_chapter ?? 1,
        end_chapter: data.config.end_chapter ?? 10,
      })
    }
  }, [data])

  const { data: collaborators = [] } = useQuery({
    queryKey: ['collaborators', projectId],
    queryFn: () => listCollaborators(projectId),
    enabled: !!data,
  })

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
    } catch (e: unknown) {
      showToast(getErrorMessage(e, '添加失败'), 'error')
    } finally {
      setAddingCollaborator(false)
    }
  }

  const handleRemoveCollaborator = async (collabId: number) => {
    try {
      await removeCollaborator(projectId, collabId)
      showToast('协作者移除成功', 'success')
      queryClient.invalidateQueries({ queryKey: ['collaborators', projectId] })
    } catch (e: unknown) {
      showToast(getErrorMessage(e, '移除失败'), 'error')
    }
  }

  const handleResetProject = async () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true)
      return
    }
    try {
      setResetting(true)
      await resetProject(projectId)
      showToast('项目已重置为草稿，所有生成内容已清除', 'success')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setShowResetConfirm(false)
      setResetting(false)
    } catch (e: unknown) {
      showToast(getErrorMessage(e, '重置失败'), 'error')
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
      setCleaningStuck(false)
    } catch (e: unknown) {
      showToast(getErrorMessage(e, '清理失败'), 'error')
      setCleaningStuck(false)
    }
  }

  const handleTriggerGenerate = async () => {
    try {
      // 如果项目已经不是草稿状态（已有生成内容），则自动开启重新生成模式
      const isRegenerate = data?.status !== 'draft'
      await triggerGenerate(projectId, isRegenerate)
      showToast(isRegenerate ? '重新生成任务已提交，已有章节已清空' : '生成任务已提交', 'success')
      refetch()
    } catch (e: unknown) {
      showToast(getErrorMessage(e, '提交失败'), 'error')
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
    } catch (e: unknown) {
      showToast(getErrorMessage(e, '提交失败'), 'error')
    }
  }

  const handleCreateShare = async () => {
    try {
      setCreatingShare(true)
      const res = await createShareLink(projectId)
      const fullUrl = window.location.origin + res.share_url
      setShareUrl(fullUrl)
      await navigator.clipboard.writeText(fullUrl)
      showToast('分享链接已创建并复制到剪贴板', 'success')
    } catch (e: unknown) {
      showToast(getErrorMessage(e, '创建失败'), 'error')
    } finally {
      setCreatingShare(false)
    }
  }

  // 轮询导出进度
  useEffect(() => {
    if (!exportPollingId || !exportTaskId) return

    const interval = setInterval(async () => {
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
      } catch (e) {
        console.error(e)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [exportPollingId, exportTaskId, projectId, showToast])

  if (isLoading) {
    return (
      <Layout>
        <p className="text-secondary">加载中...</p>
      </Layout>
    )
  }

  if (!data) {
    return (
      <Layout>
        <p className="text-secondary">项目不存在</p>
      </Layout>
    )
  }

  const config = data.config
  const getStatusColor = (status: string): BadgeVariant => {
    switch (status) {
      case 'draft': return 'secondary'
      case 'generating': return 'status'
      case 'completed': return 'agent'
      case 'failed': return 'genre'
      default: return 'genre'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return '草稿'
      case 'generating': return '生成中'
      case 'completed': return '已完成'
      case 'failed': return '失败'
      default: return status
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Link to="/">
                <Button variant="secondary" size="sm">返回书架</Button>
              </Link>
              <h1 className="text-3xl">{data.name}</h1>
            </div>
            {data.description && (
              <p className="text-secondary mt-1">{data.description}</p>
            )}
          </div>
          <Badge variant={getStatusColor(data.status)}>
            {getStatusText(data.status)}
          </Badge>
        </div>

        {/* 基本信息 - 全宽在上 */}
        <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl">基本信息</h2>
          {data.status === 'draft' && (
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => setEditingConfig(!editingConfig)}
            >
              {editingConfig ? '取消' : '编辑配置'}
            </Button>
          )}
        </div>
        {!editingConfig ? (
          <div className="space-y-4 text-lg">
            {/* 基础信息和人机交互 - 两栏网格 */}
            <dl className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                {config?.novel_name && (
                  <div>
                    <dt className="text-secondary">小说名称</dt>
                    <dd className="mt-1 text-body font-medium">{config.novel_name}</dd>
                  </div>
                )}
                {config?.chapter_word_count && (
                  <div>
                    <dt className="text-secondary">每章字数</dt>
                    <dd className="mt-1 text-body">{config.chapter_word_count}</dd>
                  </div>
                )}
                {config?.end_chapter && (
                  <div>
                    <dt className="text-secondary">章节范围</dt>
                    <dd className="mt-1 text-body">{config.start_chapter || 1} - {config.end_chapter}</dd>
                  </div>
                )}
                {tokenStats && tokenStats.total_tokens > 0 && (
                  <div>
                    <dt className="text-secondary">Token 消耗</dt>
                    <dd className="mt-1 text-body">
                      {tokenStats.total_tokens.toLocaleString()} tokens
                      <span className="text-secondary ml-2 text-xs">
                        (≈ ${tokenStats.estimated_cost_usd.toFixed(4)})
                      </span>
                    </dd>
                  </div>
                )}
              </div>

              {/* 人机交互选项 - 右栏 */}
              {config && (
                <div className="space-y-2">
                  <dt className="text-secondary font-medium">人机交互选项</dt>
                  <dd className="mt-1 text-body">
                    <ul className="list-disc list-inside space-y-1 text-base">
                      <li>跳过策划确认：{config.skip_plan_confirmation ? '是' : '否'}</li>
                      <li>跳过章节确认：{config.skip_chapter_confirmation ? '是' : '否'}</li>
                      <li>允许剧情调整：{config.allow_plot_adjustment ? '是' : '否'}</li>
                    </ul>
                  </dd>
                </div>
              )}
            </dl>

            {/* 核心需求 - 独立区块，限制高度可滚动 */}
            {config?.core_requirement && (
              <div className="bg-sage/5 rounded-standard p-4 border border-border">
                <h4 className="text-secondary font-medium mb-3">核心需求</h4>
                <div className="max-h-96 overflow-y-auto text-body whitespace-pre-line pr-2">
                  {config.core_requirement}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="每章字数"
                type="number"
                value={configForm.chapter_word_count}
                onChange={e => setConfigForm(prev => ({ ...prev, chapter_word_count: parseInt(e.target.value) }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="起始章节"
                type="number"
                value={configForm.start_chapter}
                onChange={e => setConfigForm(prev => ({ ...prev, start_chapter: parseInt(e.target.value) }))}
              />
              <Input
                label="结束章节"
                type="number"
                value={configForm.end_chapter}
                onChange={e => setConfigForm(prev => ({ ...prev, end_chapter: parseInt(e.target.value) }))}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_skip_plan"
                  checked={configForm.skip_plan_confirmation}
                  onChange={e => setConfigForm(prev => ({ ...prev, skip_plan_confirmation: e.target.checked }))}
                  className="text-sage rounded border-border focus:ring-sage"
                />
                <label htmlFor="edit_skip_plan" className="text-sm text-body">
                  跳过策划方案人工确认（全自动模式）
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_skip_chapter"
                  checked={configForm.skip_chapter_confirmation}
                  onChange={e => setConfigForm(prev => ({ ...prev, skip_chapter_confirmation: e.target.checked }))}
                  className="text-sage rounded border-border focus:ring-sage"
                />
                <label htmlFor="edit_skip_chapter" className="text-sm text-body">
                  跳过章节级人工确认（全自动生成全部章节）
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_allow_plot"
                  checked={configForm.allow_plot_adjustment}
                  onChange={e => setConfigForm(prev => ({ ...prev, allow_plot_adjustment: e.target.checked }))}
                  className="text-sage rounded border-border focus:ring-sage"
                />
                <label htmlFor="edit_allow_plot" className="text-sm text-body">
                  允许每章后调整下一章剧情（人在环路可控创作）
                </label>
              </div>
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
      </Card>

      {/* 质量评分 - 全宽 */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl mb-4">质量评分</h2>
            {data.overall_quality_score > 0 ? (
              <div className="mb-4 w-64">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-secondary">总体评分</span>
                  <span className="text-body font-medium">{data.overall_quality_score.toFixed(1)}/10</span>
                </div>
                <ProgressBar progress={data.overall_quality_score * 10} />
              </div>
            ) : (
              <p className="text-secondary mb-0">尚无评分，生成完成后会自动计算</p>
            )}
          </div>
          {data.overall_quality_score > 0 && (
            <Link to={`/projects/${projectId}/analytics`}>
              <Button variant="secondary">
                查看详细质量分析
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {/* 协作者 - 如果有单独占一行 */}
      {data && user && data.user_id === user.id && ( // Only owner can see collaborators
        <Card>
          <h2 className="text-xl mb-4">协作者</h2>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  label="用户名"
                  placeholder="输入已注册用户名"
                  value={newCollaboratorUsername}
                  onChange={(e) => setNewCollaboratorUsername(e.target.value)}
                />
              </div>
              <div className="pt-[26px]">
                <Button
                  variant="primary"
                  onClick={handleAddCollaborator}
                  disabled={addingCollaborator}
                >
                  {addingCollaborator ? '添加中...' : '添加'}
                </Button>
              </div>
            </div>
            {collaborators.length > 0 ? (
              <div className="space-y-2">
                {collaborators.map(collab => (
                  <div key={collab.id} className="flex justify-between items-center p-2 border border-border rounded-standard">
                    <div>
                      <div className="font-medium">{collab.username}</div>
                      <div className="text-xs text-secondary">{collab.email} · {collab.role}</div>
                    </div>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => handleRemoveCollaborator(collab.id)}
                    >
                      移除
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-secondary text-sm">暂无协作者</p>
            )}
          </div>
        </Card>
      )}

      {exportPollingId && (
        <div className="mb-6">
          <ProgressBar progress={exportProgress} message={exportStep || '导出中...'} />
        </div>
      )}

      <div className="mt-8 space-y-6">
        {/* 主要操作区 */}
        <div className="flex flex-wrap gap-4">
          <Link to={`/projects/${projectId}/chapters`}>
            <Button variant="secondary">
              查看章节
            </Button>
          </Link>
          {data.status !== 'generating' && (
            <Button variant="primary" onClick={handleTriggerGenerate}>
              开始生成
            </Button>
          )}
          {data.status === 'generating' && (
            <Link to={`/projects/${projectId}/write/1`}>
              <Button variant="primary">
                进入写作
              </Button>
            </Link>
          )}
          <Link to={`/projects/${projectId}/analytics`}>
            <Button variant="secondary">
              质量分析
            </Button>
          </Link>
          {data.status !== 'draft' && (
            <Button
              variant="secondary"
              onClick={handleResetProject}
            >
              重置项目
            </Button>
          )}
        </div>

        {/* 导出与分享区 - 仅完成状态显示 */}
        {data.status === 'completed' && (
          <div className="bg-sage/5 rounded-standard p-4 border border-border">
            <h3 className="text-sm font-medium text-body mb-3">导出与分享</h3>
            <div className="flex flex-wrap gap-3 mb-3">
              <Button variant="secondary" onClick={() => handleTriggerExport('epub')} disabled={!!exportPollingId}>
                导出 EPUB
              </Button>
              <Button variant="secondary" onClick={() => handleTriggerExport('docx')} disabled={!!exportPollingId}>
                导出 DOCX
              </Button>
              <Button variant="secondary" onClick={() => handleTriggerExport('html')} disabled={!!exportPollingId}>
                导出 HTML
              </Button>
              <Button
                variant="secondary"
                onClick={handleCreateShare}
                disabled={creatingShare}
              >
                {creatingShare ? '创建中...' : shareUrl ? '分享链接已复制' : '创建分享链接'}
              </Button>
              <Button
                variant="tertiary"
                onClick={() => setShowCleanConfirm(true)}
                disabled={cleaningStuck}
              >
                清理任务队列
              </Button>
            </div>
            {shareUrl && (
              <div className="p-2 bg-white rounded-standard border border-border text-xs text-secondary break-all">
                {shareUrl}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 确认清理对话框 */}
      {showCleanConfirm && (
        <div className="mt-4 bg-amber/5 border border-amber/30 rounded-standard p-4 space-y-3">
          <p className="text-sm text-body">
            <strong>确认清理任务队列吗？</strong> 这会将所有未完成的任务标记为失败，你可以重新尝试导出。<br />
            不会删除已生成的章节内容，只清理任务状态。
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => setShowCleanConfirm(false)}
              disabled={cleaningStuck}
            >
              取消
            </Button>
            <Button
              variant="secondary"
              onClick={handleCleanStuckTasks}
              disabled={cleaningStuck}
            >
              {cleaningStuck ? '清理中...' : '确认清理'}
            </Button>
          </div>
        </div>
      )}

      {/* 确认重置对话框 */}
      {showResetConfirm && (
        <div className="mt-4 bg-red/5 border border-red/30 rounded-standard p-4 space-y-3">
          <p className="text-sm text-body">
            <strong>确认重置项目吗？</strong> 这会删除所有已生成章节和任务记录，项目将回到草稿状态，此操作不可恢复。
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => setShowResetConfirm(false)}
              disabled={resetting}
            >
              取消
            </Button>
            <Button
              variant="secondary"
              onClick={handleResetProject}
              disabled={resetting}
            >
              {resetting ? '重置中...' : '确认重置'}
            </Button>
          </div>
        </div>
      )}
      </div>
    </Layout>
  )
}

export default ProjectOverview
