import React from 'react'
import ResizeHandle from './ResizeHandle'

interface RightPanelProps {
  open: boolean
  width: number
  onResize: (width: number) => void
  onClose?: () => void
  children: React.ReactNode
}

export const RightPanel: React.FC<RightPanelProps> = React.memo(({ open, width, onResize, onClose, children }) => {
  return (
    <aside
      className="h-full bg-[var(--bg-secondary)] flex flex-col border-l border-[var(--border-default)] relative right-panel"
      data-testid="right-panel"
      style={{ willChange: 'width' }}
      aria-label="AI assistant panel"
      role="complementary"
    >
      {open && <ResizeHandle onResize={onResize} currentWidth={width} minWidth={240} maxWidth={480} />}
      {/* Mobile close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="sm:hidden absolute top-2 right-2 z-10 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] rounded-full transition-colors"
          aria-label="Close panel"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      )}
      {children}
    </aside>
  )
})

RightPanel.displayName = 'RightPanel'

export default RightPanel
