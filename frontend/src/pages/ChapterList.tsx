import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { listChapters } from '../utils/endpoints'
import { getProject } from '../utils/endpoints'

export const ChapterList: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const projectId = parseInt(id!)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  })

  const { data: chapters, isLoading } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => listChapters(projectId),
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'genre'
      case 'generated': return 'agent'
      case 'edited': return 'status'
      default: return 'genre'
    }
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl">章节列表</h1>
          {project && <p className="text-secondary mt-2">{project.name}</p>}
        </div>
        <Link to={`/projects/${id}/overview`}>
          <Button variant="secondary">返回概览</Button>
        </Link>
      </div>

      {isLoading && <p className="text-secondary">加载中...</p>}

      <div className="space-y-4">
        {chapters?.map(chapter => (
          <Card key={chapter.id} hoverable>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-serif text-xl text-inkwell">
                  {chapter.title || `第${chapter.chapter_index}章`}
                </h3>
                <div className="flex gap-3 mt-2 text-sm text-secondary">
                  <span>字数: {chapter.word_count}</span>
                  <span>评分: {chapter.quality_score?.toFixed(1) || '-'}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={getStatusColor(chapter.status) as any}>
                  {chapter.status}
                </Badge>
                <Link to={`/projects/${id}/write/${chapter.chapter_index}`}>
                  <Button variant="primary" size="sm">
                    编辑
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
        {!chapters?.length && (
          <Card>
            <p className="text-secondary text-center py-6">
              还没有章节，开始生成后会在这里显示
            </p>
          </Card>
        )}
      </div>
    </Layout>
  )
}

export default ChapterList
