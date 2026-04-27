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
      className="h-full bg-[var(--bg-secondary)] flex flex-col border-l border-[var(--border-default)] rounded-tl-[var(--radius-lg)] rounded-bl-[var(--radius-lg)] relative right-panel"
      data-testid="right-panel"
      style={{ willChange: 'width' }}
      aria-label="AI assistant panel"
      role="complementary"
    >
      {open && <ResizeHandle onResize={onResize} currentWidth={width} minWidth={240} maxWidth={480} />}
      {/* 关闭按钮 - 所有屏幕尺寸都显示 */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          aria-label="Close panel"
          title="关闭面板"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
