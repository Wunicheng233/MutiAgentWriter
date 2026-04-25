import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useLayoutStore } from '../../store/useLayoutStore'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { NavRail } from './NavRail'
import { CanvasContainer } from './CanvasContainer'
import { RightPanel } from './RightPanel'
import { AIChatPanel } from '../ai/AIChatPanel'
import { FloatingToggleButton } from '../FloatingToggleButton'
import { NavBar } from '../NavBar'

export const AppLayout = () => {
  useLocation()

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

  useKeyboardShortcuts()

  useEffect(() => {
    if (focusMode) {
      document.body.classList.add('focus-mode-active')
    } else {
      document.body.classList.remove('focus-mode-active')
    }
  }, [focusMode])

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
        {/* Top Navigation Bar */}
        <NavBar />

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
