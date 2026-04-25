import React from 'react'

type CardVariant = 'default' | 'elevated' | 'outlined'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  variant?: CardVariant
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-[var(--bg-secondary)] border-[var(--border-default)]',
  elevated: 'bg-[var(--bg-secondary)] border-[var(--accent-primary)] border-opacity-20 shadow-[var(--shadow-elevated)]',
  outlined: 'bg-transparent border-2 border-[var(--border-default)]',
}

export const Card: React.FC<CardProps> = ({
  hoverable = false,
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  const baseClasses = `rounded-xl p-6 border transition-all duration-150 ${variantClasses[variant]}`
  const hoverClasses = hoverable ? 'hover:border-[var(--accent-primary)] hover:shadow-[var(--shadow-default)] cursor-pointer' : ''
  const classes = `${baseClasses} ${hoverClasses} ${className}`

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}

export default Card
