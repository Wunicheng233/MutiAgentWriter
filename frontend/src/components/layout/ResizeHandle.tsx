import React, { useState, useCallback, useEffect } from 'react'

interface ResizeHandleProps {
  onResize: (width: number) => void
  minWidth?: number
  maxWidth?: number
  currentWidth: number
}

export const ResizeHandle: React.FC<ResizeHandleProps> = React.memo(({
  onResize,
  minWidth = 240,
  maxWidth = 480,
  currentWidth,
}) => {
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
      onResize(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    // Set global cursor during drag
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      // Restore cursor and selection
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, minWidth, maxWidth, onResize])

  return (
    <div
      data-testid="resize-handle"
      role="separator"
      aria-label="Resize panel"
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={currentWidth}
      tabIndex={0}
      className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize transition-colors duration-150 hover:bg-[rgba(var(--accent-primary-rgb),0.20)] focus:outline-none focus:bg-[rgba(var(--accent-primary-rgb),0.30)]"
      onMouseDown={handleMouseDown}
      style={{
        backgroundColor: isDragging ? 'var(--accent-primary)' : 'transparent',
        opacity: isDragging ? 0.3 : 1,
        willChange: 'background-color, opacity',
      }}
    />
  )
})

ResizeHandle.displayName = 'ResizeHandle'

export default ResizeHandle
