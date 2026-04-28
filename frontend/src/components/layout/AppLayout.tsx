import { useEffect, useRef } from 'react'
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
import { AIChatPanel } from '../ai/AIChatPanel'
import { FloatingToggleButton } from '../FloatingToggleButton'
import { NavBar } from '../NavBar'
import { ProjectHeader } from './ProjectHeader'
import { getProject } from '../../utils/endpoints'

export const AppLayout = () => {
  useLocation()
  const { id: projectId } = useParams<{ id: string }>()
  const { showToast } = useToast()
  const notifiedStatusRef = useRef<string | null>(null)

  const {
    navCollapsed,
    rightPanelOpen,
    rightPanelWidth,
    focusMode,
    setRightPanelWidth,
    toggleNavCollapsed,
  } = useLayoutStore(
    useShallow((state) => ({
      navCollapsed: state.navCollapsed,
      rightPanelOpen: state.rightPanelOpen,
      rightPanelWidth: state.rightPanelWidth,
      focusMode: state.focusMode,
      setRightPanelWidth: state.setRightPanelWidth,
      toggleNavCollapsed: state.toggleNavCollapsed,
    }))
  )

  const { isInProject, setProjectStatus } = useProjectStore(
    useShallow((state) => ({
      isInProject: state.isInProject,
      setProjectStatus: state.setProjectStatus,
    }))
  )

  useKeyboardShortcuts()

  useEffect(() => {
    if (focusMode) {
      document.body.classList.add('focus-mode-active')
    } else {
      document.body.classList.remove('focus-mode-active')
    }
  }, [focusMode])

  // 全局项目状态轮询 - 当在项目内时每3秒检查一次状态
  const parsedProjectId = projectId ? parseInt(projectId, 10) : 0
  const isValidProjectId = !Number.isNaN(parsedProjectId) && parsedProjectId > 0

  useQuery({
    queryKey: ['project-global-status', parsedProjectId],
    queryFn: async () => {
      const project = await getProject(parsedProjectId)

      // 更新 ProjectStore 中的状态
      const progress = project.current_generation_task?.progress ?? 0
      const progressPercent = project.status === 'completed' ? 100 : progress * 100
      setProjectStatus(project.status as ProjectStatus, progressPercent)

      // 当状态变为 waiting_confirm 时显示通知（只通知一次）
      if (project.status === 'waiting_confirm' && notifiedStatusRef.current !== 'waiting_confirm') {
        notifiedStatusRef.current = 'waiting_confirm'
        showToast('项目等待人工确认，请前往概览页面处理', 'info')
      } else if (project.status !== 'waiting_confirm' && notifiedStatusRef.current === 'waiting_confirm') {
        // 状态改变后重置通知标记
        notifiedStatusRef.current = null
      }

      // 生成完成通知（仅当从生成状态变为完成时）
      if (project.status === 'completed' && notifiedStatusRef.current !== 'completed') {
        const hadProgress = notifiedStatusRef.current === 'generating' || notifiedStatusRef.current === 'waiting_confirm'
        if (hadProgress) {
          notifiedStatusRef.current = 'completed'
          showToast('🎉 项目已全部生成完成！', 'success')
        }
      }

      return project
    },
    enabled: isInProject && isValidProjectId,
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
      <NavRail collapsed={navCollapsed} onToggleCollapse={toggleNavCollapsed} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header - ProjectHeader or NavBar */}
        {isInProject ? <ProjectHeader /> : <NavBar />}

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
          className="h-full right-panel-container"
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
            onClose={() => useLayoutStore.getState().setRightPanelOpen(false)}
          >
            <AIChatPanel />
          </RightPanel>
        </div>
      )}

      {/* Floating button to open AI panel (only shown when closed) */}
      <FloatingToggleButton />
    </div>
  )
}

export default AppLayout
