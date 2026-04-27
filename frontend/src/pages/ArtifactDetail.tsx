import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Card, Badge, Button } from '../components/v2'
import { getProject, getProjectArtifact, getProjectArtifacts } from '../utils/endpoints'
import {
  getArtifactCompareSummary,
  getArtifactContentStats,
  getArtifactContentString,
  getArtifactDisplayName,
  getArtifactScopeLabel,
  getArtifactVersionKey,
} from '../utils/artifact'

function formatDateTime(value?: string): string {
  if (!value) return '暂无'
  return new Date(value).toLocaleString()
}

export const ArtifactDetail: React.FC = () => {
  const { id, artifactId } = useParams<{ id: string; artifactId: string }>()
  const [searchParams] = useSearchParams()
  const projectId = id ? parseInt(id, 10) : 0
  const currentArtifactId = artifactId ? parseInt(artifactId, 10) : 0
  const isValidParams = projectId > 0 && !Number.isNaN(currentArtifactId)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: isValidParams,
  })

  const { data: artifact, isLoading } = useQuery({
    queryKey: ['project-artifact', projectId, currentArtifactId],
    queryFn: () => getProjectArtifact(projectId, currentArtifactId),
    enabled: isValidParams,
  })

  const { data: versionChain } = useQuery({
    queryKey: ['project-artifacts', projectId, 'chain', artifact?.id],
    queryFn: () =>
      getProjectArtifacts(projectId, {
        artifact_type: artifact!.artifact_type,
        scope: artifact!.scope,
        chapter_index: artifact!.chapter_index,
        include_content: false,
        limit: 50,
      }),
    enabled: !!artifact,
  })

  const versions = React.useMemo(() => {
    return [...(versionChain?.items || [])].sort((left, right) => right.version_number - left.version_number)
  }, [versionChain])

  const compareArtifactId = React.useMemo(() => {
    const compareId = searchParams.get('compare')
    if (compareId) return parseInt(compareId, 10)

    const currentIndex = versions.findIndex(item => item.id === currentArtifactId)
    if (currentIndex >= 0 && currentIndex < versions.length - 1) {
      return versions[currentIndex + 1].id
    }
    return undefined
  }, [currentArtifactId, searchParams, versions])

  const { data: compareArtifact } = useQuery({
    queryKey: ['project-artifact', projectId, compareArtifactId],
    queryFn: () => getProjectArtifact(projectId, compareArtifactId!),
    enabled: !!compareArtifactId && compareArtifactId !== currentArtifactId,
  })

  if (isLoading) {
    return (
      
        <p className="text-[var(--text-secondary)]">加载中...</p>
      
    )
  }

  if (!artifact) {
    return (
      
        <p className="text-[var(--text-secondary)]">Artifact 不存在</p>
      
    )
  }

  const artifactContent = getArtifactContentString(artifact)
  const artifactStats = getArtifactContentStats(artifactContent)
  const compareContent = compareArtifact ? getArtifactContentString(compareArtifact) : ''
  const compareStats = compareArtifact ? getArtifactContentStats(compareContent) : null
  const compareSummary =
    compareArtifact && artifactContent && compareContent
      ? getArtifactCompareSummary(artifactContent, compareContent)
      : null

  if (!isValidParams) {
    return (
      
        <div className="mx-auto max-w-content text-center py-16">
          <p className="text-lg mb-2">Invalid page parameters</p>
          <p className="text-sm text-[var(--text-secondary)]">Please check the URL and try again.</p>
        </div>
      
    )
  }

  return (
    
      <div className="mx-auto max-w-content space-y-6">
        <Card className="border-sage/20 bg-[linear-gradient(135deg,rgba(91,127,110,0.12),rgba(255,255,255,0.94),rgba(163,139,90,0.08))] p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Link to={`/projects/${projectId}/overview`}>
                  <Button variant="secondary" size="sm">返回概览</Button>
                </Link>
                {artifact.workflow_run_id && (
                  <Link to={`/projects/${projectId}/workflows/${artifact.workflow_run_id}`}>
                    <Button variant="secondary" size="sm">查看 Run</Button>
                  </Link>
                )}
                {artifact.chapter_index !== undefined && artifact.chapter_index >= 0 && (
                  <Link to={`/projects/${projectId}/write/${artifact.chapter_index}`}>
                    <Button variant="secondary" size="sm">相关章节</Button>
                  </Link>
                )}
                <Badge variant="secondary">{artifact.scope}</Badge>
                {artifact.is_current && <Badge variant="success">current</Badge>}
              </div>

              <h1 className="text-3xl md:text-4xl font-medium">{getArtifactDisplayName(artifact.artifact_type)}</h1>
              {project && <p className="mt-2 text-[var(--text-secondary)]">{project.name}</p>}
            </div>

            <div className="grid w-full max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-standard border border-border bg-parchment/70 p-3">
                <p className="text-sm text-[var(--text-secondary)]">版本</p>
                <p className="mt-1 font-medium">v{artifact.version_number}</p>
              </div>
              <div className="rounded-standard border border-border bg-parchment/70 p-3">
                <p className="text-sm text-[var(--text-secondary)]">范围</p>
                <p className="mt-1 font-medium">{getArtifactScopeLabel(artifact)}</p>
              </div>
              <div className="rounded-standard border border-border bg-parchment/70 p-3">
                <p className="text-sm text-[var(--text-secondary)]">版本链</p>
                <p className="mt-1 font-medium">{versions.length}</p>
              </div>
              <div className="rounded-standard border border-border bg-parchment/70 p-3">
                <p className="text-sm text-[var(--text-secondary)]">创建时间</p>
                <p className="mt-1 font-medium">{formatDateTime(artifact.created_at)}</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Artifact Summary</p>
            <h2 className="mt-2 text-2xl font-medium">产物摘要</h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-standard border border-border bg-parchment/60 p-4">
                <p className="text-sm text-[var(--text-secondary)]">类型</p>
                <p className="mt-1 font-medium">{artifact.artifact_type}</p>
              </div>
              <div className="rounded-standard border border-border bg-parchment/60 p-4">
                <p className="text-sm text-[var(--text-secondary)]">版本链键</p>
                <p className="mt-1 break-words font-medium">{getArtifactVersionKey(artifact)}</p>
              </div>
              <div className="rounded-standard border border-border bg-parchment/60 p-4">
                <p className="text-sm text-[var(--text-secondary)]">来源</p>
                <p className="mt-1 font-medium">{artifact.source}</p>
              </div>
              <div className="rounded-standard border border-border bg-parchment/60 p-4">
                <p className="text-sm text-[var(--text-secondary)]">所属 Run</p>
                <p className="mt-1 font-medium">{artifact.workflow_run_id ?? '-'}</p>
              </div>
              <div className="rounded-standard border border-border bg-parchment/60 p-4">
                <p className="text-sm text-[var(--text-secondary)]">字符数</p>
                <p className="mt-1 font-medium">{artifactStats.characters}</p>
              </div>
              <div className="rounded-standard border border-border bg-parchment/60 p-4">
                <p className="text-sm text-[var(--text-secondary)]">行数 / 段落</p>
                <p className="mt-1 font-medium">
                  {artifactStats.lines} / {artifactStats.paragraphs}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Version Chain</p>
            <h2 className="mt-2 text-2xl font-medium">版本链</h2>

            <div className="mt-5 space-y-3">
              {versions.map(version => {
                const isActive = version.id === artifact.id
                const compareTarget = version.id === compareArtifact?.id

                return (
                  <div
                    key={version.id}
                    className={`rounded-standard border p-4 ${
                      isActive ? 'border-sage bg-sage/10' : 'border-border bg-parchment/50'
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-inkwell">v{version.version_number}</span>
                          {version.is_current && <Badge variant="success">current</Badge>}
                          {isActive && <Badge variant="status">当前查看</Badge>}
                          {compareTarget && <Badge variant="secondary">对照版本</Badge>}
                        </div>
                        <div className="mt-2 text-sm text-[var(--text-secondary)]">
                          #{version.id} · {formatDateTime(version.created_at)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!isActive && (
                          <Link to={`/projects/${projectId}/artifacts/${version.id}`}>
                            <Button variant="secondary" size="sm">查看</Button>
                          </Link>
                        )}
                        {!isActive && (
                          <Link to={`/projects/${projectId}/artifacts/${artifact.id}?compare=${version.id}`}>
                            <Button variant="tertiary" size="sm">对照</Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {!versions.length && (
                <div className="rounded-standard border border-dashed border-border p-4 text-center text-[var(--text-secondary)]">
                  暂无
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Compare View</p>
          <h2 className="mt-2 text-2xl font-medium">版本对照</h2>

          {compareArtifact ? (
            <>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-standard border border-border bg-parchment/60 p-4">
                  <p className="text-sm text-[var(--text-secondary)]">当前版本</p>
                  <p className="mt-1 font-medium">v{artifact.version_number}</p>
                </div>
                <div className="rounded-standard border border-border bg-parchment/60 p-4">
                  <p className="text-sm text-[var(--text-secondary)]">对照版本</p>
                  <p className="mt-1 font-medium">v{compareArtifact.version_number}</p>
                </div>
                <div className="rounded-standard border border-border bg-parchment/60 p-4">
                  <p className="text-sm text-[var(--text-secondary)]">改动行</p>
                  <p className="mt-1 font-medium">{compareSummary?.changedLines ?? 0}</p>
                </div>
                <div className="rounded-standard border border-border bg-parchment/60 p-4">
                  <p className="text-sm text-[var(--text-secondary)]">新增 / 删除</p>
                  <p className="mt-1 font-medium">
                    {compareSummary?.addedLines ?? 0} / {compareSummary?.removedLines ?? 0}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-comfortable border border-border bg-parchment/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Current</p>
                      <h3 className="mt-2 text-lg font-medium">v{artifact.version_number}</h3>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {artifactStats.characters} chars / {artifactStats.lines} lines
                    </p>
                  </div>
                  <pre className="mt-4 max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-standard border border-border bg-white/70 p-4 text-sm">
                    {artifactContent || '无内容'}
                  </pre>
                </div>

                <div className="rounded-comfortable border border-border bg-parchment/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Compared</p>
                      <h3 className="mt-2 text-lg font-medium">v{compareArtifact.version_number}</h3>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {compareStats?.characters ?? 0} chars / {compareStats?.lines ?? 0} lines
                    </p>
                  </div>
                  <pre className="mt-4 max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-standard border border-border bg-white/70 p-4 text-sm">
                    {compareContent || '无内容'}
                  </pre>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-standard border border-dashed border-border p-4 text-center text-[var(--text-secondary)]">
              无对照版本
            </div>
          )}
        </Card>

        <Card className="p-6">
          <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Artifact Content</p>
          <h2 className="mt-2 text-2xl font-medium">完整内容</h2>

          <pre className="mt-5 max-h-[44rem] overflow-auto whitespace-pre-wrap rounded-comfortable border border-border bg-parchment/50 p-4 text-sm">
            {artifactContent || '无内容'}
          </pre>
        </Card>
      </div>
    
  )
}

export default ArtifactDetail
