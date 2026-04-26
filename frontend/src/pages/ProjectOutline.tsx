import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { Card, Badge, Button, Input } from '../components/v2'
import { useLayoutStore } from '../store/useLayoutStore'
import { useProjectStore } from '../store/useProjectStore'
import SkillSelector from '../components/SkillSelector'
import {
  getProject,
  getProjectTokenStats,
  updateProject,
} from '../utils/endpoints'
import { useToast } from '../components/toastContext'

export const ProjectOutline: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const projectId = id ? parseInt(id, 10) : 0
  const isValidProjectId = !Number.isNaN(projectId) && projectId > 0
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const setCurrentProject = useProjectStore(state => state.setCurrentProject)
  const setProjectStatus = useProjectStore(state => state.setProjectStatus)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: isValidProjectId,
  })

  // 初始化 ProjectStore
  useEffect(() => {
    if (!data || !id) return

    setCurrentProject(id, data.name)

    const progress = data.current_generation_task?.progress ?? 0
    const progressPercent = data.status === 'completed' ? 100 : progress * 100
    setProjectStatus(data.status, progressPercent)
  }, [id, data, setCurrentProject, setProjectStatus])

  const { data: tokenStats } = useQuery({
    queryKey: ['project-token-stats', projectId],
    queryFn: () => getProjectTokenStats(projectId),
    enabled: isValidProjectId && !!data,
  })

  const [editingConfig, setEditingConfig] = useState(false)
  const [configForm, setConfigForm] = useState({
    skip_plan_confirmation: false,
    skip_chapter_confirmation: false,
    allow_plot_adjustment: false,
    chapter_word_count: 2000,
    start_chapter: 1,
    end_chapter: 10,
  })

  const updateConfigMutation = useMutation({
    mutationFn: () => updateProject(projectId, {
      config: {
        ...data?.config,
        ...configForm,
      },
    }),
    onSuccess: () => {
      showToast('配置已更新', 'success')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setEditingConfig(false)
    },
    onError: () => {
      showToast('更新失败', 'error')
    },
  })

  useEffect(() => {
    if (!data?.config) return

    const newConfig = {
      skip_plan_confirmation: data.config.skip_plan_confirmation ?? false,
      skip_chapter_confirmation: data.config.skip_chapter_confirmation ?? false,
      allow_plot_adjustment: data.config.allow_plot_adjustment ?? false,
      chapter_word_count: data.config.chapter_word_count ?? 2000,
      start_chapter: data.config.start_chapter ?? 1,
      end_chapter: data.config.end_chapter ?? 10,
    }

    // Only update if values actually changed to avoid cascading renders
    const hasChanges = Object.entries(newConfig).some(
      ([key, value]) => configForm[key as keyof typeof configForm] !== value
    )

    if (hasChanges) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- guarded by hasChanges check to avoid cascading renders
      setConfigForm(newConfig)
    }
  }, [
    data?.config,
    configForm,
  ])

  const { autoExpandHeaderInProject, setHeaderCollapsed } = useLayoutStore()

  useEffect(() => {
    if (id && autoExpandHeaderInProject) {
      setHeaderCollapsed(false)
    }
  }, [id, autoExpandHeaderInProject, setHeaderCollapsed])

  useEffect(() => {
    if (!data?.current_generation_task) return

    const shouldPoll =
      data.status === 'generating' ||
      data.current_generation_task.status === 'waiting_confirm'

    if (!shouldPoll) return

    const interval = window.setInterval(() => {
      void refetch()
    }, 3000)

    return () => window.clearInterval(interval)
  }, [data, refetch])

  if (isLoading) {
    return <p className="text-[var(--text-secondary)]">加载中...</p>
  }

  if (!data) {
    return <p className="text-[var(--text-secondary)]">项目不存在</p>
  }

  const config = data.config
  const targetStart = config?.start_chapter ?? 1
  const targetEnd = config?.end_chapter ?? 10

  return (
    <div className="mx-auto max-w-content space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/projects/${projectId}/overview`}>
            <Button variant="tertiary" size="sm">返回概览</Button>
          </Link>
        </div>
        <Badge variant="secondary">大纲设定</Badge>
      </div>

      <Card className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-secondary)]">Project Setup</p>
            <h2 className="mt-2 text-2xl">创作配置</h2>
          </div>
          {data.status === 'draft' && (
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => setEditingConfig(!editingConfig)}
            >
              {editingConfig ? '取消编辑' : '编辑配置'}
            </Button>
          )}
        </div>

        {!editingConfig ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-[var(--text-secondary)]">小说名称</p>
                <p className="mt-1 text-body">{config?.novel_name || data.name}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-[var(--text-secondary)]">生成模式</p>
                <p className="mt-1 text-body">
                  {config?.skip_plan_confirmation && config?.skip_chapter_confirmation
                    ? '全自动生成'
                    : !config?.skip_plan_confirmation && config?.skip_chapter_confirmation
                      ? '策划确认模式'
                      : !config?.skip_plan_confirmation && !config?.skip_chapter_confirmation
                        ? '逐章共创模式'
                        : '章节接管模式'}
                </p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-[var(--text-secondary)]">章节范围</p>
                <p className="mt-1 text-body">{targetStart} - {targetEnd}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-[var(--text-secondary)]">Token 消耗</p>
                <p className="mt-1 text-body">
                  {tokenStats && tokenStats.total_tokens > 0
                    ? `${tokenStats.total_tokens.toLocaleString()} tokens`
                    : '尚无消耗记录'}
                </p>
                {tokenStats && tokenStats.total_tokens > 0 && (
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">约 ${tokenStats.estimated_cost_usd.toFixed(4)}</p>
                )}
              </div>
            </div>

            {config?.core_requirement && (
              <div className="rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Core Requirement</p>
                <div className="mt-3 max-h-72 overflow-y-auto whitespace-pre-line pr-2 text-body">
                  {config.core_requirement}
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-[var(--text-secondary)]">跳过策划确认</p>
                <p className="mt-1 text-body">{config?.skip_plan_confirmation ? '是' : '否'}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-[var(--text-secondary)]">跳过章节确认</p>
                <p className="mt-1 text-body">{config?.skip_chapter_confirmation ? '是' : '否'}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-[var(--text-secondary)]">允许剧情调整</p>
                <p className="mt-1 text-body">{config?.allow_plot_adjustment ? '是' : '否'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="每章字数"
                type="number"
                value={configForm.chapter_word_count}
                onChange={event => setConfigForm(prev => ({ ...prev, chapter_word_count: parseInt(event.target.value, 10) || 0 }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="起始章节"
                type="number"
                value={configForm.start_chapter}
                onChange={event => setConfigForm(prev => ({ ...prev, start_chapter: parseInt(event.target.value, 10) || 1 }))}
              />
              <Input
                label="结束章节"
                type="number"
                value={configForm.end_chapter}
                onChange={event => setConfigForm(prev => ({ ...prev, end_chapter: parseInt(event.target.value, 10) || 1 }))}
              />
            </div>
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={configForm.skip_plan_confirmation}
                  onChange={event => setConfigForm(prev => ({ ...prev, skip_plan_confirmation: event.target.checked }))}
                  className="rounded border-[var(--border-default)] text-sage focus:ring-sage"
                />
                <span>跳过策划方案人工确认</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={configForm.skip_chapter_confirmation}
                  onChange={event => setConfigForm(prev => ({ ...prev, skip_chapter_confirmation: event.target.checked }))}
                  className="rounded border-[var(--border-default)] text-sage focus:ring-sage"
                />
                <span>跳过章节级人工确认</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={configForm.allow_plot_adjustment}
                  onChange={event => setConfigForm(prev => ({ ...prev, allow_plot_adjustment: event.target.checked }))}
                  className="rounded border-[var(--border-default)] text-sage focus:ring-sage"
                />
                <span>允许每章后调整下一章剧情</span>
              </label>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                onClick={() => updateConfigMutation.mutate()}
                disabled={updateConfigMutation.isPending}
              >
                {updateConfigMutation.isPending ? '保存中...' : '保存配置'}
              </Button>
            </div>
          </div>
        )}

        {/* Skill 配置 */}
        <div className="mt-8 pt-6 border-t border-[var(--border-default)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                Skill Runtime
              </p>
              <h2 className="mt-1 text-2xl">启用创作 Skill</h2>
            </div>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Skill 会按 Planner、Writer、Revise 的职责精确注入，Critic 保持中立质量标尺。
          </p>
          <SkillSelector
            projectId={projectId}
            enabledSkills={config?.skills?.enabled ?? []}
          />
        </div>
      </Card>
    </div>
  )
}

export default ProjectOutline
