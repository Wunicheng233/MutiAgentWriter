import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../v2'
import { markOnboardingTourComplete } from './onboardingTourState'

type TourStep = {
  eyebrow: string
  title: string
  body: string
  selector: string
  targetLabel: string
  actionLabel?: string
  actionHref?: string
}

const tourSteps: TourStep[] = [
  {
    eyebrow: 'API',
    title: '先确认模型能跑',
    body: '选择供应商，填真实 Base URL、模型 ID 和 API Key，然后先点测试连接。火山方舟的模型 ID 直接复制控制台调用示例里的 model 值。',
    selector: '[data-tour="settings-api"]',
    targetLabel: '设置页的模型供应商表单',
    actionLabel: '打开 API 设置',
    actionHref: '/settings?tab=ai',
  },
  {
    eyebrow: 'Create',
    title: '用小说信息创建项目',
    body: '书架右上角是新建入口。进入后填写小说名称、核心钩子、章节范围和协作模式。',
    selector: '[data-tour="dashboard-create"]',
    targetLabel: '书架里的新建项目按钮',
    actionLabel: '打开书架',
    actionHref: '/dashboard',
  },
  {
    eyebrow: 'Brief',
    title: '按步骤补齐创作 Brief',
    body: '创建页会阻止跳步骤创建空项目。内容类型、题材、章节范围、作家风格 Skill 都会进入后续生成上下文。',
    selector: '[data-tour="create-project-form"]',
    targetLabel: '新建项目表单',
    actionLabel: '打开创建页',
    actionHref: '/projects/new',
  },
  {
    eyebrow: 'Preflight',
    title: '在概览页做生成前检查',
    body: '启动生成前，概览会显示预计章节、字数、Token 和模型配置风险。红色提示要先处理。',
    selector: '[data-tour="overview-generate"]',
    targetLabel: '项目概览里的生成控制区',
  },
  {
    eyebrow: 'Co-create',
    title: '确认策划和章节',
    body: '策划确认和逐章共创都会弹出确认面板。通过后继续，不通过则写反馈让系统定向修订。',
    selector: '[data-tour="overview-confirmation"]',
    targetLabel: '等待确认提示条',
  },
  {
    eyebrow: 'Editor',
    title: '编辑器里做局部打磨',
    body: '选中段落后用 AI 润色、扩写、缩写或增强戏剧张力。局部改动比整章重写更稳定。',
    selector: '[data-tour="editor-paper"]',
    targetLabel: '章节编辑区域',
  },
  {
    eyebrow: 'Delivery',
    title: '质量复盘并导出分享',
    body: '质量中心看评分和问题定位，历史版本保留修改轨迹，导出分享生成 EPUB、DOCX、HTML 或公开链接。',
    selector: '[data-tour="export-panel"], [data-tour="nav-export"]',
    targetLabel: '导出分享入口',
    actionLabel: '查看帮助',
    actionHref: '/guide',
  },
]

type SpotlightRect = {
  top: number
  left: number
  width: number
  height: number
}

function getSpotlightRect(element: HTMLElement): SpotlightRect {
  const rect = element.getBoundingClientRect()
  const padding = 10
  return {
    top: Math.max(12, rect.top - padding),
    left: Math.max(12, rect.left - padding),
    width: Math.min(window.innerWidth - 24, rect.width + padding * 2),
    height: Math.min(window.innerHeight - 24, rect.height + padding * 2),
  }
}

function getPanelStyle(target: SpotlightRect | null): React.CSSProperties {
  const margin = 20
  const panelWidth = Math.min(420, window.innerWidth - 32)
  const panelHeight = 360

  if (!target) {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: panelWidth,
    }
  }

  const canPlaceRight = target.left + target.width + margin + panelWidth <= window.innerWidth
  const canPlaceLeft = target.left - margin - panelWidth >= 0
  const left = canPlaceRight
    ? target.left + target.width + margin
    : canPlaceLeft
      ? target.left - panelWidth - margin
      : Math.max(16, Math.min(window.innerWidth - panelWidth - 16, target.left))
  const top = Math.max(16, Math.min(window.innerHeight - panelHeight - 16, target.top + target.height / 2 - panelHeight / 2))

  return {
    left,
    top,
    width: panelWidth,
  }
}

export function OnboardingTour({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const step = tourSteps[stepIndex]
  const isLast = stepIndex === tourSteps.length - 1
  const panelStyle = getPanelStyle(spotlightRect)

  const moveToStep = useCallback((nextIndex: number | ((value: number) => number)) => {
    setSpotlightRect(null)
    setStepIndex((value) => {
      const resolved = typeof nextIndex === 'function' ? nextIndex(value) : nextIndex
      return Math.max(0, Math.min(tourSteps.length - 1, resolved))
    })
  }, [])

  const handleFinish = useCallback(() => {
    setSpotlightRect(null)
    setStepIndex(0)
    markOnboardingTourComplete()
    onClose()
  }, [onClose])

  const updateSpotlight = useCallback(() => {
    if (!open) return false
    const target = document.querySelector<HTMLElement>(step.selector)
    if (!target) {
      setSpotlightRect(null)
      return false
    }
    target.scrollIntoView({ block: 'center', inline: 'center' })
    setSpotlightRect(getSpotlightRect(target))
    return true
  }, [open, step.selector])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleFinish()
      if (event.key === 'ArrowRight') moveToStep((value) => value + 1)
      if (event.key === 'ArrowLeft') moveToStep((value) => value - 1)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleFinish, moveToStep, open])

  useEffect(() => {
    if (!open) return
    let frame: number | null = null
    let retryTimer: number | null = null

    const clearScheduledWork = () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      frame = null
      retryTimer = null
    }

    const scheduleSpotlightUpdate = (attempt = 0) => {
      clearScheduledWork()
      frame = window.requestAnimationFrame(() => {
        const found = updateSpotlight()
        if (!found && attempt < 8) {
          retryTimer = window.setTimeout(() => scheduleSpotlightUpdate(attempt + 1), 120)
        }
      })
    }

    scheduleSpotlightUpdate()
    const handleViewportChange = () => scheduleSpotlightUpdate()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      clearScheduledWork()
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [location.pathname, location.search, open, stepIndex, updateSpotlight])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[80] pointer-events-none" data-testid="onboarding-tour">
      {!spotlightRect && (
        <div className="absolute inset-0 bg-[rgba(30,24,18,0.48)] backdrop-blur-sm" />
      )}
      {spotlightRect && (
        <div
          data-testid="tour-spotlight"
          className="absolute rounded-[var(--radius-lg)] border-2 border-[var(--accent-primary)] bg-[rgba(var(--accent-primary-rgb),0.08)] shadow-[0_0_0_9999px_rgba(30,24,18,0.50)] transition-all duration-300 ease-out"
          style={spotlightRect}
        >
          <div className="absolute -inset-1 rounded-[var(--radius-lg)] border border-[rgba(var(--accent-primary-rgb),0.35)]" />
        </div>
      )}

      <section
        className="fixed pointer-events-auto max-h-[calc(100vh-32px)] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 shadow-[var(--shadow-xl)] transition-all duration-300 ease-out"
        style={panelStyle}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Guided Tour</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">快速上手 StoryForge</h2>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            className="rounded-[var(--radius-sm)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            aria-label="关闭引导"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mb-5 flex gap-2" aria-label="引导进度">
          {tourSteps.map((item, index) => (
            <button
              key={item.title}
              type="button"
              aria-label={`跳到第 ${index + 1} 步`}
              onClick={() => moveToStep(index)}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                index <= stepIndex ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-default)]'
              }`}
            />
          ))}
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-primary)]">{step.eyebrow}</p>
          <h3 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">{step.title}</h3>
          <p className="mt-4 leading-7 text-[var(--text-secondary)]">{step.body}</p>
          <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            {spotlightRect
              ? `正在高亮真实界面：${step.targetLabel}`
              : step.actionHref
                ? `当前页面没有找到“${step.targetLabel}”，可先打开对应页面。`
                : `当前页面没有“${step.targetLabel}”。进入一个项目后，这一步会高亮真实区域。`}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={stepIndex === 0}
            onClick={() => moveToStep((value) => value - 1)}
          >
            上一步
          </Button>
          <div className="flex gap-2">
            {step.actionHref && step.actionLabel && (
              <Button
                variant={spotlightRect ? 'tertiary' : 'secondary'}
                size="sm"
                onClick={() => navigate(step.actionHref!)}
              >
                {step.actionLabel}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (isLast) {
                  handleFinish()
                } else {
                  moveToStep((value) => value + 1)
                }
              }}
            >
              {isLast ? '完成' : '下一步'}
            </Button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  )
}

export default OnboardingTour
