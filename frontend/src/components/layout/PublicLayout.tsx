import React from 'react'

interface PublicLayoutProps {
  children: React.ReactNode
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* 顶部标题栏 */}
      <nav className="sticky top-0 z-50 bg-[var(--bg-primary)] bg-opacity-90 backdrop-blur-lg border-b border-[var(--border-default)]">
        <div className="max-w-6xl mx-auto px-6 h-[72px] flex items-center justify-center">
          <span className="font-medium text-sm uppercase tracking-[0.24em] text-[var(--text-secondary)]">
            MultiAgentWriter
          </span>
        </div>
      </nav>

      {/* 内容区域 - 垂直居中 */}
      <div className="flex-1 flex items-center justify-center py-8">
        {children}
      </div>
    </div>
  )
}

export default PublicLayout
