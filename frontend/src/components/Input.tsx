import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input: React.FC<InputProps> = ({
  label,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[var(--text-body)] text-sm font-medium">{label}</label>
      )}
      <input
        className={`bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-[var(--text-body)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-primary)] focus:ring-opacity-15 ${className}`}
        {...props}
      />
    </div>
  )
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[var(--text-body)] text-sm font-medium">{label}</label>
      )}
      <textarea
        className={`bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-[var(--text-body)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-primary)] focus:ring-opacity-15 min-h-[120px] ${className}`}
        {...props}
      />
    </div>
  )
}
