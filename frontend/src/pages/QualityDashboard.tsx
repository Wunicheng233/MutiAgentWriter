import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { LineChart, RadarChart } from 'echarts/charts'
import { GridComponent, RadarComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { Layout } from '../components/Layout'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import type { BadgeVariant } from '../components/Badge'
import { Button } from '../components/Button'
import { ProgressBar } from '../components/ProgressBar'
import { getProject, getProjectAnalytics } from '../utils/endpoints'
import { getProjectStatusText } from '../utils/workflow'

echarts.use([
  LineChart,
  RadarChart,
  GridComponent,
  RadarComponent,
  TooltipComponent,
  CanvasRenderer,
])

function getScoreColor(score: number): BadgeVariant {
  if (score >= 8) return 'agent'
  if (score >= 6) return 'status'
  if (score >= 4) return 'secondary'
  return 'genre'
}

export const QualityDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const projectId = parseInt(id!, 10)

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['project-analytics', projectId],
    queryFn: () => getProjectAnalytics(projectId),
  })

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  })

  if (isLoading) {
    return (
      <Layout>
        <p className="text-secondary">加载中...</p>
      </Layout>
    )
  }

  if (!analytics) {
    return (
      <Layout>
        <p className="text-secondary">暂无数据分析数据</p>
      </Layout>
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
  const strongestDimensionEntry = Object.entries(dimScores).sort((a, b) => b[1] - a[1])[0]
  const weakestDimensionEntry = Object.entries(dimScores).sort((a, b) => a[1] - b[1])[0]
  const highestChapter = [...chapterScores].sort((a, b) => b.quality_score - a.quality_score)[0]
  const lowestChapter = [...chapterScores].sort((a, b) => a.quality_score - b.quality_score)[0]

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
    <Layout>
      <div className="mx-auto max-w-content space-y-6">
        <Card className="border-sage/20 bg-[linear-gradient(135deg,rgba(91,127,110,0.12),rgba(255,255,255,0.9),rgba(192,107,78,0.08))]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Link to={`/projects/${projectId}/overview`}>
                  <Button variant="secondary">返回概览</Button>
                </Link>
                {project && <Badge variant="secondary">{getProjectStatusText(project.status)}</Badge>}
                <Badge variant={getScoreColor(analytics.overall_quality_score)}>
                  总分 {analytics.overall_quality_score.toFixed(1)}
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl">质量分析</h1>
              <p className="mt-3 text-body">
                这里不只是展示图表，而是把章节评审结果收成一套长期可复用的质量闭环视图，帮助我们定位当前作品最强和最弱的部分。
              </p>
            </div>

            <div className="w-full max-w-xl space-y-3">
              <ProgressBar progress={analytics.overall_quality_score * 10} message={`总体质量 ${analytics.overall_quality_score.toFixed(1)}/10`} />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-sm">
                <div className="rounded-standard border border-border bg-parchment/70 p-3">
                  <p className="text-secondary">总章节数</p>
                  <p className="mt-1 text-body">{totalChapters}</p>
                </div>
                <div className="rounded-standard border border-border bg-parchment/70 p-3">
                  <p className="text-secondary">合格章节</p>
                  <p className="mt-1 text-body">{passedChapters}</p>
                </div>
                <div className="rounded-standard border border-border bg-parchment/70 p-3">
                  <p className="text-secondary">通过率</p>
                  <p className="mt-1 text-body">{passRate.toFixed(0)}%</p>
                </div>
                <div className="rounded-standard border border-border bg-parchment/70 p-3">
                  <p className="text-secondary">待重点处理</p>
                  <p className="mt-1 text-body">{scoreBuckets.weak}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <p className="text-xs uppercase tracking-[0.22em] text-secondary">Dimension Summary</p>
            <h2 className="mt-2 text-2xl">维度概览</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-comfortable border border-border bg-parchment/60 p-4">
                <p className="text-secondary">最强维度</p>
                <p className="mt-2 text-xl text-inkwell">
                  {strongestDimensionEntry
                    ? `${dimensionMapping[strongestDimensionEntry[0]] || strongestDimensionEntry[0]} ${strongestDimensionEntry[1].toFixed(1)}`
                    : '暂无数据'}
                </p>
                <p className="mt-2 text-sm text-secondary">这是目前最有可能成为作品差异化优势的部分。</p>
              </div>
              <div className="rounded-comfortable border border-border bg-parchment/60 p-4">
                <p className="text-secondary">最弱维度</p>
                <p className="mt-2 text-xl text-inkwell">
                  {weakestDimensionEntry
                    ? `${dimensionMapping[weakestDimensionEntry[0]] || weakestDimensionEntry[0]} ${weakestDimensionEntry[1].toFixed(1)}`
                    : '暂无数据'}
                </p>
                <p className="mt-2 text-sm text-secondary">这里最适合作为下一轮 prompt 调优或修订策略的重点。</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-standard border border-border bg-white/75 p-4">
                <p className="text-secondary">高质量章节</p>
                <p className="mt-1 text-2xl text-inkwell">{scoreBuckets.strong}</p>
                <p className="mt-2 text-sm text-secondary">评分 8 分以上，适合作为样例章节。</p>
              </div>
              <div className="rounded-standard border border-border bg-white/75 p-4">
                <p className="text-secondary">可接受章节</p>
                <p className="mt-1 text-2xl text-inkwell">{scoreBuckets.watch}</p>
                <p className="mt-2 text-sm text-secondary">评分 6-8 分，需要局部打磨但已具备基础质量。</p>
              </div>
              <div className="rounded-standard border border-border bg-white/75 p-4">
                <p className="text-secondary">需重点返工</p>
                <p className="mt-1 text-2xl text-inkwell">{scoreBuckets.weak}</p>
                <p className="mt-2 text-sm text-secondary">评分低于 6 分，建议优先检查剧情、人物和节奏。</p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-xs uppercase tracking-[0.22em] text-secondary">Quality Radar</p>
            <h2 className="mt-2 text-2xl">多维度评分雷达图</h2>
            {hasDimensions ? (
              <div className="mt-4 h-[320px]">
                <ReactEChartsCore echarts={echarts} option={radarOption} style={{ height: '100%', width: '100%' }} />
              </div>
            ) : (
              <div className="mt-5 flex h-[320px] items-center justify-center text-secondary">
                <p>多维度评分数据生成后会显示在这里。</p>
              </div>
            )}
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <p className="text-xs uppercase tracking-[0.22em] text-secondary">Best / Worst</p>
            <h2 className="mt-2 text-2xl">章节极值</h2>
            <div className="mt-5 space-y-4">
              <div className="rounded-comfortable border border-border bg-parchment/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-secondary">最佳章节</p>
                    <p className="mt-1 text-lg text-inkwell">
                      {highestChapter ? highestChapter.title || `第${highestChapter.chapter_index}章` : '暂无数据'}
                    </p>
                  </div>
                  {highestChapter && (
                    <Badge variant={getScoreColor(highestChapter.quality_score)}>
                      {highestChapter.quality_score.toFixed(1)}/10
                    </Badge>
                  )}
                </div>
              </div>

              <div className="rounded-comfortable border border-border bg-parchment/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-secondary">最弱章节</p>
                    <p className="mt-1 text-lg text-inkwell">
                      {lowestChapter ? lowestChapter.title || `第${lowestChapter.chapter_index}章` : '暂无数据'}
                    </p>
                  </div>
                  {lowestChapter && (
                    <Badge variant={getScoreColor(lowestChapter.quality_score)}>
                      {lowestChapter.quality_score.toFixed(1)}/10
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-xs uppercase tracking-[0.22em] text-secondary">Trend</p>
            <h2 className="mt-2 text-2xl">章节评分趋势</h2>
            <div className="mt-4 h-[320px]">
              <ReactEChartsCore echarts={echarts} option={lineOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </Card>
        </div>

        <Card>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-secondary">Chapter Detail</p>
              <h2 className="mt-2 text-2xl">章节评分明细</h2>
              <p className="mt-2 text-secondary">这部分适合做逐章复盘，也能直接告诉我们下一轮该先修哪几章。</p>
            </div>
            <Link to={`/projects/${projectId}/chapters`}>
              <Button variant="secondary">回到章节列表</Button>
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {chapterScores.map(chapter => (
              <div
                key={chapter.chapter_index}
                className="rounded-comfortable border border-border p-4 transition-colors hover:border-sage/30"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-medium">{chapter.title || `第${chapter.chapter_index}章`}</span>
                      <Badge variant="secondary">{chapter.status}</Badge>
                    </div>
                    <div className="mt-3 max-w-md">
                      <ProgressBar progress={chapter.quality_score * 10} message={`章节评分 ${chapter.quality_score.toFixed(1)}/10`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getScoreColor(chapter.quality_score)}>
                      {chapter.quality_score.toFixed(1)}/10
                    </Badge>
                    <Link to={`/projects/${projectId}/write/${chapter.chapter_index}`}>
                      <Button variant="tertiary" size="sm">打开章节</Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  )
}

export default QualityDashboard
