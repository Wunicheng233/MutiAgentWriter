import React from 'react'
import { Progress, Badge } from './v2'

interface QualityDimension {
  name: string
  score: number
  maxScore?: number
}

interface QualityWidgetProps {
  overallScore: number
  dimensions?: QualityDimension[]
  chapterCount: number
  showDetails?: boolean
}

const getScoreColor = (score: number): string => {
  if (score >= 8) return 'text-[var(--accent-primary)]'
  if (score >= 6) return 'text-[var(--accent-warm)]'
  return 'text-red-500'
}

const getScoreLabel = (score: number): string => {
  if (score >= 9) return '优秀'
  if (score >= 8) return '良好'
  if (score >= 7) return '中等'
  if (score >= 6) return '及格'
  return '待改进'
}

export const QualityWidget: React.FC<QualityWidgetProps> = ({
  overallScore,
  dimensions = [],
  chapterCount,
  showDetails = true,
}) => {
  const hasData = overallScore > 0

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)]">
            质量评分
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
            {hasData ? (
              <>
                <span className={getScoreColor(overallScore)}>
                  {overallScore.toFixed(1)}
                </span>
                <span className="text-[var(--text-secondary)]">/10</span>
              </>
            ) : (
              <span className="text-[var(--text-secondary)]">暂无数据</span>
            )}
          </h3>
        </div>
        {hasData && (
          <Badge variant={overallScore >= 8 ? 'agent' : 'secondary'}>
            {getScoreLabel(overallScore)}
          </Badge>
        )}
      </div>

      {hasData ? (
        <>
          <div className="space-y-2">
            <Progress value={overallScore * 10} />
            <p className="text-sm text-[var(--text-secondary)]">
              总体质量 {overallScore.toFixed(1)}/10
            </p>
          </div>

          {showDetails && dimensions.length > 0 && (
            <div className="mt-5 space-y-3">
              <p className="text-sm font-medium text-[var(--text-secondary)]">各维度评分</p>
              {dimensions.map((dim) => (
                <div key={dim.name} className="space-y-1">
                  <div className="flex justify-between text-sm text-[var(--text-body)]">
                    <span>{dim.name}</span>
                    <span className={getScoreColor(dim.score)}>
                      {dim.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border-default)]">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${(dim.score / (dim.maxScore || 10)) * 100}%`,
                        backgroundColor:
                          dim.score >= 8
                            ? 'var(--accent-primary)'
                            : dim.score >= 6
                            ? 'var(--accent-warm)'
                            : '#ef4444',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-semibold text-[var(--accent-primary)]">
                  {chapterCount}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">已评审章节</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-[var(--accent-primary)]">
                  {(overallScore / 10 * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-[var(--text-secondary)]">质量达标率</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border-default)] p-4 text-center text-[var(--text-secondary)]">
          <p className="text-sm">
            完成至少一章评审后，这里会显示质量闭环结果。
          </p>
          <p className="mt-2 text-xs">
            评分维度包括：情节推进、人物塑造、节奏控制、文笔质量、设定一致性
          </p>
        </div>
      )}
    </div>
  )
}

export default QualityWidget
