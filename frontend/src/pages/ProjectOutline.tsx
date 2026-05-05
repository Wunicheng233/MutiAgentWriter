import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { Card, Badge, Button, Input, Alert, Skeleton } from '../components/v2'
import { useLayoutStore } from '../store/useLayoutStore'
import { useProjectStore, type ProjectStatus } from '../store/useProjectStore'
import {
  getProject,
  listSkills,
  updateProject,
} from '../utils/endpoints'
import type { EnabledSkillConfig } from '../types/api'
import { useToast } from '../components/toastContext'

function getWordCountRangeLabel(target: number): string {
  if (!Number.isFinite(target) || target <= 0) return '-'
  return `${Math.ceil(target * 0.85)}-${Math.floor(target * 1.2)} 字`
}

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
    setProjectStatus(data.status as ProjectStatus, progressPercent)
  }, [id, data, setCurrentProject, setProjectStatus])

  const { data: skillsData } = useQuery({
    queryKey: ['skills'],
    queryFn: () => listSkills(),
    staleTime: 1000 * 60 * 30,
  })

  const enabledSkillNames = useMemo(() => {
    const enabled = data?.config?.skills?.enabled ?? []
    const skills = skillsData?.skills ?? []
    const enabledIds = new Set(enabled.map((e: EnabledSkillConfig) => e.skill_id))
    return skills
      .filter(s => enabledIds.has(s.id))
      .map(s => s.name)
  }, [data, skillsData])

  const [editingConfig, setEditingConfig] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [configForm, setConfigForm] = useState({
    skip_plan_confirmation: false,
    skip_chapter_confirmation: false,
    allow_plot_adjustment: false,
    chapter_word_count: 2000,
    start_chapter: 1,
    end_chapter: 10,
  })

  const initializedRef = useRef(false)

  const updateConfigMutation = useMutation({
    mutationFn: () => updateProject(projectId, {
      config: {
        ...data?.config,
        ...configForm,
      },
    }),
    onSuccess: () => {
      showToast('配置已更新', 'success')
      setShowSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setEditingConfig(false)
      setTimeout(() => setShowSuccess(false), 3000)
    },
    onError: () => {
      showToast('更新失败', 'error')
    },
  })

  useEffect(() => {
    if (!data?.config || editingConfig || initializedRef.current) return
    initializedRef.current = true

    const newConfig = {
      skip_plan_confirmation: data.config.skip_plan_confirmation ?? false,
      skip_chapter_confirmation: data.config.skip_chapter_confirmation ?? false,
      allow_plot_adjustment: data.config.allow_plot_adjustment ?? false,
      chapter_word_count: data.config.chapter_word_count ?? 2000,
      start_chapter: data.config.start_chapter ?? 1,
      end_chapter: data.config.end_chapter ?? 10,
    }

    // 只在非编辑状态下同步值，避免编辑时用户输入被重置
    setConfigForm(newConfig)
  }, [
    data?.config,
    editingConfig,  // editingConfig = true 时停止同步
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
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    )
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
        <Link to={`/projects/${projectId}/overview`}>
          <Button variant="tertiary" size="sm">返回概览</Button>
        </Link>
        <Badge variant="secondary">大纲设定</Badge>
      </div>

      <Card className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Project Setup</p>
            <h2 className="mt-2 text-2xl font-medium">创作配置</h2>
          </div>
          {data.status === 'draft' && (
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => setEditingConfig(!editingConfig)}
            >
              {editingConfig ? '取消' : '编辑'}
            </Button>
          )}
        </div>

        {!editingConfig ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-[var(--text-secondary)]">小说名称</p>
                <p className="mt-1 text-[var(--text-body)]">{config?.novel_name || data.name}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-[var(--text-secondary)]">生成模式</p>
                <p className="mt-1 text-[var(--text-body)]">
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
                <p className="mt-1 text-[var(--text-body)]">{targetStart} - {targetEnd}</p>
              </div>
            </div>

            {config?.core_requirement && (
              <div className="rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Core Requirement</p>
                <div className="mt-3 max-h-72 overflow-y-auto whitespace-pre-line pr-2">
                  {config.core_requirement}
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-[var(--text-secondary)]">跳过策划确认</p>
                <p className="mt-1 text-[var(--text-body)]">{config?.skip_plan_confirmation ? '是' : '否'}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-[var(--text-secondary)]">跳过章节确认</p>
                <p className="mt-1 text-[var(--text-body)]">{config?.skip_chapter_confirmation ? '是' : '否'}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-[var(--text-secondary)]">允许剧情调整</p>
                <p className="mt-1 text-[var(--text-body)]">{config?.allow_plot_adjustment ? '是' : '否'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {showSuccess && (
              <Alert variant="success" title="配置已更新" className="mb-4">
                你的项目配置已成功保存
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="每章目标字数"
                type="number"
                value={configForm.chapter_word_count}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setConfigForm(prev => ({ ...prev, chapter_word_count: parseInt(event.target.value, 10) || 0 }))}
              />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              当前目标区间 {getWordCountRangeLabel(configForm.chapter_word_count)}；系统低于 85% 会定向扩写，高于 120% 才压缩。
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="起始章节"
                type="number"
                value={configForm.start_chapter}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setConfigForm(prev => ({ ...prev, start_chapter: parseInt(event.target.value, 10) || 1 }))}
              />
              <Input
                label="结束章节"
                type="number"
                value={configForm.end_chapter}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setConfigForm(prev => ({ ...prev, end_chapter: parseInt(event.target.value, 10) || 1 }))}
              />
            </div>
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={configForm.skip_plan_confirmation}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setConfigForm(prev => ({ ...prev, skip_plan_confirmation: event.target.checked }))}
                  className="rounded border-[var(--border-default)] accent-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                />
                <span>跳过策划方案人工确认</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={configForm.skip_chapter_confirmation}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setConfigForm(prev => ({ ...prev, skip_chapter_confirmation: event.target.checked }))}
                  className="rounded border-[var(--border-default)] accent-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                />
                <span>跳过章节级人工确认</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={configForm.allow_plot_adjustment}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setConfigForm(prev => ({ ...prev, allow_plot_adjustment: event.target.checked }))}
                  className="rounded border-[var(--border-default)] accent-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
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

        <div className="mt-8 pt-6 border-t border-[var(--border-default)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Skill Runtime</p>
              <h2 className="mt-2 text-2xl font-medium">创作 Skill</h2>
            </div>
            <Link to={`/projects/${projectId}/skills`}>
              <Button variant="tertiary" size="sm">管理 Skill</Button>
            </Link>
          </div>
          <div className="mt-5">
            {enabledSkillNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {enabledSkillNames.map((name, i) => (
                  <Badge key={i} variant="primary">
                    {name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-[var(--text-secondary)]">尚未启用任何 Skill</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

export default ProjectOutline
