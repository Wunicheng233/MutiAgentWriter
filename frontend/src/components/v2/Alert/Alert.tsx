import React from 'react'

export type AlertVariant = 'success' | 'warning' | 'error' | 'info'

export interface AlertProps {
  variant?: AlertVariant
  title?: React.ReactNode
  children: React.ReactNode
  closable?: boolean
  onClose?: () => void
  className?: string
}

const variantClasses: Record<AlertVariant, string> = {
  success: 'border-l-[var(--accent-primary)] bg-[rgba(var(--accent-primary-rgb),0.08)]',
  warning: 'border-l-[var(--accent-gold)] bg-[rgba(var(--accent-gold-rgb),0.10)]',
  error: 'border-l-[var(--accent-warm)] bg-[rgba(var(--accent-warm-rgb),0.10)]',
  info: 'border-l-[var(--accent-primary)] bg-[var(--bg-tertiary)]',
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  closable = false,
  onClose,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`relative p-4 border-l-4 rounded-r-lg ${variantClasses[variant]} ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {title && (
            <div className="font-medium text-[var(--text-primary)] mb-1">
              {title}
            </div>
          )}
          <div className="text-[var(--text-body)] text-sm">{children}</div>
        </div>
        {closable && (
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1 -mr-1 -mt-1"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

Alert.displayName = 'Alert'
