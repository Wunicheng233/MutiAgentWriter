import React from 'react'

interface ThreeColumnLayoutProps {
  nav: React.ReactNode
  canvas: React.ReactNode
  rightPanel: React.ReactNode
  rightPanelOpen?: boolean
  navCollapsed?: boolean
}

export const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({
  nav,
  canvas,
  rightPanel,
  rightPanelOpen = false,
  navCollapsed = false,
}) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-primary)]">
      {/* Left Nav Rail */}
      <div
        className="flex-shrink-0 transition-all duration-200 ease-out"
        style={{ width: navCollapsed ? '12px' : '60px' }}
        data-testid="nav-container"
      >
        {nav}
      </div>

      {/* Center Canvas */}
      <div className="flex-1 overflow-auto relative" data-testid="canvas-container">
        {canvas}
      </div>

      {/* Right AI Panel */}
      <div
        className="flex-shrink-0 transition-all duration-200 ease-out overflow-hidden"
        style={{
          width: rightPanelOpen ? '320px' : '0px',
          minWidth: rightPanelOpen ? '320px' : '0px',
        }}
        data-testid="right-panel-container"
      >
        {rightPanel}
      </div>
    </div>
  )
}

export default ThreeColumnLayout
