import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { Card, Badge, Button, Progress, Empty } from '../components/v2'
import type { BadgeVariant } from '../components/v2'
import { useProjectStore, type ProjectStatus } from '../store/useProjectStore'
import { getProject, getProjectAnalytics } from '../utils/endpoints'
import { getProjectStatusText } from '../utils/workflow'

function getScoreColor(score: number): BadgeVariant {
  if (score >= 8) return 'success'
  if (score >= 6) return 'warning'
  if (score >= 4) return 'secondary'
  return 'error'
}

export const QualityDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const projectId = id ? parseInt(id, 10) : 0
  const isValidProjectId = !Number.isNaN(projectId) && projectId > 0

  const setCurrentProject = useProjectStore(state => state.setCurrentProject)
  const setProjectStatus = useProjectStore(state => state.setProjectStatus)

  const { data: analytics, isLoading, isError, error } = useQuery({
    queryKey: ['project-analytics', projectId],
    queryFn: () => getProjectAnalytics(projectId),
    enabled: isValidProjectId,
  })

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: isValidProjectId,
  })

  // 初始化 ProjectStore
  useEffect(() => {
    if (!project || !id) return

    setCurrentProject(id, project.name)

    const progress = project.current_generation_task?.progress ?? 0
    const progressPercent = project.status === 'completed' ? 100 : progress * 100
    setProjectStatus(project.status as ProjectStatus, progressPercent)
  }, [id, project, setCurrentProject, setProjectStatus])

  if (!isValidProjectId) {
    return <p className="text-[var(--text-secondary)]">项目ID无效</p>
  }

  if (isLoading) {
    return <p className="text-[var(--text-secondary)]">加载中...</p>
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <p className="text-[var(--text-danger)]">加载分析数据失败</p>
        <p className="text-sm text-[var(--text-secondary)]">
          {error instanceof Error ? error.message : '请稍后重试'}
        </p>
      </div>
    )
  }

  if (!analytics) {
    return (
      <Empty
        icon="document"
        title="暂无分析数据"
        description="先生成章节并运行质量分析后再来查看"
      />
    )
  }

  const dimensionMapping: Record<string, string> = {
    plot: '情节',
    character: '人物',
    hook: '吸引力',
    writing: '文笔',
    setting: '设定',
  }

  const dimScores = analytics.dimension_average_scores || {}
  const hasDimensions = Object.keys(dimScores).length > 0
  const chapterScores = analytics.chapter_scores || []
  const totalChapters = analytics.total_chapters || 0
  const passedChapters = analytics.passed_chapters || 0
  const passRate = totalChapters > 0 ? (passedChapters / totalChapters) * 100 : 0
  const overallScore = analytics.overall_quality_score ?? 0

  // 安全的排序和索引访问，避免空数组越界
  const sortedDimensions = Object.entries(dimScores).sort((a, b) => Number(b[1]) - Number(a[1]))
  const strongestDimensionEntry = sortedDimensions.length > 0 ? sortedDimensions[0] : null
  const weakestDimensionEntry = sortedDimensions.length > 0 ? sortedDimensions[sortedDimensions.length - 1] : null

  const sortedChapters = [...chapterScores].sort((a, b) => Number(b.quality_score) - Number(a.quality_score))
  const highestChapter = sortedChapters.length > 0 ? sortedChapters[0] : null
  const lowestChapter = sortedChapters.length > 0 ? sortedChapters[sortedChapters.length - 1] : null

  const scoreBuckets = {
    strong: chapterScores.filter(item => item.quality_score >= 8).length,
    watch: chapterScores.filter(item => item.quality_score >= 6 && item.quality_score < 8).length,
    weak: chapterScores.filter(item => item.quality_score < 6).length,
  }

  const radarIndicator = Object.entries(dimScores).map(([key, value]) => ({
    name: dimensionMapping[key] || key,
    max: 10,
    value,
  }))

  const radarOption = {
    tooltip: {
      trigger: 'item',
    },
    radar: hasDimensions ? {
      indicator: radarIndicator,
      radius: '60%',
      axisName: {
        color: '#3a2c1f',
        fontSize: 14,
      },
      splitArea: {
        areaStyle: {
          color: ['#faf7f2', '#f0ebe4'],
        },
      },
    } : {
      indicator: [],
      radius: '60%',
    },
    series: [
      {
        name: '维度评分',
        type: 'radar',
        data: [
          {
            value: radarIndicator.map(item => item.value),
            name: '平均评分',
            areaStyle: {
              color: 'rgba(91, 127, 110, 0.3)',
            },
            lineStyle: {
              color: '#5b7f6e',
            },
            itemStyle: {
              color: '#5b7f6e',
            },
          },
        ],
      },
    ],
  }

  const lineOption = {
    tooltip: {
      trigger: 'axis',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: chapterScores.map(item => `第${item.chapter_index}章`),
      axisLabel: {
        color: '#3a2c1f',
      },
      axisLine: {
        lineStyle: {
          color: '#888',
        },
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 10,
      axisLabel: {
        color: '#3a2c1f',
      },
      axisLine: {
        lineStyle: {
          color: '#888',
        },
      },
      splitLine: {
        lineStyle: {
          color: '#e5e1db',
        },
      },
    },
    series: [
      {
        name: '章节评分',
        type: 'line',
        data: chapterScores.map(item => item.quality_score),
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(192, 107, 78, 0.4)' },
              { offset: 1, color: 'rgba(192, 107, 78, 0.05)' },
            ],
          },
        },
        lineStyle: {
          color: '#c06b4e',
          width: 2,
        },
        itemStyle: {
          color: '#c06b4e',
        },
      },
    ],
  }

  return (
    <div className="space-y-6">
        <Card className="border-[var(--border-default)] bg-[linear-gradient(135deg,rgba(91,127,110,0.12),rgba(255,255,255,0.9),rgba(192,107,78,0.08))]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <Link to={`/projects/${projectId}/overview`}>
                <Button variant="secondary" size="sm">返回概览</Button>
              </Link>
              {project && <Badge variant="secondary">{getProjectStatusText(project.status)}</Badge>}
              <Badge variant={getScoreColor(overallScore)}>
                总分 {overallScore.toFixed(1)}
              </Badge>
            </div>

            <h1 className="text-2xl md:text-3xl font-medium text-[var(--text-primary)]">质量分析</h1>

            <div className="flex flex-col lg:flex-row lg:items-center gap-5">
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[var(--text-secondary)]">总体质量</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{overallScore.toFixed(1)}/10</p>
                </div>
                <Progress value={overallScore * 10} />
              </div>

              <div className="grid grid-cols-2 gap-3 flex-wrap">
                <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-center">
                  <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">总章节</p>
                  <p className="mt-1 text-[var(--text-primary)] font-medium">{totalChapters}</p>
                </div>
                <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-center">
                  <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">合格</p>
                  <p className="mt-1 text-[var(--text-primary)] font-medium">{passedChapters}</p>
                </div>
                <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-center">
                  <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">通过率</p>
                  <p className="mt-1 text-[var(--text-primary)] font-medium">{passRate.toFixed(0)}%</p>
                </div>
                <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-center">
                  <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">待处理</p>
                  <p className="mt-1 text-[var(--text-primary)] font-medium">{scoreBuckets.weak}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-[var(--border-default)]">
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-5">维度概览</h2>

            <div className="grid gap-3 md:grid-cols-2 mb-5">
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <p className="text-[var(--text-secondary)] text-sm">最强维度</p>
                <p className="mt-2 text-xl text-[var(--text-primary)] font-medium">
                  {strongestDimensionEntry
                    ? `${dimensionMapping[strongestDimensionEntry[0]] || strongestDimensionEntry[0]} ${strongestDimensionEntry[1].toFixed(1)}`
                    : '-'}
                </p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <p className="text-[var(--text-secondary)] text-sm">最弱维度</p>
                <p className="mt-2 text-xl text-[var(--text-primary)] font-medium">
                  {weakestDimensionEntry
                    ? `${dimensionMapping[weakestDimensionEntry[0]] || weakestDimensionEntry[0]} ${weakestDimensionEntry[1].toFixed(1)}`
                    : '-'}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <p className="text-[var(--text-secondary)] text-sm">≥8分</p>
                <p className="mt-1 text-xl text-[var(--text-primary)] font-medium">{scoreBuckets.strong}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <p className="text-[var(--text-secondary)] text-sm">6-8分</p>
                <p className="mt-1 text-xl text-[var(--text-primary)] font-medium">{scoreBuckets.watch}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <p className="text-[var(--text-secondary)] text-sm">&lt;6分</p>
                <p className="mt-1 text-xl text-[var(--text-primary)] font-medium">{scoreBuckets.weak}</p>
              </div>
            </div>
          </Card>

          <Card className="border-[var(--border-default)]">
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-5">雷达图</h2>
            {hasDimensions ? (
              <div className="h-[300px]">
                <ReactECharts option={radarOption} style={{ height: '100%', width: '100%' }} />
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-[var(--text-secondary)]">
                暂无数据
              </div>
            )}
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-[var(--border-default)]">
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-5">章节极值</h2>
            <div className="space-y-3">
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[var(--text-secondary)] text-sm">最佳章节</p>
                    <p className="mt-1 text-[var(--text-primary)] font-medium">
                      {highestChapter ? highestChapter.title || `第${highestChapter.chapter_index}章` : '-'}
                    </p>
                  </div>
                  {highestChapter && (
                    <Badge variant={getScoreColor(highestChapter.quality_score)}>
                      {highestChapter.quality_score.toFixed(1)}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[var(--text-secondary)] text-sm">最弱章节</p>
                    <p className="mt-1 text-[var(--text-primary)] font-medium">
                      {lowestChapter ? lowestChapter.title || `第${lowestChapter.chapter_index}章` : '-'}
                    </p>
                  </div>
                  {lowestChapter && (
                    <Badge variant={getScoreColor(lowestChapter.quality_score)}>
                      {lowestChapter.quality_score.toFixed(1)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-[var(--border-default)]">
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-5">评分趋势</h2>
            {chapterScores.length > 0 ? (
              <div className="h-[300px]">
                <ReactECharts option={lineOption} style={{ height: '100%', width: '100%' }} />
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-[var(--text-secondary)]">
                暂无数据
              </div>
            )}
          </Card>
        </div>

        <Card className="border-[var(--border-default)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
            <h2 className="text-lg font-medium text-[var(--text-primary)]">章节明细</h2>
            <Link to={`/projects/${projectId}/chapters`}>
              <Button variant="secondary" size="sm">章节列表</Button>
            </Link>
          </div>

          <div className="space-y-3">
            {chapterScores.map(chapter => (
              <div
                key={chapter.chapter_index}
                className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 transition-all hover:border-[var(--border-strong)]"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-medium text-[var(--text-primary)] truncate">{chapter.title || `第${chapter.chapter_index}章`}</span>
                      <Badge variant="secondary">{chapter.status}</Badge>
                    </div>
                    <div className="mt-3 max-w-md">
                      <Progress value={chapter.quality_score * 10} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getScoreColor(chapter.quality_score)}>
                      {chapter.quality_score.toFixed(1)}
                    </Badge>
                    <Link to={`/projects/${projectId}/write/${chapter.chapter_index}`}>
                      <Button variant="tertiary" size="sm">编辑</Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
  )
}

export default QualityDashboard
