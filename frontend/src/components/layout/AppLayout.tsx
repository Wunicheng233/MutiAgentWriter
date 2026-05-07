import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useQuery } from '@tanstack/react-query'
import { useLayoutStore } from '../../store/useLayoutStore'
import { useProjectStore, type ProjectStatus } from '../../store/useProjectStore'
import { useToast } from '../toastContext'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { NavRail } from './NavRail'
import { CanvasContainer } from './CanvasContainer'
import { RightPanel } from './RightPanel'
import { AIPanel } from '../ai/AIPanel'
import { FloatingToggleButton } from '../FloatingToggleButton'
import { NavBar } from '../NavBar'
import { ProjectHeader } from './ProjectHeader'
import ProblemReportButton from '../feedback/ProblemReportButton'
import { getProject } from '../../utils/endpoints'
import CommandPalette from '../CommandPalette/CommandPalette'
import OnboardingTour from '../onboarding/OnboardingTour'
import { shouldShowOnboardingTour } from '../onboarding/onboardingTourState'

const NavExpandIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18l6-6-6-6" />
  </svg>
)

export const AppLayout = () => {
  const location = useLocation()
  const { id: projectId } = useParams<{ id: string }>()
  const { showToast } = useToast()
  const notifiedStatusRef = useRef<string | null>(null)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const routeProjectId = location.pathname.match(/^\/projects\/(?!new(?:\/|$))([^/]+)/)?.[1] ?? projectId ?? null
  const isProjectRoute = !!routeProjectId

  const {
    navCollapsed,
    rightPanelOpen,
    rightPanelWidth,
    focusMode,
    setRightPanelWidth,
    setRightPanelOpen,
    toggleNavCollapsed,
  } = useLayoutStore(
    useShallow((state) => ({
      navCollapsed: state.navCollapsed,
      rightPanelOpen: state.rightPanelOpen,
      rightPanelWidth: state.rightPanelWidth,
      focusMode: state.focusMode,
      setRightPanelWidth: state.setRightPanelWidth,
      setRightPanelOpen: state.setRightPanelOpen,
      toggleNavCollapsed: state.toggleNavCollapsed,
    }))
  )

  const { setProjectStatus } = useProjectStore(
    useShallow((state) => ({
      setProjectStatus: state.setProjectStatus,
    }))
  )

  useKeyboardShortcuts()

  useEffect(() => {
    if (!shouldShowOnboardingTour()) return
    const timer = window.setTimeout(() => {
      setOnboardingOpen(true)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (focusMode) {
      document.body.classList.add('focus-mode-active')
    } else {
      document.body.classList.remove('focus-mode-active')
    }
  }, [focusMode])

  // 全局项目状态轮询 - 当在项目内时每3秒检查一次状态
  const parsedProjectId = routeProjectId ? parseInt(routeProjectId, 10) : 0
  const isValidProjectId = !Number.isNaN(parsedProjectId) && parsedProjectId > 0

  useQuery({
    queryKey: ['project-global-status', parsedProjectId],
    queryFn: async () => {
      const project = await getProject(parsedProjectId)
      const task = project.current_generation_task

      // 更新 ProjectStore 中的状态
      const progress = task?.progress ?? 0
      const progressPercent = project.status === 'completed' ? 100 : progress * 100
      setProjectStatus(project.status as ProjectStatus, progressPercent)

      // 任务级别的 waiting_confirm 状态通知（只通知一次）
      if (task?.status === 'waiting_confirm' && notifiedStatusRef.current !== 'waiting_confirm') {
        notifiedStatusRef.current = 'waiting_confirm'
        showToast('项目等待人工确认，请前往概览页面处理', 'info')
      } else if (task?.status !== 'waiting_confirm' && notifiedStatusRef.current === 'waiting_confirm') {
        // 状态改变后重置通知标记
        notifiedStatusRef.current = null
      }

      // 生成完成通知（仅当从生成状态变为完成时）
      if (project.status === 'completed' && notifiedStatusRef.current !== 'completed') {
        const hadProgress = notifiedStatusRef.current === 'generating' || notifiedStatusRef.current === 'waiting_confirm'
        if (hadProgress) {
          notifiedStatusRef.current = 'completed'
          showToast('项目已全部生成完成', 'success')
        }
      }

      return project
    },
    enabled: isProjectRoute && isValidProjectId,
    refetchInterval: 3000,
    staleTime: 3000,
  })

  return (
    <div
      className={`flex h-screen w-full overflow-hidden bg-[var(--bg-primary)] app-layout ${
        focusMode ? 'focus-mode-active' : ''
      }`}
    >
      {/* Left Navigation Rail */}
      {!navCollapsed ? (
        <NavRail collapsed={false} onToggleCollapse={toggleNavCollapsed} />
      ) : (
        <button
          type="button"
          onClick={toggleNavCollapsed}
          className="non-essential-ui fixed left-3 bottom-5 z-50 h-10 w-10 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)] shadow-[var(--shadow-default)] transition-all duration-150 hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-opacity-50"
          title="展开侧边栏"
          aria-label="展开侧边栏"
          data-testid="nav-rail-reopen"
        >
          <NavExpandIcon />
        </button>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header - ProjectHeader or NavBar */}
        {isProjectRoute ? <ProjectHeader /> : <NavBar />}

        {/* Center Canvas Content - takes remaining space and scrolls */}
        <div className="flex-1 overflow-auto">
          <CanvasContainer>
            <Outlet />
          </CanvasContainer>
        </div>
      </div>

      {/* Right AI Panel */}
      {rightPanelOpen && (
        <div
          className="non-essential-ui h-full right-panel-container"
          style={{
            width: `${rightPanelWidth}px`,
            minWidth: `${rightPanelWidth}px`,
            transition: 'width 200ms ease-out',
          }}
        >
          <RightPanel
            open={rightPanelOpen}
            width={rightPanelWidth}
            onResize={setRightPanelWidth}
            onClose={() => setRightPanelOpen(false)}
          >
            <AIPanel />
          </RightPanel>
        </div>
      )}

      {/* Floating button to open AI panel (only shown when closed) */}
      <ProblemReportButton />
      <FloatingToggleButton />

      {/* Global Command Palette */}
      <CommandPalette />
      <OnboardingTour open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </div>
  )
}

export default AppLayout
