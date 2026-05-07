import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button, Modal, ModalContent, ModalFooter, ModalHeader } from '../v2'
import { useToast } from '../toastContext'
import { submitProblemReport } from '../../utils/endpoints'
import type { ProblemReportCreate } from '../../types/api'

const categoryOptions = [
  { value: 'bug', label: '功能异常' },
  { value: 'generation', label: '生成问题' },
  { value: 'ui', label: '界面体验' },
  { value: 'quality', label: '内容质量' },
  { value: 'account', label: '账号设置' },
  { value: 'other', label: '其他' },
]

const severityOptions = [
  { value: 'medium', label: '一般' },
  { value: 'high', label: '影响主流程' },
  { value: 'critical', label: '完全卡住' },
  { value: 'low', label: '轻微问题' },
]

const FeedbackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    <path d="M8 9h8" />
    <path d="M8 13h5" />
  </svg>
)

function getProjectIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/projects\/(?!new(?:\/|$))(\d+)/)
  if (!match) return null
  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export default function ProblemReportButton() {
  const location = useLocation()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('bug')
  const [severity, setSeverity] = useState('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const projectId = useMemo(() => getProjectIdFromPath(location.pathname), [location.pathname])

  const resetForm = () => {
    setCategory('bug')
    setSeverity('medium')
    setTitle('')
    setDescription('')
  }

  const handleClose = () => {
    if (submitting) return
    setOpen(false)
  }

  const handleSubmit = async () => {
    const trimmedDescription = description.trim()
    if (trimmedDescription.length < 5) {
      showToast('请简单描述你遇到的问题', 'error')
      return
    }

    const route = `${location.pathname}${location.search ?? ''}`
    const payload: ProblemReportCreate = {
      category,
      severity,
      title: title.trim() || null,
      description: trimmedDescription,
      page_url: typeof window !== 'undefined' ? window.location.href : null,
      route,
      project_id: projectId,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      context: {
        viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
        route,
        timestamp: new Date().toISOString(),
      },
    }

    setSubmitting(true)
    try {
      await submitProblemReport(payload)
      showToast('问题已提交，我们会带着上下文排查', 'success')
      resetForm()
      setOpen(false)
    } catch {
      showToast('提交失败，请稍后再试', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="non-essential-ui fixed bottom-[5.5rem] right-6 z-40 h-10 w-10 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] shadow-[var(--shadow-default)] transition-all duration-150 hover:-translate-y-0.5 hover:text-[var(--accent-primary)] hover:shadow-[var(--shadow-md)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-opacity-50"
        aria-label="反馈问题"
        title="反馈问题"
        data-testid="problem-report-open"
        onClick={() => setOpen(true)}
      >
        <span className="flex h-full w-full items-center justify-center">
          <FeedbackIcon />
        </span>
      </button>

      <Modal isOpen={open} onClose={handleClose} size="lg">
        <ModalHeader>反馈问题</ModalHeader>
        <ModalContent>
          <div className="space-y-5">
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              会自动附带当前页面、项目和浏览器信息，方便定位公测问题。
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">问题类型</span>
                <select
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {categoryOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">影响程度</span>
                <select
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value)}
                >
                  {severityOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">标题</span>
              <input
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                value={title}
                maxLength={120}
                placeholder="例如：逐章共创确认后没有继续生成"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">问题描述</span>
              <textarea
                className="min-h-[140px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 leading-7 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                value={description}
                maxLength={4000}
                placeholder="告诉我们你做了什么、期望发生什么、实际发生了什么。"
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>取消</Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>提交反馈</Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
