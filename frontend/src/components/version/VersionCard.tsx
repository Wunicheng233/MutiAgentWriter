import React from 'react'
import { Button } from '../v2'
import type { ChapterVersionInfo } from '../../utils/endpoints'

interface VersionCardProps {
  version: ChapterVersionInfo
  isLatest: boolean
  onRestore: (versionId: number) => void
  onCompare: (versionId: number) => void
  isRestoring: boolean
}

export const VersionCard: React.FC<VersionCardProps> = ({
  version,
  isLatest,
  onRestore,
  onCompare,
  isRestoring,
}) => {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div
      className={`rounded-standard border p-4 transition-all duration-200 ${
        isLatest
          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
          : 'border-[var(--border-default)] bg-[var(--bg-secondary)]'
      }`}
      data-testid="version-card"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[var(--text-primary)]">
              V{version.version_number}
            </span>
            {isLatest && (
              <span className="text-xs text-[var(--accent-primary)] font-medium">
                · 当前版本
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">
            {formatDate(version.created_at)}
            {' · '}{version.word_count} 字
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => onCompare(version.id)}
          >
            对比
          </Button>
          {!isLatest && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRestore(version.id)}
              disabled={isRestoring}
            >
              {isRestoring ? '恢复中...' : '恢复此版本'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default VersionCard
