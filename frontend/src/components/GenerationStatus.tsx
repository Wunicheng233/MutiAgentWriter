import React from 'react'
import { Progress, Button } from './v2'
import type { GenerationTask } from '../types/api'

interface GenerationStatusProps {
  status: string
  targetStart: number
  targetEnd: number
  currentTask: GenerationTask | undefined
  completedChapters: number
  onCancel?: () => void
}

const getStatusText = (status: string): string => {
  switch (status) {
    case 'draft':
      return '待生成'
    case 'planning':
      return '策划中'
    case 'processing':
      return '生成中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    default:
      return status
  }
}

export const GenerationStatus: React.FC<GenerationStatusProps> = ({
  status,
  targetStart,
  targetEnd,
  currentTask,
  completedChapters,
  onCancel,
}) => {
  const targetChapters = Math.max(targetEnd - targetStart + 1, 0)
  const completedRatio =
    targetChapters > 0 ? Math.min((completedChapters / targetChapters) * 100, 100) : 0

  const isGenerating = status === 'processing' || status === 'planning'

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)]">
            生成状态
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
            {getStatusText(status)}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`text-sm font-medium ${
              isGenerating ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            {completedChapters}/{targetChapters} 章
          </div>
          {isGenerating && (
            <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-primary)]" />
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="space-y-2">
          <Progress value={completedRatio} />
          <p className="text-sm text-[var(--text-secondary)]">
            {currentTask?.current_step ||
              `已完成 ${completedChapters}/${targetChapters || completedChapters || 1} 章`}
          </p>
        </div>
      </div>

      {currentTask?.current_chapter && (
        <div className="mt-3 rounded-lg bg-[var(--accent-primary)] bg-opacity-10 px-3 py-2 text-sm text-[var(--accent-primary)]">
          正在生成第 {currentTask.current_chapter} 章...
        </div>
      )}

      {isGenerating && onCancel && (
        <div className="mt-4 flex justify-end">
          <Button variant="tertiary" size="sm" onClick={onCancel}>
            取消生成
          </Button>
        </div>
      )}
    </div>
  )
}

export default GenerationStatus
