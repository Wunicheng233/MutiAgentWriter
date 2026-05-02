import React from 'react'

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'agent' | 'status' | 'genre'

export interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  primary: 'bg-[var(--badge-primary-bg)] text-[var(--badge-primary-text)] border border-[var(--badge-primary-border)]',
  secondary: 'bg-[var(--badge-secondary-bg)] text-[var(--badge-secondary-text)] border border-[var(--badge-secondary-border)]',
  success: 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border border-[var(--badge-success-border)]',
  warning: 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border border-[var(--badge-warning-border)]',
  error: 'bg-[var(--badge-error-bg)] text-[var(--badge-error-text)] border border-[var(--badge-error-border)]',
  agent: 'bg-[var(--badge-agent-bg)] text-[var(--badge-agent-text)] border border-[var(--badge-agent-border)]',
  status: 'bg-[var(--badge-status-bg)] text-[var(--badge-status-text)] border border-[var(--badge-status-border)]',
  genre: 'bg-[var(--badge-genre-bg)] text-[var(--badge-genre-text)] border border-[var(--badge-genre-border)]',
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  children,
  className = '',
}) => {
  const baseClasses = `
    inline-flex items-center justify-center
    px-2.5 py-0.5 text-xs font-medium
    rounded-[var(--radius-sm)]
  `

  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`.trim()

  return <span className={classes}>{children}</span>
}

Badge.displayName = 'Badge'
