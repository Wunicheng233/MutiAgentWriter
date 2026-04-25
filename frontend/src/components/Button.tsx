import React from 'react'

type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'default' | 'sm'
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'default',
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'rounded-full font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-opacity-25 disabled:cursor-not-allowed disabled:opacity-50'

  const variantClasses: Record<Variant, string> = {
    primary: 'bg-[var(--accent-primary)] text-white shadow-[var(--shadow-default)] hover:-translate-y-0.5 hover:opacity-90 hover:shadow-[var(--shadow-elevated)] active:translate-y-0',
    secondary: 'border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:bg-opacity-5',
    tertiary: 'bg-transparent text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:bg-opacity-5 hover:text-[var(--text-primary)]',
    ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--text-primary)] hover:bg-opacity-5 hover:text-[var(--text-primary)] rounded-full p-2',
  }

  const sizeClasses = {
    default: 'px-6 py-3 text-base',
    sm: 'px-4 py-2 text-sm',
  }

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}

export default Button
