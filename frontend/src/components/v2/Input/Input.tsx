import React, { forwardRef } from 'react'

export type InputSize = 'sm' | 'md' | 'lg'
export type InputStatus = 'default' | 'error' | 'success'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  size?: InputSize
  status?: InputStatus
  errorMessage?: string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  fullWidth?: boolean
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-5 py-3 text-lg',
}

const statusClasses: Record<InputStatus, string> = {
  default: 'border-[var(--border-default)] focus:border-[var(--accent-primary)]',
  error: 'border-red-500 focus:border-red-600',
  success: 'border-green-500 focus:border-green-600',
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    label,
    size = 'md',
    status = 'default',
    errorMessage,
    prefix,
    suffix,
    fullWidth = false,
    className = '',
    ...props
  }, ref) => {
    const baseClasses = `
      bg-[var(--bg-secondary)]
      rounded-[var(--radius-md)]
      transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]
      focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-opacity-20
      text-[var(--text-body)]
      placeholder:text-[var(--text-muted)]
      disabled:cursor-not-allowed disabled:opacity-50
    `

    const widthClass = fullWidth ? 'w-full' : ''
    const hasAffix = prefix || suffix

    const inputClasses = hasAffix
      ? 'bg-transparent border-0 focus:ring-0 w-full'
      : `${baseClasses} ${sizeClasses[size]} ${statusClasses[status]} ${className}`.trim()

    if (hasAffix) {
      return (
        <div className={`flex flex-col gap-1.5 ${widthClass}`.trim()}>
          {label && (
            <label className="text-sm font-medium text-[var(--text-primary)]">
              {label}
            </label>
          )}
          <div className={`
            flex items-center gap-2
            ${baseClasses} ${sizeClasses[size]} ${statusClasses[status]} ${className}
          `.trim()}>
            {prefix && <span className="text-[var(--text-muted)]">{prefix}</span>}
            <input ref={ref} className="w-full bg-transparent border-0 focus:ring-0 outline-none" {...props} />
            {suffix && <span className="text-[var(--text-muted)]">{suffix}</span>}
          </div>
          {status === 'error' && errorMessage && (
            <p className="text-sm text-red-500">{errorMessage}</p>
          )}
        </div>
      )
    }

    return (
      <div className={`flex flex-col gap-1.5 ${widthClass}`.trim()}>
        {label && (
          <label className="text-sm font-medium text-[var(--text-primary)]">
            {label}
          </label>
        )}
        <input ref={ref} className={inputClasses} {...props} />
        {status === 'error' && errorMessage && (
          <p className="text-sm text-red-500">{errorMessage}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
