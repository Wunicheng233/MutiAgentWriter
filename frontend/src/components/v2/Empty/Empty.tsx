import React from 'react'

export type EmptyIconType = 'document' | 'folder' | 'list' | 'chart'

export interface EmptyProps {
  icon?: EmptyIconType | React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

// Document icon
const DocumentIcon = () => (
  <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 8h20c2 0 4 2 4 4v40c0 2-2 4-4 4H20c-2 0-4-2-4-4V12c0-2 2-4 4-4z" />
    <path d="M28 20h8M28 28h16M28 36h12" />
  </svg>
)

// Folder icon
const FolderIcon = () => (
  <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 16h18l4 4h26a2 2 0 0 1 2 2v26a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V18a2 2 0 0 1 2-2z" />
  </svg>
)

// List icon
const ListIcon = () => (
  <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16h40M12 28h40M12 40h40M12 52h40" />
    <circle cx="8" cy="16" r="2" />
    <circle cx="8" cy="28" r="2" />
    <circle cx="8" cy="40" r="2" />
    <circle cx="8" cy="52" r="2" />
  </svg>
)

// Chart icon
const ChartIcon = () => (
  <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 48V28M24 48V16M36 48V24M48 48V8" strokeWidth="3" />
    <path d="M8 48h48" strokeWidth="3" />
  </svg>
)

const iconMap: Record<EmptyIconType, React.FC> = {
  document: DocumentIcon,
  folder: FolderIcon,
  list: ListIcon,
  chart: ChartIcon,
}

export const Empty: React.FC<EmptyProps> = ({
  icon = 'document',
  title = '暂无数据',
  description,
  action,
  className = '',
}) => {
  const renderIcon = () => {
    if (typeof icon === 'string' && iconMap[icon as EmptyIconType]) {
      const IconComponent = iconMap[icon as EmptyIconType]
      return <IconComponent />
    }
    return icon
  }

  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center max-w-sm mx-auto ${className}`.trim()}>
      <div className="text-[var(--text-muted)] mb-4">
        {renderIcon()}
      </div>
      {title && (
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          {description}
        </p>
      )}
      {action && (
        <div>{action}</div>
      )}
    </div>
  )
}

Empty.displayName = 'Empty'
