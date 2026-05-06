import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, Button, Empty } from '../components/v2'
import VersionCard from '../components/version/VersionCard'
import VersionCompareModal from '../components/version/VersionCompareModal'
import { useVersions } from '../hooks/useVersions'
import { listChapters } from '../utils/endpoints'

export const ProjectVersions: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const projectId = id ? parseInt(id) : 0

  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(1)
  const [compareModalOpen, setCompareModalOpen] = useState(false)
  const [compareLeftVersionId, setCompareLeftVersionId] = useState<number | null>(null)

  // Query chapter list
  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => listChapters(projectId),
    enabled: projectId > 0,
  })

  // Use versions hook
  const { versions, isLoading, error, getVersionDetail, restoreVersion, isRestoring } =
    useVersions(projectId, selectedChapterIndex)

  const handleCompare = (versionId: number) => {
    setCompareLeftVersionId(versionId)
    setCompareModalOpen(true)
  }

  const handleRestoreConfirm = (versionId: number) => {
    if (window.confirm('确定要恢复到此版本吗？当前内容将被覆盖。')) {
      restoreVersion(versionId)
    }
  }

  if (projectId <= 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] p-8">
        <div className="max-w-4xl mx-auto text-center py-8 text-[var(--text-secondary)]">
          项目不存在
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-[var(--text-primary)] mb-2">
            历史版本
          </h1>
          <p className="text-[var(--text-secondary)]">
            查看和管理章节的历史版本
          </p>
        </div>

        {/* Chapter Selector */}
        <div className="mb-6">
          <label className="block text-sm text-[var(--text-secondary)] mb-2">
            选择章节
          </label>
          <select
            value={selectedChapterIndex}
            onChange={(e) => setSelectedChapterIndex(Number(e.target.value))}
            className="w-full max-w-md h-10 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            data-testid="chapter-selector"
          >
            {chapters.map((chapter: any) => (
              <option key={chapter.chapter_index} value={chapter.chapter_index}>
                第 {chapter.chapter_index} 章 · {chapter.title || '未命名'}
              </option>
            ))}
          </select>
        </div>

        {/* Version List */}
        <Card className="p-6 border-[var(--border-default)]">
          {isLoading ? (
            <div className="text-center py-8 text-[var(--text-secondary)]" data-testid="loading-state">
              加载中...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-[var(--accent-error)]" data-testid="error-state">
              加载失败，请稍后重试
            </div>
          ) : versions.length === 0 ? (
            <Empty description="暂无历史版本" />
          ) : (
            <div className="space-y-4" data-testid="version-list">
              {versions.map((version) => (
                <VersionCard
                  key={version.id}
                  version={version}
                  isLatest={version === versions[0]}
                  onRestore={handleRestoreConfirm}
                  onCompare={handleCompare}
                  isRestoring={isRestoring}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Back to Editor Button */}
        <div className="mt-6">
          <Button
            variant="secondary"
            onClick={() => navigate(`/projects/${projectId}/editor/${selectedChapterIndex}`)}
          >
            返回编辑器
          </Button>
        </div>
      </div>

      {/* Compare Modal */}
      <VersionCompareModal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        versions={versions}
        initialLeftVersionId={compareLeftVersionId}
        getVersionDetail={getVersionDetail}
        onRestore={handleRestoreConfirm}
        isRestoring={isRestoring}
      />
    </div>
  )
}

export default ProjectVersions
