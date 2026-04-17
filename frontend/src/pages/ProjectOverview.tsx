import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { ProgressBar } from '../components/ProgressBar'
import { getProject, triggerGenerate, triggerExport, getExportDownloadUrl, getTaskStatus, getProjectTokenStats, createShareLink, listCollaborators, addCollaborator, removeCollaborator, resetProject, updateProject } from '../utils/endpoints'
import { useAuthStore } from '../store/useAuthStore'
import { useToast } from '../components/Toast'

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
    onError: (error: any) => {
      showToast(error.response?.data?.detail || '更新失败', 'error')
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
    } catch (e: any) {
      showToast(e.response?.data?.detail || '添加失败', 'error')
    } finally {
      setAddingCollaborator(false)
    }
  }

  const handleRemoveCollaborator = async (collabId: number) => {
    try {
      await removeCollaborator(projectId, collabId)
      showToast('协作者移除成功', 'success')
      queryClient.invalidateQueries({ queryKey: ['collaborators', projectId] })
    } catch (e: any) {
      showToast(e.response?.data?.detail || '移除失败', 'error')
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
    } catch (e: any) {
      showToast(e.response?.data?.detail || '重置失败', 'error')
      setResetting(false)
    }
  }

  const handleTriggerGenerate = async () => {
    try {
      await triggerGenerate(projectId)
      showToast('生成任务已提交', 'success')
      refetch()
    } catch (e: any) {
      showToast(e.response?.data?.detail || '提交失败', 'error')
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
    } catch (e: any) {
      showToast(e.response?.data?.detail || '提交失败', 'error')
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
    } catch (e: any) {
      showToast(e.response?.data?.detail || '创建失败', 'error')
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
          // 触发下载
          const downloadUrl = getExportDownloadUrl(projectId, exportTaskId)
          window.open(downloadUrl, '_blank')
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
  const getStatusColor = (status: string) => {
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
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl">{data.name}</h1>
          {data.description && (
            <p className="text-secondary mt-2">{data.description}</p>
          )}
        </div>
        <Badge variant={getStatusColor(data.status) as any}>
          {getStatusText(data.status)}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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
            <dl className="space-y-3 text-sm">
              {config?.novel_name && (
                <>
                  <dt className="text-secondary">小说名称</dt>
                  <dd className="mt-1 text-body">{config.novel_name}</dd>
                </>
              )}
              {config?.core_requirement && (
                <>
                  <dt className="text-secondary">核心需求</dt>
                  <dd className="mt-1 text-body whitespace-pre-line">{config.core_requirement}</dd>
                </>
              )}
              {config?.chapter_word_count && (
                <>
                  <dt className="text-secondary">每章字数</dt>
                  <dd className="mt-1 text-body">{config.chapter_word_count}</dd>
                </>
              )}
              {config?.end_chapter && (
                <>
                  <dt className="text-secondary">章节范围</dt>
                  <dd className="mt-1 text-body">{config.start_chapter || 1} - {config.end_chapter}</dd>
                </>
              )}
              {config && (
                <div className="space-y-1">
                  <dt className="text-secondary">人机交互选项：</dt>
                  <dd className="mt-1 text-body">
                    <ul className="list-disc list-inside pl-1 space-y-1 text-xs">
                      <li>跳过策划确认：{config.skip_plan_confirmation ? '是' : '否'}</li>
                      <li>跳过章节确认：{config.skip_chapter_confirmation ? '是' : '否'}</li>
                      <li>允许剧情调整：{config.allow_plot_adjustment ? '是' : '否'}</li>
                    </ul>
                  </dd>
                </div>
              )}
              {tokenStats && tokenStats.total_tokens > 0 && (
                <>
                  <dt className="text-secondary">Token 消耗</dt>
                  <dd className="mt-1 text-body">
                    {tokenStats.total_tokens.toLocaleString()} tokens
                    <span className="text-secondary ml-2">
                      (≈ ${tokenStats.estimated_cost_usd.toFixed(4)})
                    </span>
                  </dd>
                </>
              )}
            </dl>
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

        <Card>
          <h2 className="text-xl mb-4">质量评分</h2>
          {data.overall_quality_score > 0 ? (
            <>
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-secondary">总体评分</span>
                  <span className="text-body font-medium">{data.overall_quality_score.toFixed(1)}/10</span>
                </div>
                <ProgressBar progress={data.overall_quality_score * 10} />
              </div>
              <Link to={`/projects/${projectId}/analytics`}>
                <Button variant="secondary" className="w-full">
                  查看详细质量分析
                </Button>
              </Link>
            </>
          ) : (
            <p className="text-secondary">尚无评分，生成完成后会自动计算</p>
          )}
        </Card>

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
      </div>

      {exportPollingId && (
        <div className="mb-6">
          <ProgressBar progress={exportProgress} message={exportStep || '导出中...'} />
        </div>
      )}

      <div className="flex flex-wrap gap-4 mt-8">
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
          <Button variant="tertiary">
            质量分析
          </Button>
        </Link>
        {data.status !== 'draft' && (
          <Button
            variant="genre"
            onClick={handleResetProject}
          >
            重置项目
          </Button>
        )}
        {data.status === 'completed' && (
          <div className="flex flex-col gap-3 w-full">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleTriggerExport('epub')} disabled={!!exportPollingId}>
                导出 EPUB
              </Button>
              <Button variant="secondary" onClick={() => handleTriggerExport('docx')} disabled={!!exportPollingId}>
                导出 DOCX
              </Button>
              <Button variant="secondary" onClick={() => handleTriggerExport('html')} disabled={!!exportPollingId}>
                导出 HTML
              </Button>
            </div>
            <div>
              <Button
                variant="tertiary"
                onClick={handleCreateShare}
                disabled={creatingShare}
                className="w-full"
              >
                {creatingShare ? '创建中...' : shareUrl ? '分享链接已复制' : '创建分享链接'}
              </Button>
              {shareUrl && (
                <p className="text-xs text-secondary mt-2 break-all">
                  {shareUrl}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

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
              variant="genre"
              onClick={handleResetProject}
              disabled={resetting}
            >
              {resetting ? '重置中...' : '确认重置'}
            </Button>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default ProjectOverview
