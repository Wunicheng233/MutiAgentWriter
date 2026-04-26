import React from 'react'
import { Card } from '../Card/Card'
import { Badge } from '../Badge/Badge'

export type AgentStatus = 'idle' | 'running' | 'done' | 'error'

export interface AgentCardProps {
  name: string
  subtitle: string
  status: AgentStatus
  progress?: number
  currentStep?: string
  className?: string
}

const statusColors: Record<AgentStatus, 'default' | 'success' | 'warning' | 'error'> = {
  idle: 'default',
  running: 'warning',
  done: 'success',
  error: 'error',
}

const statusLabels: Record<AgentStatus, string> = {
  idle: '等待中',
  running: '执行中',
  done: '已完成',
  error: '错误',
}

export const AgentCard: React.FC<AgentCardProps> = ({
  name,
  subtitle,
  status,
  progress,
  currentStep,
  className = '',
}) => {
  return (
    <Card className={`p-4 ${className}`.trim()}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-[var(--text-primary)]">{name}</h4>
          <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'running' ? 'animate-pulse' : ''
            }`}
            style={{
              backgroundColor:
                status === 'done' ? 'var(--accent-primary)' :
                status === 'running' ? '#f59e0b' :
                status === 'error' ? '#ef4444' :
                'var(--text-muted)',
            }}
          />
          <Badge variant={statusColors[status]}>{statusLabels[status]}</Badge>
        </div>
      </div>

      {progress !== undefined && (
        <div className="mt-3">
          <div className="w-full h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}

      {currentStep && (
        <p className="mt-2 text-sm text-[var(--text-secondary)] truncate">
          {currentStep}
        </p>
      )}
    </Card>
  )
}

AgentCard.displayName = 'AgentCard'
