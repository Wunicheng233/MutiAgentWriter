import React from 'react'

interface RightPanelProps {
  open: boolean
  children: React.ReactNode
}

export const RightPanel: React.FC<RightPanelProps> = ({ open, children }) => {
  return (
    <div className="h-full bg-[var(--bg-secondary)] flex flex-col border-l border-[var(--border-default)]" data-testid="right-panel">
      {children}
    </div>
  )
}

export default RightPanel
