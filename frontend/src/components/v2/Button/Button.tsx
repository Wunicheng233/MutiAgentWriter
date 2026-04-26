import React, { forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  children: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    children,
    className = '',
    ...props
  }, ref) => {
    const baseClasses = `
      inline-flex items-center justify-center gap-2 font-medium
      rounded-[var(--radius-md)]
      transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]
      focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2
      disabled:cursor-not-allowed disabled:opacity-50
    `

    const variantClasses: Record<ButtonVariant, string> = {
      primary: 'bg-[var(--accent-primary)] text-white hover:opacity-90',
      secondary: 'border border-[var(--border-default)] bg-white text-[var(--text-primary)] hover:border-[var(--accent-primary)]',
      tertiary: 'bg-transparent text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:bg-opacity-5',
      ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]',
      danger: 'bg-red-500 text-white hover:bg-red-600',
    }

    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-base',
      lg: 'px-7 py-3 text-lg',
    }

    const hoverClasses = !disabled && !loading
      ? 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:translate-y-0 active:shadow-none'
      : ''

    const widthClass = fullWidth ? 'w-full' : ''

    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${hoverClasses} ${widthClass} ${className}`.trim()

    const Spinner = () => (
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    )

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={classes}
        {...props}
      >
        {loading && <Spinner />}
        {!loading && leftIcon}
        {children}
        {rightIcon}
      </button>
    )
  }
)

Button.displayName = 'Button'
