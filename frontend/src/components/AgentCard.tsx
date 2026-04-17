import React, { useState } from 'react'
import Badge from './Badge'

interface AgentCardProps {
  name: string
  status: 'idle' | 'running' | 'done' | 'error'
  output?: string
}

const statusText = {
  idle: '等待',
  running: '运行中',
  done: '完成',
  error: '失败',
}

export const AgentCard: React.FC<AgentCardProps> = ({
  name,
  status,
  output,
}) => {
  const [expanded, setExpanded] = useState(false)

  const statusColor = {
    idle: 'muted',
    running: 'sage',
    done: 'muted-gold',
    error: 'terracotta',
  }

  return (
    <div
      className={`border border-border rounded-standard mb-3 overflow-hidden cursor-pointer ${
        status === 'running' ? 'shadow-ambient' : ''
      }`}
      onClick={() => output && setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge variant="agent">{name}</Badge>
          <span className={`text-sm text-${statusColor[status]}`}>
            {statusText[status]}
          </span>
        </div>
        {output && (
          <svg
            className={`w-5 h-5 text-secondary transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </div>
      {expanded && output && (
        <div className="px-4 pb-4 border-t border-border">
          <div className="mt-3 prose-novel text-sm whitespace-pre-line">
            {output}
          </div>
        </div>
      )}
    </div>
  )
}

export default AgentCard
