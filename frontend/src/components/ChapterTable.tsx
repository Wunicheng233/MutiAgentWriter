import React from 'react'
import { Link } from 'react-router-dom'
import { Card, Badge, Button } from './v2'
import type { Chapter, Project } from '../types/api'

interface ChapterTableProps {
  projectId: number
  chapters: Chapter[]
  status: Project['status']
  overallQualityScore: number
}

const getChapterBadge = (status: string) => {
  switch (status) {
    case 'completed':
    case 'generated':
    case 'edited':
      return 'agent'
    case 'processing':
      return 'status'
    case 'failed':
      return 'secondary'
    default:
      return 'secondary'
  }
}

const getChapterStatusText = (status: string) => {
  switch (status) {
    case 'completed':
      return '已完成'
    case 'generated':
      return '已生成'
    case 'edited':
      return '已编辑'
    case 'processing':
      return '生成中'
    case 'failed':
      return '失败'
    default:
      return '待生成'
  }
}

export const ChapterTable: React.FC<ChapterTableProps> = ({
  projectId,
  chapters = [],
  status,
  overallQualityScore,
}) => {
  const editableStatuses = new Set(['completed', 'generated', 'edited'])
  const completedChapters = chapters.filter(c => editableStatuses.has(c.status)).length

  if (status === 'draft') {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border-default)] p-4 text-[var(--text-secondary)]">
        完成策划并启动生成后，这里会显示章节实时进度、Critic 评分和修订历史。
      </div>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)]">
            Chapters
          </p>
          <h2 className="mt-2 text-2xl text-[var(--text-primary)]">
            章节进度 ({completedChapters}/{chapters.length})
          </h2>
        </div>
        {overallQualityScore > 0 && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              Overall
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--accent-primary)]">
              {overallQualityScore.toFixed(1)}/10
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {chapters.map(chapter => (
        <div
          key={chapter.id}
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span className="font-medium text-[var(--text-primary)]">
                  第 {chapter.chapter_index} 章
                  {chapter.title && ` · ${chapter.title}`}
                </span>
                <Badge variant={getChapterBadge(chapter.status)}>
                  {getChapterStatusText(chapter.status)}
                </Badge>
              </div>
              {chapter.quality_score > 0 && (
                <div className="mt-1 text-sm text-[var(--text-secondary)]">
                  Critic 评分: {chapter.quality_score}/10
                </div>
              )}
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {chapter.word_count} 字
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {editableStatuses.has(chapter.status) && (
                <Link to={`/projects/${projectId}/editor/${chapter.chapter_index}`}>
                  <Button variant="tertiary" size="sm">
                    编辑
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
      </div>
    </Card>
  )
}

export default ChapterTable
