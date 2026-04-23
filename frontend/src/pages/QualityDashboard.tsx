import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { Layout } from '../components/Layout'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import type { BadgeVariant } from '../components/Badge'
import { Button } from '../components/Button'
import { ProgressBar } from '../components/ProgressBar'
import { getProjectAnalytics } from '../utils/endpoints'

export const QualityDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const projectId = parseInt(id!)

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['project-analytics', projectId],
    queryFn: () => getProjectAnalytics(projectId),
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

  // Prepare radar chart data
  const dimensionMapping: Record<string, string> = {
    plot: '情节',
    character: '人物',
    hook: '吸引力',
    writing: '文笔',
    setting: '设定',
  }

  const dimScores = analytics.dimension_average_scores || {}
  const hasDimensions = Object.keys(dimScores).length > 0

  const radarIndicator = Object.entries(dimScores).map(([key, value]) => ({
    name: dimensionMapping[key] || key,
    max: 10,
    value: value,
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

  // Prepare line chart data for chapter scores
  const chapterIndices = analytics.chapter_scores.map(item => `第${item.chapter_index}章`)
  const chapterScores = analytics.chapter_scores.map(item => item.quality_score)

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
      data: chapterIndices,
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
        data: chapterScores,
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

  const getScoreColor = (score: number): BadgeVariant => {
    if (score >= 8) return 'agent'
    if (score >= 6) return 'status'
    if (score >= 4) return 'secondary'
    return 'genre'
  }

  return (
    <Layout>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl">质量分析</h1>
          <p className="text-secondary mt-2">AI 多维度质量评估</p>
        </div>
        <Link to={`/projects/${projectId}/overview`}>
          <Button variant="secondary">返回概览</Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card>
          <h2 className="text-xl mb-4">总体质量</h2>
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-secondary">总体评分</span>
              <span className="text-body font-medium">{analytics.overall_quality_score.toFixed(1)}/10</span>
            </div>
            <ProgressBar progress={analytics.overall_quality_score * 10} />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-parchment rounded-standard p-4">
              <span className="text-secondary">总章节数</span>
              <p className="text-2xl font-medium text-inkwell mt-1">{analytics.total_chapters}</p>
            </div>
            <div className="bg-parchment rounded-standard p-4">
              <span className="text-secondary">合格章节</span>
              <p className="text-2xl font-medium text-inkwell mt-1">{analytics.passed_chapters}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl mb-4">多维度评分雷达图</h2>
          {hasDimensions ? (
            <div className="h-[300px]">
              <ReactECharts option={radarOption} style={{ height: '100%', width: '100%' }} />
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-secondary">
              <p>多维度评分数据生成后会显示在此处</p>
            </div>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="text-xl mb-4">章节评分趋势</h2>
        <div className="h-[300px]">
          <ReactECharts option={lineOption} style={{ height: '100%', width: '100%' }} />
        </div>
      </Card>

      <Card>
        <h2 className="text-xl mb-4">章节评分明细</h2>
        <div className="space-y-3">
          {analytics.chapter_scores.map(chapter => (
            <div key={chapter.chapter_index} className="flex justify-between items-center p-3 border border-border rounded-standard hover:border-sage/30 transition-colors">
              <div>
                <span className="font-medium">{chapter.title || `第${chapter.chapter_index}章`}</span>
                <Badge variant="secondary" className="ml-3">
                  {chapter.status}
                </Badge>
              </div>
              <Badge variant={getScoreColor(chapter.quality_score)}>
                {chapter.quality_score.toFixed(1)}/10
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </Layout>
  )
}

export default QualityDashboard
