import React from 'react'

type Variant = 'agent' | 'status' | 'genre'

interface BadgeProps {
  children: React.ReactNode
  variant?: Variant
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'agent',
  className = '',
}) => {
  const variantClasses: Record<Variant, string> = {
    agent: 'bg-sage/12 text-sage border border-sage/25',
    status: 'bg-terracotta/10 text-terracotta',
    genre: 'bg-faded-rose/08 text-faded-rose',
  }

  const classes = `${variantClasses[variant]} px-3 py-1 rounded-pill text-sm font-medium tracking-wider uppercase ${className}`

  return (
    <span className={classes}>
      {children}
    </span>
  )
}

export default Badge
