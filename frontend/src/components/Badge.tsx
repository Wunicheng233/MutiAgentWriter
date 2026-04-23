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
    agent: 'bg-sage/12 text-sage border border-sage/25',
    status: 'bg-terracotta/10 text-terracotta',
    genre: 'bg-faded-rose/08 text-faded-rose',
    secondary: 'bg-secondary/10 text-secondary',
  }

  const classes = `${variantClasses[variant]} px-3 py-1 rounded-pill text-sm font-medium tracking-wider uppercase ${className}`

  return (
    <span className={classes}>
      {children}
    </span>
  )
}

export default Badge
