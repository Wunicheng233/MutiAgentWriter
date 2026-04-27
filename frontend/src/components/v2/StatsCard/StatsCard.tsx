import React from 'react'

export type StatsCardVariant = 'default' | 'primary' | 'success' | 'warning' | 'error'

export interface StatsCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  variant?: StatsCardVariant
  className?: string
}

const variantClasses: Record<StatsCardVariant, string> = {
  default: '',
  primary: 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/20',
  success: 'bg-[var(--accent-success)]/10 border-[var(--accent-success)]/20',
  warning: 'bg-[var(--accent-gold)]/10 border-[var(--accent-gold)]/20',
  error: 'bg-[var(--accent-error)]/10 border-[var(--accent-error)]/20',
}

export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  icon,
  variant = 'default',
  className = '',
}) => {
  const displayValue = typeof value === 'number'
    ? value.toLocaleString()
    : value

  return (
    <div
      className={`
        rounded-standard border border-[var(--border-default)]
        bg-[var(--bg-secondary)] px-4 py-3 text-center
        transition-all hover:border-[var(--border-strong)]
        ${variantClasses[variant]}
        ${className}
      `.trim()}
    >
      {icon && <div className="mb-1">{icon}</div>}
      <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 text-[var(--text-primary)] font-medium">
        {displayValue}
      </p>
    </div>
  )
}

StatsCard.displayName = 'StatsCard'
