import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { ProgressBar } from '../components/ProgressBar'
import { listProjects } from '../utils/endpoints'
import type { Project } from '../types/api'

export const Dashboard: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => listProjects(),
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary'
      case 'generating': return 'status'
      case 'completed': return 'agent'
      case 'failed': return 'genre'
      default: return 'genre'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return '草稿'
      case 'generating': return '生成中'
      case 'completed': return '已完成'
      case 'failed': return '失败'
      default: return status
    }
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-serif text-inkwell">我的书架</h1>
        <Link to="/projects/new">
          <Button variant="primary">新建项目</Button>
        </Link>
      </div>

      {isLoading && <p className="text-secondary">加载中...</p>}

      {data && data.items.length === 0 && (
        <Card hoverable className="text-center py-12">
          <p className="text-secondary mb-6">还没有项目，创建第一个项目开始创作吧</p>
          <Link to="/projects/new">
            <Button variant="primary">创建新项目</Button>
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.items.map((project: Project) => (
          <Link key={project.id} to={`/projects/${project.id}/overview`}>
            <Card hoverable className="h-full flex flex-col relative overflow-hidden">
              {/* 书脊 - 左侧深色条，模拟书本效果 */}
              <div className="absolute left-0 top-0 bottom-0 w-[8px] bg-[rgba(60,40,20,0.28)]"></div>

              <div className="flex justify-between items-start mb-4 pl-3">
                <h3 className="text-card text-xl font-serif text-inkwell">{project.name}</h3>
                <Badge variant={getStatusColor(project.status) as any}>
                  {getStatusText(project.status)}
                </Badge>
              </div>
              {project.description && (
                <p className="text-secondary text-sm mb-4 line-clamp-2 pl-3">
                  {project.description}
                </p>
              )}
              {project.overall_quality_score > 0 && (
                <div className="mb-4 pl-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-secondary">总体质量</span>
                    <span className="text-body font-medium">{project.overall_quality_score.toFixed(1)}/10</span>
                  </div>
                  <ProgressBar
                    progress={project.overall_quality_score * 10}
                  />
                </div>
              )}
              <div className="text-xs text-secondary mt-auto pt-4 pl-3">
                更新于 {new Date(project.updated_at).toLocaleString()}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </Layout>
  )
}

export default Dashboard
