import React, { useState, useCallback, useRef, useEffect } from 'react'

export type TooltipPosition = 'top' | 'right' | 'bottom' | 'left'

export interface TooltipProps {
  content: React.ReactNode
  position?: TooltipPosition
  delay?: number
  children: React.ReactElement
  className?: string
}

const positionClasses: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
}

const arrowClasses: Record<TooltipPosition, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-[var(--text-primary)]',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-[var(--text-primary)]',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[var(--text-primary)]',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-[var(--text-primary)]',
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  delay = 200,
  children,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    showTimeoutRef.current = setTimeout(() => setIsVisible(true), delay)
  }, [delay])

  const handleMouseLeave = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current)
      showTimeoutRef.current = null
    }
    hideTimeoutRef.current = setTimeout(() => setIsVisible(false), 100)
  }, [])

  const handleFocus = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    showTimeoutRef.current = setTimeout(() => setIsVisible(true), delay)
  }, [delay])

  const handleBlur = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current)
      showTimeoutRef.current = null
    }
    hideTimeoutRef.current = setTimeout(() => setIsVisible(false), 100)
  }, [])

  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current)
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  const child = React.Children.only(children)

  return (
    <span
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {React.cloneElement(child)}

      {isVisible && content && (
        <div
          className={`absolute z-40 ${positionClasses[position]} transition-opacity duration-[var(--duration-normal)] ease-[var(--ease-out)]`}
        >
          <div
            className={`px-3 py-1.5 text-xs font-medium text-white bg-[var(--text-primary)] rounded-[var(--radius-md)] shadow-[var(--shadow-md)] whitespace-nowrap ${className}`.trim()}
            role="tooltip"
          >
            {content}
          </div>
          {/* Arrow */}
          <div
            className={`absolute w-0 h-0 border-4 border-transparent ${arrowClasses[position]}`}
          />
        </div>
      )}
    </span>
  )
}

Tooltip.displayName = 'Tooltip'
