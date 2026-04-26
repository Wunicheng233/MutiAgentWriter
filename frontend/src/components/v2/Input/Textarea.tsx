import React, { forwardRef } from 'react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  errorMessage?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    label,
    errorMessage,
    className = '',
    rows = 4,
    ...props
  }, ref) => {
    const baseClasses = `
      bg-[var(--bg-secondary)] border border-[var(--border-default)]
      rounded-[var(--radius-md)] px-4 py-2.5
      transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]
      focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-opacity-20 focus:border-[var(--accent-primary)]
      text-[var(--text-body)]
      placeholder:text-[var(--text-muted)]
      disabled:cursor-not-allowed disabled:opacity-50
      resize-y min-h-[100px]
    `

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[var(--text-primary)]">
            {label}
          </label>
        )}
        <textarea ref={ref} rows={rows} className={`${baseClasses} ${className}`.trim()} {...props} />
        {errorMessage && (
          <p className="text-sm text-red-500">{errorMessage}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
