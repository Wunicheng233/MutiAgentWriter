import React from 'react'

interface ProgressBarProps {
  progress: number // 0-100
  message?: string
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, message }) => {
  const safeProgress = Number.isFinite(progress)
    ? Math.min(Math.max(progress, 0), 100)
    : 0

  return (
    <div className="w-full space-y-2">
      {message && (
        <div className="flex justify-between text-sm text-[var(--text-secondary)]">
          <span>{message}</span>
          <span>{Math.round(safeProgress)}%</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-default)] bg-opacity-70">
        <div
          className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-300 ease-out"
          style={{ width: `${safeProgress}%` }}
        />
      </div>
    </div>
  )
}

export default ProgressBar
