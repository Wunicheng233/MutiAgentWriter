import React from 'react'

interface CanvasContainerProps {
  children: React.ReactNode
  maxWidth?: number
  focusMode?: boolean
}

export const CanvasContainer: React.FC<CanvasContainerProps> = ({
  children,
  maxWidth = 720,
  focusMode = false,
}) => {
  return (
    <div
      className="w-full h-full overflow-auto transition-all duration-200 ease-out"
      style={{
        paddingTop: '64px',
        paddingBottom: '128px',
      }}
      data-testid="canvas-container"
    >
      <div
        className="mx-auto"
        style={{ maxWidth: focusMode ? Math.max(maxWidth, 900) : maxWidth }}
        data-testid="canvas-content"
      >
        {children}
      </div>
    </div>
  )
}

export default CanvasContainer
