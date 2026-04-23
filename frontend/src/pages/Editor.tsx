import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ProgressBar } from '../components/ProgressBar'
import AgentCard from '../components/AgentCard'
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

// 精简架构：仅 4 个核心 Agent
const agentNames = [
  'planner', 'writer', 'critic', 'revise',
]

export const Editor: React.FC = () => {
  const { id, chapterIndex } = useParams<{ id: string; chapterIndex: string }>()
  const projectId = parseInt(id!)
  const chapterIdx = parseInt(chapterIndex!)
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [pollingTaskId, setPollingTaskId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [agentStates, setAgentStates] = useState<Record<string, 'idle' | 'running' | 'done' | 'error'>>({
    planner: 'idle',
    writer: 'idle',
    critic: 'idle',
    revise: 'idle',
  })
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versions, setVersions] = useState<ChapterVersionInfo[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [waitingConfirmChapter, setWaitingConfirmChapter] = useState<number | null>(null)
  const [planPreview, setPlanPreview] = useState<string>('')

  // 简单 markdown 渲染
  const renderMarkdown = (text: string) => {
    // 处理 markdown 表格
    const lines = text.split('\n');
    const processedLines: string[] = [];
    let tableStarted = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (!tableStarted) {
          processedLines.push('<table class="border-collapse my-3 w-full bg-bg rounded border border-border overflow-hidden">');
          tableStarted = true;
        }
        // 分割单元格
        const cells = line.split('|').filter(c => c.trim().length > 0);
        // 判断是否是分隔线行 (| :--- | :--- |)
        const isSeparator = cells.every(c => /^[\s\-:]+$/.test(c.trim()));
        if (isSeparator) {
          continue;
        }
        processedLines.push('  <tr>');
        cells.forEach(cell => {
          processedLines.push(`    <td class="border border-border p-2 align-top">${cell.trim()}</td>`);
        });
        processedLines.push('  </tr>');
      } else {
        if (tableStarted) {
          processedLines.push('</table>');
          tableStarted = false;
        }
        if (line.trim()) {
          processedLines.push(line);
        }
      }
    }
    if (tableStarted) {
      processedLines.push('</table>');
    }

    let html = processedLines.join('\n');

    // 处理标题、粗体等
    html = html
      .replace(/^# (.*)$/gm, '<h1 class="text-xl font-bold mb-2 mt-4">$1</h1>')
      .replace(/^## (.*)$/gm, '<h2 class="text-lg font-semibold mb-2 mt-3">$1</h2>')
      .replace(/^### (.*)$/gm, '<h3 class="text-base font-semibold mb-1 mt-2">$1</h3>')
      .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*)\*/g, '<em>$1</em>')
      .replace(/\[(.*)\]\((.*)\)/g, '<a href="$2" class="underline text-sage">$1</a>')
      .replace(/^- /gm, '<li class="ml-4 list-disc">')
      .replace(/\n\n+/g, '</p><p>');

    // 包装段落
    if (!html.startsWith('<h') && !html.startsWith('<table') && !html.startsWith('<li')) {
      html = '<p>' + html;
    }
    if (!html.endsWith('</table>') && !html.endsWith('</h1>') && !html.endsWith('</h2>') && !html.endsWith('</h3>') && !html.endsWith('</li>')) {
      html = html + '</p>';
    }

    return html;
  };

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  })

  const { data: chapter, isLoading } = useQuery({
    queryKey: ['chapter', projectId, chapterIdx],
    queryFn: () => getChapter(projectId, chapterIdx),
    // 只有在以下情况才查询章节：
    // 1. 没有正在进行的生成任务，用户正常编辑
    // 2. 正在等待确认，并且是章节确认（不是策划确认）
    enabled: pollingTaskId === null || (waitingConfirmChapter !== null && waitingConfirmChapter > 0),
    // 禁用错误重试，避免连续弹出"章节不存在"错误
    retry: false,
  })

  // 根据当前进度和当前步骤更新 Agent 状态
  const updateAgentStatesFromProgress = useCallback((progress: number, _currentChapter: number | null | undefined, currentStep: string = '') => {
    setAgentStates(prevAgentStates => {
      const newStates = { ...prevAgentStates }
      // 重置所有状态为 idle
      Object.keys(newStates).forEach(k => newStates[k as keyof typeof newStates] = 'idle')

      // 1. 优先从 currentStep 文本判断当前 Agent（最准确）
      // 精简架构顺序: Planner → Writer → Critic → Revise → Critic (复评)
      const agentOrder = ['planner', 'writer', 'critic', 'revise'] as const
      let currentAgent: (typeof agentOrder)[number] | null = null

      if (currentStep.includes('策划') || currentStep.includes('Planner')) {
        currentAgent = 'planner'
      } else if (currentStep.includes('初稿') || currentStep.includes('生成') || currentStep.includes('Writer') || currentStep.includes('系统层防护')) {
        currentAgent = 'writer'
      } else if (currentStep.includes('评审') || currentStep.includes('Critic')) {
        currentAgent = 'critic'
      } else if (currentStep.includes('修订') || currentStep.includes('Revise')) {
        currentAgent = 'revise'
      }

      if (currentAgent) {
        // 找到了当前 Agent，按顺序设置状态
        const currentIndex = agentOrder.indexOf(currentAgent)
        agentOrder.forEach((name, index) => {
          if (index < currentIndex) {
            newStates[name] = 'done'
          } else if (index === currentIndex) {
            newStates[name] = 'running'
          } else {
            newStates[name] = 'idle'
          }
        })
        return newStates
      }

      // 2. 兜底：如果 currentStep 无法判断，使用进度阈值判断
      // 精简架构顺序: Planner → Writer → Critic → Revise
      if (progress < 0.15) {
        newStates.planner = 'running'
      } else if (progress < 0.20) {
        newStates.planner = 'done'
        newStates.writer = 'running'
      } else {
        newStates.planner = 'done'
        // 根据步骤描述判断当前哪个Agent在运行
        if (currentStep.includes('初稿生成') || currentStep.includes('正在生成')) {
          newStates.writer = 'running'
        } else if (currentStep.includes('评审')) {
          newStates.writer = 'done'
          newStates.critic = 'running'
        } else if (currentStep.includes('修订')) {
          newStates.writer = 'done'
          newStates.critic = 'done'
          newStates.revise = 'running'
        } else {
          // 默认显示writer正在运行
          newStates.writer = 'running'
        }
      }

      return newStates
    })
  }, [])

  // 根据项目状态和章节状态初始化Agent状态
  // 如果项目已经完成生成，所有agent都应该显示为完成
  useEffect(() => {
    if (!project) return

    if (project.status === 'completed') {
      // 全部完成，所有agent都是done
      queueMicrotask(() => {
        setAgentStates(prev => {
          const newStates = { ...prev }
          Object.keys(newStates).forEach(k => newStates[k as keyof typeof newStates] = 'done')
          return newStates
        })
      })
    } else if (project.status === 'generating') {
      if (project.current_generation_task) {
        const task = project.current_generation_task
        queueMicrotask(() => {
          setPollingTaskId(task.celery_task_id)
          // 立即根据任务已有进度更新agent状态，不需要等第一次轮询
          const progress = task.progress || 0
          const currentStep = task.current_step || ''
          const currentChapter = task.current_chapter ?? null
          updateAgentStatesFromProgress(progress, currentChapter, currentStep)
        })
      } else if (!pollingTaskId && chapter && chapter.status === 'generated') {
        // 项目还在生成中，但当前章节已经生成完毕，前面的agents都完成了
        queueMicrotask(() => {
          setAgentStates(prev => {
            const newStates = { ...prev }
            newStates.planner = 'done'
            newStates.writer = 'done'
            newStates.critic = 'done'
            newStates.revise = 'done'
            return newStates
          })
        })
      } else if (!pollingTaskId) {
        // 保险措施：项目状态是generating但没有找到current_generation_task，
        // 重新查询项目数据确保我们没漏掉任务
        queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      }
    } else if (chapter && chapter.status === 'generated') {
      // 其他情况（比如draft但已经生成），如果章节已经生成，所有agent完成
      queueMicrotask(() => {
        setAgentStates(prev => {
          const newStates = { ...prev }
          Object.keys(newStates).forEach(k => newStates[k as keyof typeof newStates] = 'done')
          return newStates
        })
      })
    }
  }, [project, projectId, pollingTaskId, queryClient, chapter, updateAgentStatesFromProgress])

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

  // 将纯文本转换为HTML段落格式供TipTap使用
  // AI生成小说通常每一行就是一个段落，即使没有空行
  const convertPlainTextToHtml = useCallback((text: string): string => {
    if (!text) return ''
    // 按换行分割，过滤掉空行，每一行作为一个段落
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line !== '') // 跳过空行
    return lines
      .map(line => `<p>${line}</p>`)
      .join('')
  }, [])

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
    content: chapter?.content ? convertPlainTextToHtml(chapter.content) : '',
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
      const htmlContent = convertPlainTextToHtml(chapter.content)
      editor.commands.setContent(htmlContent)
    }
  }, [editor, chapter?.content, convertPlainTextToHtml])

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
      // 更新 agent 状态
      const newStates = { ...agentStates }
      Object.keys(newStates).forEach(k => newStates[k as keyof typeof newStates] = 'idle')
      newStates.writer = 'running'
      setAgentStates(newStates)
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
        updateAgentStatesFromProgress(status.progress, status.current_chapter, step)

        // 任务等待用户确认
        if (status.db_status === 'waiting_confirm') {
          clearInterval(interval)
          setWaitingConfirmChapter(status.current_chapter ?? null)
          // 如果是策划方案确认，加载预览
          if (status.current_chapter === 0) {
            try {
              const res = await api.get(`/projects/${projectId}/plan-preview`);
              setPlanPreview(res.data.preview);
            } catch (e) {
              setPlanPreview('无法加载策划方案预览');
              console.error('Failed to load plan preview', e);
            }
          }
          setShowConfirmDialog(true)
          return
        }

        if (status.celery_state === 'SUCCESS') {
          setPollingTaskId(null)
          showToast('章节生成完成', 'success')
          queryClient.invalidateQueries({ queryKey: ['chapter', projectId, chapterIdx] })
          queryClient.invalidateQueries({ queryKey: ['project', projectId] })
          window.location.reload()
        }
        if (status.celery_state === 'FAILURE') {
          setPollingTaskId(null)
          showToast(status.error || '生成失败', 'error')
        }
      } catch (e) {
        console.error(e)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [pollingTaskId, showToast, updateAgentStatesFromProgress, projectId, chapterIdx, queryClient])

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
    } catch (e: unknown) {
      showToast(getErrorMessage(e, '提交失败'), 'error')
    }
  }

  // 更新 word count - 统计汉字数量，HTML标签不计入
  const wordCount = chapter?.content
    ? (chapter.content.match(/[\u4e00-\u9fff]/g) || []).length
    : 0

  if (isLoading) {
    return (
      <Layout>
        <p className="text-secondary">加载中...</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl">
            {chapter?.title || `第${chapterIdx}章`}
          </h1>
          {project && <p className="text-secondary mt-2">{project.name}</p>}
        </div>
        <div className="flex gap-2">
          {project?.chapters && project.chapters.length > 1 && (
            <>
              <Link to={`/projects/${id}/write/${chapterIdx - 1}`}>
                <Button variant="secondary" size="sm" disabled={chapterIdx <= 1}>
                  上一章
                </Button>
              </Link>
              <Link to={`/projects/${id}/write/${chapterIdx + 1}`}>
                <Button variant="secondary" size="sm" disabled={chapterIdx >= project.chapters.length}>
                  下一章
                </Button>
              </Link>
            </>
          )}
          <Link to={`/projects/${id}/read/${chapterIdx}`}>
            <Button variant="secondary">阅读模式</Button>
          </Link>
          <Link to={`/projects/${id}/chapters`}>
            <Button variant="secondary">章节列表</Button>
          </Link>
        </div>
      </div>

      {pollingTaskId && (
        <div className="mb-6">
          <ProgressBar progress={progress} message={currentStep || '生成中...'} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* 左侧 Agent 面板 */}
        <div className="order-2 lg:order-1 space-y-6">
          <div>
            <h3 className="text-lg mb-4">智能体状态</h3>
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
              variant={showVersionHistory ? "primary" : "secondary"}
              className="w-full"
              onClick={toggleVersionHistory}
            >
              {showVersionHistory ? "关闭历史版本" : "历史版本"}
            </Button>

            {showVersionHistory && (
              <Card className="mt-4 max-h-[400px] overflow-y-auto">
                <h4 className="font-medium mb-3">保存的版本</h4>
                {versions.length === 0 ? (
                  <p className="text-secondary text-sm">暂无历史版本</p>
                ) : (
                  <div className="space-y-2">
                    {versions.map(ver => (
                      <div
                        key={ver.id}
                        className="flex justify-between items-center p-2 border border-border rounded-standard hover:border-sage/30 transition-colors"
                      >
                        <div>
                          <div className="font-medium text-sm">V{ver.version_number}</div>
                          <div className="text-xs text-secondary">
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
        </div>

        {/* 右侧写作画布 */}
        <div className="order-1 lg:order-2 flex flex-col h-full">
          <div className="bg-parchment border border-border rounded-standard shadow-ambient flex-1 overflow-y-auto min-h-[500px]">
            {editor && (
              <EditorContent
                editor={editor}
                className="prose-novel max-w-canvas mx-auto px-8 pt-0 pb-8 focus:outline-none"
              />
            )}
          </div>
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-secondary">
              {wordCount} 字
              {saving && <span className="ml-3">保存中...</span>}
            </div>
            <div className="flex gap-2">
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

      {/* 人工确认对话框 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            // 点击背景关闭对话框
            setShowConfirmDialog(false);
          }}
        >
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-medium">
                {waitingConfirmChapter === 0
                  ? '策划方案已生成，请确认'
                  : `第${waitingConfirmChapter}章已生成，请确认`
                }
              </h3>
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => setShowConfirmDialog(false)}
                className="!px-2"
              >
                ✕
              </Button>
            </div>
            <p className="text-secondary mb-6">
              {waitingConfirmChapter === 0
                ? '你可以选择直接通过，开始生成章节，或者输入修改意见让AI重新调整策划方案。'
                : '你可以选择直接通过，继续生成下一章，或者输入修改意见让AI重新优化当前章节。'
              }
            </p>
            {/* 预览内容 */}
            {waitingConfirmChapter === 0 && project && project.file_path && (
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">策划方案预览：</label>
                <div className="bg-parchment border border-border rounded-standard p-4 max-h-[40vh] overflow-y-auto text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(planPreview || '加载中...') }}
                />
              </div>
            )}
            {waitingConfirmChapter !== 0 && chapter && (
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">章节预览：</label>
                <div className="bg-parchment border border-border rounded-standard p-4 max-h-[40vh] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: chapter.content || '' }}
                />
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  修改意见（不通过时填写）：
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-border rounded-standard bg-bg focus:outline-none focus:ring-2 focus:ring-sage/50 min-h-[100px]"
                  placeholder="例如：'主角人设不对，请修改' / '情节发展太快，放慢节奏增加细节'..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
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
    </Layout>
  )
}

export default Editor
