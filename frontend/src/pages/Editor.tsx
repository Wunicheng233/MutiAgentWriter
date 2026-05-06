import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate, Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { AxiosError } from 'axios'
import { Button, Card, Badge, Progress, AgentCard } from '../components/v2'
import { useLayoutStore } from '../store/useLayoutStore'
import { useProjectStore, type ProjectStatus } from '../store/useProjectStore'
import {
  getChapter,
  updateChapter,
  getProject,
  getTaskStatus,
  confirmTask,
  regenerateChapter,
  listChapters,
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
import SelectionToolbar from '../components/editor/SelectionToolbar'
import EditorStatusBar from '../components/editor/EditorStatusBar'
import { useShallow } from 'zustand/react/shallow'
import { useSelectionStore } from '../store/useSelectionStore'
import { useTypewriterMode } from '../hooks/useTypewriterMode'
import { useFadeMode } from '../hooks/useFadeMode'

// 精简架构：仅 4 个核心 Agent
const agentNames = [
  'planner', 'writer', 'critic', 'revise',
]

const agentSubtitles: Record<string, string> = {
  planner: '情节规划师',
  writer: '主笔作家',
  critic: '评论家',
  revise: '修订编辑',
}

export const Editor: React.FC = () => {
  const { id, chapterIndex } = useParams<{ id: string; chapterIndex: string }>()
  const navigate = useNavigate()
  const projectId = id ? parseInt(id) : 0
  const chapterIdx = chapterIndex ? parseInt(chapterIndex, 10) : NaN
  const hasValidProjectId = !!id && projectId > 0 && !Number.isNaN(projectId)
  const hasValidChapterIndex = chapterIndex !== undefined && !Number.isNaN(chapterIdx)

  // Hooks 必须在所有条件之前定义（React Hooks 规则）
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [pollingTaskId, setPollingTaskId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [waitingConfirmChapter, setWaitingConfirmChapter] = useState<number | null>(null)
  const [planPreview, setPlanPreview] = useState<string>('')
  const [liveTaskStatus, setLiveTaskStatus] = useState<string | null>(null)
  const [liveCurrentChapter, setLiveCurrentChapter] = useState<number | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)

  const { setSelection, hideToolbar, pendingRewriteResult, selectionStart, selectionEnd, setPendingRewriteResult } = useSelectionStore(
    useShallow((state) => ({
      setSelection: state.setSelection,
      hideToolbar: state.hideToolbar,
      pendingRewriteResult: state.pendingRewriteResult,
      selectionStart: state.selectionStart,
      selectionEnd: state.selectionEnd,
      setPendingRewriteResult: state.setPendingRewriteResult,
    }))
  )

  // Get layout state from store
  const { focusMode, typewriterMode, fadeMode } = useLayoutStore(
    useShallow((state) => ({
      focusMode: state.focusMode,
      typewriterMode: state.typewriterMode,
      fadeMode: state.fadeMode,
    }))
  )

  // Handle selection from TipTap editor
  const handleSelectionUpdate = useCallback(({ editor }: { editor: unknown }) => {
    const editorState = editor as { state: { selection: { from: number; to: number }; doc: { textBetween: (from: number, to: number, separator: string) => string } } }
    const { from, to } = editorState.state.selection
    const selectedText = editorState.state.doc.textBetween(from, to, '\n')

    // Only show toolbar for meaningful selections (5+ chars)
    if (selectedText && selectedText.length >= 5) {
      // Get selection coordinates
      const { view } = editor as { view: { coordsAtPos: (pos: number) => { top: number; left: number } } }
      const start = view.coordsAtPos(from)
      const end = view.coordsAtPos(to)

      // Position toolbar in the middle of selection horizontally, above selection
      const toolbarLeft = start.left + (end.left - start.left) / 2

      setSelection(
        selectedText,
        from,
        to,
      )
      useSelectionStore.getState().setToolbarPosition({
        top: start.top + window.scrollY,
        left: toolbarLeft,
      })
    } else {
      hideToolbar()
    }
  }, [setSelection, hideToolbar])

  const setCurrentProject = useProjectStore(state => state.setCurrentProject)
  const setProjectStatus = useProjectStore(state => state.setProjectStatus)

  const { data: project, refetch: refetchProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: projectId > 0,
  })

  // 初始化 ProjectStore
  useEffect(() => {
    if (!project || !id) return

    setCurrentProject(id, project.name)

    const taskProgress = project.current_generation_task?.progress ?? 0
    const progressPercent = project.status === 'completed' ? 100 : taskProgress * 100
    setProjectStatus(project.status as ProjectStatus, progressPercent)
  }, [id, project, setCurrentProject, setProjectStatus])

  const { data: chapter, isLoading, error, refetch: refetchChapter } = useQuery({
    queryKey: ['chapter', projectId, chapterIdx],
    queryFn: () => getChapter(projectId, chapterIdx),
    // 正常情况下都可以查询章节
    // 只有一种情况禁用：正在等待确认，但是在等待策划确认（章节 0）
    enabled: hasValidProjectId && hasValidChapterIndex && chapterIdx > 0 && (waitingConfirmChapter === null || waitingConfirmChapter > 0),
    // 禁用错误重试，避免连续弹出"章节不存在"错误
    retry: false,
  })

  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => listChapters(projectId),
    enabled: projectId > 0,
  })

  // 判断章节是否不存在（404）
  const chapterNotFound = error && (error as AxiosError)?.response?.status === 404

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

  const chapterNavItems = useMemo(() => {
    return [...chapters].sort((a, b) => a.chapter_index - b.chapter_index)
  }, [chapters])
  const currentChapterPosition = chapterNavItems.findIndex(item => item.chapter_index === chapterIdx)
  const previousChapter = currentChapterPosition > 0 ? chapterNavItems[currentChapterPosition - 1] : null
  const nextChapter =
    currentChapterPosition >= 0 && currentChapterPosition < chapterNavItems.length - 1
      ? chapterNavItems[currentChapterPosition + 1]
      : null

  const handleChapterSelect = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextChapterIndex = parseInt(event.target.value, 10)
    if (Number.isNaN(nextChapterIndex) || nextChapterIndex === chapterIdx) return
    navigate(`/projects/${projectId}/editor/${nextChapterIndex}`)
  }, [chapterIdx, navigate, projectId])

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
  const loadedChapterKeyRef = useRef<string | null>(null)
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
    onSelectionUpdate: handleSelectionUpdate,
    immediatelyRender: false,
  })

  // Apply typewriter mode
  useTypewriterMode(editor, typewriterMode)

  // Apply fade mode
  useFadeMode(editor, fadeMode)

  // Handle AI rewrite result from store
  useEffect(() => {
    if (pendingRewriteResult && editor) {
      editor.chain()
        .focus()
        .setTextSelection({ from: selectionStart, to: selectionEnd })
        .deleteSelection()
        .insertContent(pendingRewriteResult)
        .run()
      setPendingRewriteResult(null)
    }
  }, [pendingRewriteResult, editor, selectionStart, selectionEnd, setPendingRewriteResult])

  // 当编辑器实例创建完成或者chapter内容加载完成，填充到编辑器
  // 只在编辑器为空时填充，不会覆盖用户已做的修改
  useEffect(() => {
    if (!editor || !chapter?.content) return

    const chapterKey = `${chapter.project_id}:${chapter.chapter_index}:${chapter.updated_at ?? ''}`
    if (loadedChapterKeyRef.current !== chapterKey) {
      const htmlContent = chapterContentToEditorHtml(chapter.content)
      editor.commands.setContent(htmlContent, { emitUpdate: false })
      loadedChapterKeyRef.current = chapterKey
    }
  }, [editor, chapter?.chapter_index, chapter?.content, chapter?.project_id, chapter?.updated_at])

  // Click outside to hide selection toolbar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // Don't hide if clicking toolbar or panel
      if (
        target.closest('[data-selection-toolbar]') ||
        target.closest('[data-selection-panel]')
      ) {
        return
      }

      // Hide toolbar when clicking elsewhere
      if (useSelectionStore.getState().isToolbarVisible) {
        hideToolbar()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [hideToolbar])

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
          await queryClient.invalidateQueries({ queryKey: ['chapters', projectId] })
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

  // 更新 word count - 使用编辑器实时内容，统计汉字数量，HTML标签不计入
  const hasEditor = editor && typeof editor.getText === 'function'
  const textContent = hasEditor ? editor.getText() : (chapter?.content || '')
  const wordCount = (textContent.match(/[一-鿿]/g) || []).length
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

  // Handle missing route parameters - must be after all hooks (React Hooks rule)
  if (hasValidProjectId && (!hasValidChapterIndex || chapterIdx < 1)) {
    return <Navigate to={`/projects/${projectId}/editor/1`} replace />
  }

  const isValidParams = hasValidProjectId && hasValidChapterIndex && chapterIdx > 0
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

  // 章节不存在时显示友好提示
  if (chapterNotFound) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-primary)] p-6">
        <Card className="max-w-lg w-full border-[var(--border-default)] p-8 text-center">
          <svg className="w-16 h-16 mx-auto mb-6 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <h1 className="text-2xl font-medium text-[var(--text-primary)] mb-3">
            该章节尚未生成
          </h1>
          <p className="text-[var(--text-secondary)] mb-6">
            第 {chapterIdx} 章还没有内容，请先到项目概览页面启动生成流程，
            或从已生成的章节列表中选择一个章节进行编辑。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={`/projects/${id}/overview`}>
              <Button variant="primary">
                前往概览页面
              </Button>
            </Link>
            <Link to={`/projects/${id}/chapters`}>
              <Button variant="secondary">
                查看章节列表
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div
      className={`h-full ${inspectorOpen ? 'flex flex-col overflow-hidden' : ''}`}
      data-editor-focus-mode={focusMode ? 'true' : 'false'}
    >
      {/* Page content wrapped in container for proper scroll */}
      <div className={`mx-auto w-full ${inspectorOpen ? 'flex flex-col h-full' : ''} transition-all duration-200 ${focusMode ? 'max-w-[980px]' : 'max-w-full'}`}>
            {/* Chapter Header Card */}
            <Card className="non-essential-ui editor-chrome mb-6 border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 shadow-subtle flex-shrink-0">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {project && (
                      <Badge variant="secondary" className={project.status === 'generating' ? 'badge-pulse' : ''}>
                        {getProjectStatusText(project.status)}
                      </Badge>
                    )}
                    <Badge variant={pollingTaskId ? 'status' : 'secondary'} className={pollingTaskId ? 'badge-pulse' : ''}>
                      {currentTaskLabel}
                    </Badge>
                  </div>
                  <h1 className="truncate text-[clamp(1.5rem,3vw,2rem)] font-semibold text-[var(--text-primary)]">
                    {chapter?.title || `第${chapterIdx}章`}
                  </h1>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {project?.name || '当前项目'} · 第 {activeChapterNumber} 章 · {wordCount} 字
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {chapterNavItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => previousChapter && navigate(`/projects/${projectId}/editor/${previousChapter.chapter_index}`)}
                        disabled={!previousChapter}
                      >
                        上一章
                      </Button>
                      <select
                        aria-label="切换章节"
                        value={chapterIdx}
                        onChange={handleChapterSelect}
                        className="h-9 min-w-[180px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20"
                      >
                        {chapterNavItems.map(item => (
                          <option key={item.chapter_index} value={item.chapter_index}>
                            第 {item.chapter_index} 章 · {item.title || '未命名'}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => nextChapter && navigate(`/projects/${projectId}/editor/${nextChapter.chapter_index}`)}
                        disabled={!nextChapter}
                      >
                        下一章
                      </Button>
                    </div>
                  )}
                  <Link to={`/projects/${projectId}/read/${chapterIdx}`}>
                    <Button variant="secondary" size="sm">
                      阅读
                    </Button>
                  </Link>
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
                <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
                  <p className="text-sm text-[var(--text-secondary)] mb-3">
                    {pollingTaskId
                      ? currentStep || '工作流执行中...'
                      : chapter
                        ? '当前章节已可编辑'
                        : '等待章节内容'}
                  </p>
                  <Progress value={pollingTaskId ? progress : 100} className="progress-gradient" />
                </div>
              )}
            </Card>

            {/* Confirmation Banner */}
            {waitingConfirmChapter !== null && !showConfirmDialog && (
              <div className="non-essential-ui editor-chrome confirmation-banner mb-6 rounded-comfortable border border-[var(--accent-warm)] bg-[var(--accent-warm)]/10 p-5 flex-shrink-0">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="badge-pulse w-3 h-3 rounded-full bg-[var(--accent-warm)] mt-0.5"></span>
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
                  </div>
                  <Button variant="primary" onClick={() => setShowConfirmDialog(true)} className="flex-shrink-0">
                    打开确认面板
                  </Button>
                </div>
              </div>
            )}

            {/* Main Content Area - 双栏固定高度，内部各自滚动 */}
            <div className={`grid grid-cols-1 gap-6 transition-all duration-300 ${inspectorOpen ? 'flex-1 overflow-hidden lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
              {/* Inspector Panel - 固定高度的滚动容器 */}
              {inspectorOpen && (
                <aside className={`non-essential-ui editor-chrome order-last lg:order-first flex flex-col gap-5 ${inspectorOpen ? 'overflow-hidden' : 'min-h-[62vh]'}`}>
                  <Card className="inspector-card p-5 border-[var(--border-default)] flex-shrink-0">
                    <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Run Context</p>
                    <h2 className="mt-2 text-xl font-medium text-[var(--text-primary)]">{runSummary.headline}</h2>
                    <div className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${pollingTaskId ? 'bg-[var(--accent-primary)]' : 'bg-[var(--text-muted)]'}`}></span>
                        {currentTaskLabel}
                      </div>
                      {project?.current_generation_task?.current_workflow_run?.current_step_key && (
                        <div className="pl-4 text-xs">
                          {project.current_generation_task.current_workflow_run.current_step_key}
                        </div>
                      )}
                    </div>
                  </Card>

                  <div className="flex-1 overflow-y-auto min-h-0">
                    <h3 className="mb-4 text-lg text-[var(--text-primary)] sticky top-0 bg-[var(--bg-primary)] z-10 py-2">智能体状态</h3>
                    <div className="space-y-3 pb-4">
                      {agentNames.map(name => (
                        <AgentCard
                          key={name}
                          name={name}
                          subtitle={agentSubtitles[name] || ''}
                          status={agentStates[name as keyof typeof agentStates]}
                        />
                      ))}
                    </div>
                  </div>

                </aside>
              )}

              {/* Editor Area - 双栏模式固定高度，单栏模式自然滚动 */}
              <div className={`flex flex-col ${inspectorOpen ? 'h-full overflow-hidden' : ''} ${inspectorOpen ? 'opacity-85' : ''} transition-opacity duration-200`}>
                <div
                  className={`editor-container pb-12 ${focusMode ? 'editor-container-focus' : ''} ${inspectorOpen ? 'flex-1 overflow-y-auto min-h-0' : 'h-[70vh] min-h-[500px] overflow-y-auto'} rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-secondary)] editor-paper transition-all duration-200 hover:border-[var(--border-strong)]`}
                  data-editor-scroll-container="true"
                >
                  {editor && (
                    <EditorContent
                      editor={editor}
                      className={`prose-novel mx-auto px-6 pt-8 pb-16 focus:outline-none md:px-12`}
                      style={{
                        maxWidth: focusMode ? '760px' : (inspectorOpen ? '500px' : '860px'),
                      }}
                    />
                  )}
                </div>
                <div className={`non-essential-ui editor-chrome mt-4 flex flex-col gap-3 rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-secondary)] px-5 py-4 flex-shrink-0 ${
                    !inspectorOpen && 'md:flex-row md:items-center md:justify-between'
                  }`}>
                  <div className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
                    <span className={`${saving ? 'saving-indicator' : 'saving-indicator saved'}`}></span>
                    {wordCount} 字 · 自动保存 {saving ? '进行中' : '已就绪'}
                  </div>
                  <div className={`flex gap-2 ${inspectorOpen ? 'justify-end' : 'flex-wrap'}`}>
                    <Button variant="secondary" size="sm" onClick={handleRegenerate}>
                      重新生成
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? '保存中...' : '保存'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
    </div>

      {/* 人工确认对话框 */}
      {showConfirmDialog && (
        <div className="confirm-dialog-enter fixed inset-y-0 right-0 z-50 w-full max-w-[460px] border-l border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 shadow-elevated">
          <div className="h-full overflow-y-auto" onClick={event => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <h3 className="text-xl font-medium text-[var(--text-primary)]">
                {waitingConfirmChapter === 0
                  ? '确认策划方案'
                  : `确认第${waitingConfirmChapter}章`
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
            {/* 预览内容 */}
            {waitingConfirmChapter === 0 && project && project.file_path && (
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">策划方案预览：</label>
                <div className="max-h-[42vh] overflow-y-auto rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(planPreview || '加载中...') }}
                />
              </div>
            )}
            {waitingConfirmChapter !== 0 && chapter && (
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">章节预览：</label>
                <div className="max-h-[42vh] overflow-y-auto whitespace-pre-wrap rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4 text-[var(--text-body)] leading-relaxed">
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
                  className="min-h-[120px] w-full rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-body)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] transition-all duration-150"
                  placeholder="例如：'主角人设不对，请修改' / '情节发展太快，放慢节奏增加细节'..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                />
              </div>
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSubmitConfirmation(true)}
                >
                  通过
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSubmitConfirmation(false)}
                  disabled={!feedbackText.trim()}
                >
                  不通过
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selection Floating Toolbar */}
      <SelectionToolbar />

      {/* Editor Status Bar */}
      <EditorStatusBar />
    </div>
  )
}

export default Editor
