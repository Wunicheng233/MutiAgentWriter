import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import { ProgressBar } from '../components/ProgressBar'
import AgentCard from '../components/AgentCard'
import { useLayoutStore } from '../store/useLayoutStore'
import {
  getChapter,
  updateChapter,
  getProject,
  getTaskStatus,
  confirmTask,
  regenerateChapter,
  listChapterVersions,
  restoreChapterVersion,
  type ChapterVersionInfo,
} from '../utils/endpoints'
import api from '../utils/api'
import { useToast } from '../components/toastContext'
import { getErrorMessage } from '../utils/errorMessage'
import {
  getChapterRunSummary,
  getProjectStatusText,
  getTaskStatusText,
  getWorkflowAgentStatesFromRuntime,
} from '../utils/workflow'
import {
  chapterContentToEditorHtml,
  chapterContentToPreviewText,
  renderSafeMarkdown,
} from '../utils/safeContent'

// 精简架构：仅 4 个核心 Agent
const agentNames = [
  'planner', 'writer', 'critic', 'revise',
]

export const Editor: React.FC = () => {
  const { id, chapterIndex } = useParams<{ id: string; chapterIndex: string }>()
  const projectId = id ? parseInt(id) : 0
  const chapterIdx = chapterIndex ? parseInt(chapterIndex) : 0

  // Hooks 必须在所有条件之前定义（React Hooks 规则）
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [pollingTaskId, setPollingTaskId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versions, setVersions] = useState<ChapterVersionInfo[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [waitingConfirmChapter, setWaitingConfirmChapter] = useState<number | null>(null)
  const [planPreview, setPlanPreview] = useState<string>('')
  const [liveTaskStatus, setLiveTaskStatus] = useState<string | null>(null)
  const [liveCurrentChapter, setLiveCurrentChapter] = useState<number | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)

  const { data: project, refetch: refetchProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: projectId > 0,
  })

  const { data: chapter, isLoading, refetch: refetchChapter } = useQuery({
    queryKey: ['chapter', projectId, chapterIdx],
    queryFn: () => getChapter(projectId, chapterIdx),
    // 只有在以下情况才查询章节：
    // 1. 没有正在进行的生成任务，用户正常编辑
    // 2. 正在等待确认，并且是章节确认（不是策划确认）
    enabled: pollingTaskId === null || (waitingConfirmChapter !== null && waitingConfirmChapter > 0),
    // 禁用错误重试，避免连续弹出"章节不存在"错误
    retry: false,
  })

  // 根据项目状态和章节状态初始化Agent状态
  // 如果项目已经完成生成，所有agent都应该显示为完成
  useEffect(() => {
    if (!project) return

    const task = project.current_generation_task
    const activeChapter = task?.current_workflow_run?.current_chapter ?? task?.current_chapter ?? null

    if (task && (project.status === 'generating' || task.status === 'waiting_confirm')) {
      queueMicrotask(() => {
        setPollingTaskId(task.celery_task_id)
        setProgress((task.progress || 0) * 100)
        setCurrentStep(task.current_step || '')
        setWaitingConfirmChapter(task.status === 'waiting_confirm' ? activeChapter : null)
        setLiveTaskStatus(task.status)
        setLiveCurrentChapter(activeChapter)
        setInspectorOpen(true)
      })
    } else if (project.status !== 'generating') {
      queueMicrotask(() => {
        setPollingTaskId(null)
        setLiveTaskStatus(task?.status ?? null)
        setLiveCurrentChapter(activeChapter)
      })
    }
  }, [project])

  const effectiveTaskStatus =
    waitingConfirmChapter !== null
      ? 'waiting_confirm'
      : liveTaskStatus ?? project?.current_generation_task?.status ?? (pollingTaskId ? 'progress' : null)
  const effectiveCurrentChapter =
    liveCurrentChapter ??
    waitingConfirmChapter ??
    project?.current_generation_task?.current_workflow_run?.current_chapter ??
    project?.current_generation_task?.current_chapter ??
    null
  const agentStates = useMemo(() => getWorkflowAgentStatesFromRuntime({
    projectStatus: project?.status ?? (pollingTaskId ? 'generating' : undefined),
    taskStatus: effectiveTaskStatus,
    currentStep: currentStep || project?.current_generation_task?.current_step,
    currentChapter: effectiveCurrentChapter,
    progress: pollingTaskId ? progress / 100 : project?.current_generation_task?.progress,
  }), [
    currentStep,
    effectiveCurrentChapter,
    effectiveTaskStatus,
    pollingTaskId,
    progress,
    project?.current_generation_task?.current_step,
    project?.current_generation_task?.progress,
    project?.status,
  ])

  const updateMutation = useMutation({
    mutationFn: (content: string) => updateChapter(projectId, chapterIdx, { content }),
    onSuccess: () => {
      showToast('已保存', 'success')
      setSaving(false)
    },
    onError: () => {
      showToast('保存失败', 'error')
      setSaving(false)
    },
  })

  // 防抖自动保存
  const timeoutRef = useRef<number | null>(null)
  const debouncedSave = useCallback((content: string) => {
    setSaving(true)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = window.setTimeout(() => {
      updateMutation.mutate(content)
    }, 2000)
  }, [updateMutation])

  // 编辑器初始化 - 当chapter加载完成后重新创建编辑器保证content正确
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: '开始写作...',
      }),
    ],
    content: chapter?.content ? chapterContentToEditorHtml(chapter.content) : '',
    onUpdate: ({ editor }) => {
      // 防抖自动保存
      debouncedSave(editor.getHTML())
    },
    immediatelyRender: false,
  })

  // 当编辑器实例创建完成或者chapter内容加载完成，填充到编辑器
  // 只在编辑器为空时填充，不会覆盖用户已做的修改
  useEffect(() => {
    if (!editor || !chapter?.content) return

    const currentContent = editor.getHTML()
    // 如果当前编辑器没有内容（只有空p标签），说明还没填充，需要填充
    if (!currentContent || currentContent.trim() === '<p></p>') {
      const htmlContent = chapterContentToEditorHtml(chapter.content)
      editor.commands.setContent(htmlContent)
    }
  }, [editor, chapter?.content])

  // 手动保存
  const handleSave = () => {
    if (editor) {
      updateMutation.mutate(editor.getHTML())
    }
  }

  // 处理重新生成
  const handleRegenerate = async () => {
    try {
      const res = await regenerateChapter(projectId, chapterIdx)
      setPollingTaskId(res.celery_task_id)
      setProgress(0)
      setCurrentStep('重新生成已启动')
      setWaitingConfirmChapter(null)
      setLiveTaskStatus('progress')
      setLiveCurrentChapter(chapterIdx)
      setInspectorOpen(true)
      showToast('重新生成任务已提交', 'success')
    } catch (e: unknown) {
      showToast(getErrorMessage(e, '提交失败'), 'error')
    }
  }

  // 轮询进度 + 增量更新章节内容
  useEffect(() => {
    if (!pollingTaskId) return

    const interval = setInterval(async () => {
      try {
        const status = await getTaskStatus(pollingTaskId)
        const step = status.current_step || ''
        setProgress(status.progress * 100)
        setCurrentStep(step)
        setLiveTaskStatus(status.db_status ?? null)
        setLiveCurrentChapter(status.current_chapter ?? null)

        // 任务等待用户确认
        if (status.db_status === 'waiting_confirm') {
          clearInterval(interval)
          setWaitingConfirmChapter(status.current_chapter ?? null)
          await refetchProject()
          // 如果是策划方案确认，加载预览
          if (status.current_chapter === 0) {
            try {
              const res = await api.get(`/projects/${projectId}/plan-preview`)
              setPlanPreview(res.data.preview)
            } catch (e) {
              setPlanPreview('无法加载策划方案预览');
              console.error('Failed to load plan preview', e)
            }
          }
          setInspectorOpen(true)
          setShowConfirmDialog(true)
          return
        }

        if (status.celery_state === 'SUCCESS') {
          setPollingTaskId(null)
          setProgress(100)
          setCurrentStep('章节生成完成')
          setLiveTaskStatus('success')
          setLiveCurrentChapter(chapterIdx)
          showToast('章节生成完成', 'success')
          await queryClient.invalidateQueries({ queryKey: ['chapter', projectId, chapterIdx] })
          await queryClient.invalidateQueries({ queryKey: ['project', projectId] })
          await Promise.all([refetchChapter(), refetchProject()])
        }
        if (status.celery_state === 'FAILURE') {
          setPollingTaskId(null)
          setLiveTaskStatus('failure')
          setLiveCurrentChapter(status.current_chapter ?? null)
          showToast(status.error || '生成失败', 'error')
        }
      } catch (e) {
        console.error(e)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [chapterIdx, pollingTaskId, projectId, queryClient, refetchChapter, refetchProject, showToast])

  // 加载版本列表
  const loadVersions = useCallback(async () => {
    if (!showVersionHistory) return
    try {
      const res = await listChapterVersions(projectId, chapterIdx)
      setVersions(res.versions)
    } catch (e) {
      console.error('Failed to load versions', e)
    }
  }, [projectId, chapterIdx, showVersionHistory])

  // 恢复到指定版本
  const handleRestore = async (versionId: number) => {
    try {
      const restored = await restoreChapterVersion(projectId, chapterIdx, versionId)
      if (editor) {
        editor.commands.setContent(restored.content)
      }
      queryClient.invalidateQueries({ queryKey: ['chapter', projectId, chapterIdx] })
      showToast('已恢复到所选版本', 'success')
      loadVersions()
    } catch (e: unknown) {
      showToast(getErrorMessage(e, '恢复失败'), 'error')
    }
  }

  // Toggle version history
  const toggleVersionHistory = async () => {
    const nextState = !showVersionHistory
    setShowVersionHistory(nextState)
    if (nextState) {
      await loadVersions()
    }
  }

  // 提交人工确认
  const handleSubmitConfirmation = async (approved: boolean) => {
    if (!pollingTaskId) return
    try {
      const res = await confirmTask(pollingTaskId, approved, feedbackText)
      setShowConfirmDialog(false)
      showToast('已提交确认，任务继续生成', 'success')
      // 开始轮询新任务，清除等待确认状态
      setWaitingConfirmChapter(null)
      setPollingTaskId(res.new_task_id)
      setFeedbackText('')
      setPlanPreview('')
      setProgress(0)
      setCurrentStep(approved ? '确认已提交，继续生成' : '修改意见已提交，重新优化中')
      setLiveTaskStatus('progress')
      setLiveCurrentChapter(approved ? chapterIdx + 1 : chapterIdx)
      await refetchProject()
    } catch (e: unknown) {
      showToast(getErrorMessage(e, '提交失败'), 'error')
    }
  }

  // 更新 word count - 统计汉字数量，HTML标签不计入
  const wordCount = chapter?.content
    ? (chapter.content.match(/[\u4e00-\u9fff]/g) || []).length
    : 0
  const activeChapterNumber =
    waitingConfirmChapter ??
    project?.current_generation_task?.current_workflow_run?.current_chapter ??
    project?.current_generation_task?.current_chapter ??
    chapterIdx
  const runSummary = getChapterRunSummary({
    projectStatus: project?.status,
    taskStatus: effectiveTaskStatus,
    currentStep: currentStep || project?.current_generation_task?.current_step,
    currentChapter: activeChapterNumber,
    progress: pollingTaskId ? progress / 100 : project?.current_generation_task?.progress,
  }, chapterIdx)
  const currentTaskLabel = effectiveTaskStatus
    ? getTaskStatusText({
        ...(project?.current_generation_task ?? {
          id: 0,
          project_id: projectId,
          celery_task_id: pollingTaskId || '',
          progress: progress / 100,
          started_at: '',
          status: effectiveTaskStatus,
        }),
        status: effectiveTaskStatus,
      })
    : '尚未启动'
  const chapterPreviewText = chapter?.content
    ? chapterContentToPreviewText(chapter.content)
    : ''

  // Get layout state from store
  const { focusMode } = useLayoutStore()

  // Handle missing route parameters - must be after all hooks (React Hooks rule)
  const isValidParams = id && chapterIndex && projectId > 0 && !Number.isNaN(chapterIdx)
  if (!isValidParams) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)]">
        <div className="text-[var(--text-secondary)] text-center">
          <p className="text-lg mb-2">Invalid page parameters</p>
          <p className="text-sm">Please return to the project overview and try again.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-8 text-[var(--text-secondary)]">加载中...</div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Page content wrapped in container for proper scroll */}
      <div className={`mx-auto transition-all duration-200 ${focusMode ? 'max-w-[900px]' : 'max-w-full'}`}>
            {/* Chapter Header Card */}
            <Card className="mb-6 border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {project && <Badge variant="secondary">{getProjectStatusText(project.status)}</Badge>}
                    <Badge variant={pollingTaskId ? 'status' : 'secondary'}>{currentTaskLabel}</Badge>
                  </div>
                  <h1 className="truncate text-3xl text-[var(--text-primary)]">
                    {chapter?.title || `第${chapterIdx}章`}
                  </h1>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {project?.name || '当前项目'} · 第 {activeChapterNumber} 章 · {wordCount} 字 ·
                    自动保存 {saving ? '进行中' : '已就绪'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={inspectorOpen ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setInspectorOpen(prev => !prev)}
                  >
                    {inspectorOpen ? '收起过程' : '查看过程'}
                  </Button>
                </div>
              </div>

              {(pollingTaskId || currentStep) && (
                <div className="mt-4 border-t border-[var(--border-default)] pt-4">
                  <ProgressBar
                    progress={pollingTaskId ? progress : 100}
                    message={
                      pollingTaskId
                        ? currentStep || '工作流执行中...'
                        : chapter
                          ? '当前章节已可编辑'
                          : '等待章节内容'
                    }
                  />
                </div>
              )}
            </Card>

            {/* Confirmation Banner */}
            {waitingConfirmChapter !== null && !showConfirmDialog && (
              <div className="mb-6 rounded-lg border border-[var(--accent-warm)] bg-opacity-10 bg-[var(--accent-warm)] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {waitingConfirmChapter === 0
                        ? '策划方案正在等待你的确认'
                        : `第 ${waitingConfirmChapter} 章正在等待你的确认`}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      这是工作流暂停点。你可以继续查看内容，但只有确认后系统才会继续推进。
                    </p>
                  </div>
                  <Button variant="primary" onClick={() => setShowConfirmDialog(true)}>
                    打开确认面板
                  </Button>
                </div>
              </div>
            )}

            {/* Main Content Area */}
            <div className={`grid grid-cols-1 gap-6 transition-all duration-200 ${inspectorOpen ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : 'lg:grid-cols-1'}`}>
              {/* Inspector Panel */}
              {inspectorOpen && (
                <aside className="space-y-6">
                  <Card className="p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">Run Context</p>
                    <h2 className="mt-2 text-2xl text-[var(--text-primary)]">{runSummary.headline}</h2>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{runSummary.detail}</p>
                    <div className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                      <div>任务状态：{currentTaskLabel}</div>
                      {project?.current_generation_task?.current_workflow_run?.current_step_key && (
                        <div>当前节点：{project.current_generation_task.current_workflow_run.current_step_key}</div>
                      )}
                    </div>
                  </Card>

                  <div>
                    <h3 className="mb-4 text-lg text-[var(--text-primary)]">智能体状态</h3>
                    {agentNames.map(name => (
                      <AgentCard
                        key={name}
                        name={name}
                        status={agentStates[name as keyof typeof agentStates]}
                      />
                    ))}
                  </div>

                  <div>
                    <Button
                      variant={showVersionHistory ? 'primary' : 'secondary'}
                      className="w-full"
                      onClick={toggleVersionHistory}
                    >
                      {showVersionHistory ? '关闭历史版本' : '历史版本'}
                    </Button>

                    {showVersionHistory && (
                      <Card className="mt-4 max-h-[400px] overflow-y-auto">
                        <h4 className="mb-3 font-medium text-[var(--text-primary)]">保存的版本</h4>
                        {versions.length === 0 ? (
                          <p className="text-sm text-[var(--text-secondary)]">暂无历史版本</p>
                        ) : (
                          <div className="space-y-2">
                            {versions.map(ver => (
                              <div
                                key={ver.id}
                                className="flex items-center justify-between rounded-lg border border-[var(--border-default)] p-2 transition-colors hover:border-[var(--accent-primary)]"
                              >
                                <div>
                                  <div className="text-sm font-medium text-[var(--text-primary)]">V{ver.version_number}</div>
                                  <div className="text-xs text-[var(--text-secondary)]">
                                    {new Date(ver.created_at).toLocaleString()}
                                    {' · '}{ver.word_count} 字
                                  </div>
                                </div>
                                <Button
                                  variant="tertiary"
                                  size="sm"
                                  onClick={() => handleRestore(ver.id)}
                                >
                                  恢复
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    )}
                  </div>
                </aside>
              )}

              {/* Editor Area */}
              <div className="flex h-full flex-col">
                <div className="min-h-[62vh] flex-1 overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-sm">
                  {editor && (
                    <EditorContent
                      editor={editor}
                      className={`prose-novel mx-auto px-6 pt-0 pb-10 focus:outline-none md:px-10`}
                      style={{
                        maxWidth: focusMode ? '900px' : (inspectorOpen ? '600px' : '860px'),
                      }}
                    />
                  )}
                </div>
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-[var(--text-secondary)]">
                    {wordCount} 字 · 自动保存 {saving ? '进行中' : '已就绪'} · Agent {pollingTaskId ? '运行中' : '空闲'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={handleRegenerate}>
                      重新生成
                    </Button>
                    <Button variant="primary" onClick={handleSave} disabled={saving}>
                      {saving ? '保存中...' : '保存'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
    </div>

      {/* 人工确认对话框 */}
      {showConfirmDialog && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[460px] border-l border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 shadow-lg">
          <Card className="h-full overflow-y-auto" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="text-xl text-[var(--text-primary)]">
                {waitingConfirmChapter === 0
                  ? '策划方案已生成，请确认'
                  : `第${waitingConfirmChapter}章已生成，请确认`
                }
              </h3>
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => setShowConfirmDialog(false)}
              >
                关闭
              </Button>
            </div>
            <p className="mb-6 text-[var(--text-secondary)]">
              {waitingConfirmChapter === 0
                ? '你可以选择直接通过，开始生成章节，或者输入修改意见让AI重新调整策划方案。'
                : '你可以选择直接通过，继续生成下一章，或者输入修改意见让AI重新优化当前章节。'
              }
            </p>
            {/* 预览内容 */}
            {waitingConfirmChapter === 0 && project && project.file_path && (
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">策划方案预览：</label>
                <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(planPreview || '加载中...') }}
                />
              </div>
            )}
            {waitingConfirmChapter !== 0 && chapter && (
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">章节预览：</label>
                <div className="max-h-[42vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4 text-[var(--text-body)]">
                  {chapterPreviewText}
                </div>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                  修改意见（不通过时填写）：
                </label>
                <textarea
                  className="min-h-[120px] w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-body)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                  placeholder="例如：'主角人设不对，请修改' / '情节发展太快，放慢节奏增加细节'..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                />
              </div>
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  onClick={() => handleSubmitConfirmation(true)}
                >
                  通过，继续生成
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSubmitConfirmation(false)}
                  disabled={!feedbackText.trim()}
                >
                  不通过，按修改意见重新优化
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default Editor
