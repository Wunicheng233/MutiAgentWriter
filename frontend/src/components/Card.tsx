import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
}

export const Card: React.FC<CardProps> = ({
  hoverable = false,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'paper-card p-6'
  const hoverClasses = hoverable ? 'paper-card-hover' : ''
  const classes = `${baseClasses} ${hoverClasses} ${className}`

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}

export default Card
