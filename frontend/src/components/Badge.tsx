import React from 'react'

export type BadgeVariant = 'agent' | 'status' | 'genre' | 'secondary'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'agent',
  className = '',
}) => {
  const variantClasses: Record<BadgeVariant, string> = {
    agent: 'bg-[var(--accent-primary)] bg-opacity-12 text-[var(--accent-primary)] border border-[var(--accent-primary)] border-opacity-25',
    status: 'bg-[var(--accent-warm)] bg-opacity-10 text-[var(--accent-warm)]',
    genre: 'bg-[var(--accent-soft)] bg-opacity-8 text-[var(--accent-soft)]',
    secondary: 'bg-[var(--text-secondary)] bg-opacity-10 text-[var(--text-secondary)]',
  }

  const classes = `${variantClasses[variant]} px-3 py-1 rounded-full text-sm font-medium tracking-wider uppercase ${className}`

  return (
    <span className={classes}>
      {children}
    </span>
  )
}

export default Badge
