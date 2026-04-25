import React, { useMemo } from 'react'

interface CanvasContainerProps {
  children: React.ReactNode
  maxWidth?: number
  focusMode?: boolean
}

export const CanvasContainer: React.FC<CanvasContainerProps> = React.memo(({
  children,
  maxWidth = 720,
  focusMode = false,
}) => {
  const contentMaxWidth = useMemo(() =>
    focusMode ? Math.max(maxWidth, 900) : maxWidth,
    [focusMode, maxWidth]
  )

  return (
    <div
      className={`w-full h-full transition-all duration-200 ease-out canvas-container ${
        focusMode ? 'focus-mode-active' : ''
      }`}
      style={{
        padding: '32px',
      }}
      data-testid="canvas-container"
      role="main"
      aria-label="Main content area"
    >
      <div
        style={{
          maxWidth: `${contentMaxWidth}px`,
          margin: '0 auto',
          transition: 'max-width 200ms ease-out',
          willChange: 'max-width',
        }}
        data-testid="canvas-content"
      >
        {children}
      </div>
    </div>
  )
})

CanvasContainer.displayName = 'CanvasContainer'

export default CanvasContainer
