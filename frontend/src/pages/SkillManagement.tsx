import React, { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/v2'
import { CanvasContainer } from '../components/layout/CanvasContainer'
import { getProject, listSkills, updateProjectSkills } from '../utils/endpoints'
import type { EnabledSkillConfig } from '../types/api'
import { useToast } from '../components/toastContext'
import { normalizeEnabledSkills } from '../utils/skillSelection'
import SkillPicker from '../components/SkillPicker'

export const SkillManagement: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const projectId = id ? parseInt(id, 10) : 0
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: projectId > 0,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: listSkills,
    staleTime: 1000 * 60 * 30,
  })

  const mutation = useMutation({
    mutationFn: (enabled: EnabledSkillConfig[]) => updateProjectSkills(projectId, { enabled }),
    onSuccess: () => {
      showToast('Skill 配置已更新', 'success')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: () => {
      showToast('Skill 配置更新失败', 'error')
    },
  })

  const skills = useMemo(() => data?.skills ?? [], [data?.skills])
  const enabledSkills = project?.config?.skills?.enabled ?? []
  const enabledIds = new Set(normalizeEnabledSkills(enabledSkills).map(item => item.skill_id))

  return (
    <CanvasContainer maxWidth={900}>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Link to={`/projects/${projectId}/outline`}>
              <Button variant="tertiary" size="sm">← 返回大纲配置</Button>
            </Link>
            <h1 className="mt-4 text-2xl font-medium text-[var(--text-primary)]">创作风格库</h1>
          </div>
          <div className="text-sm text-[var(--text-secondary)]">
            已启用 {enabledIds.size} / {skills.length}
          </div>
        </div>

        <SkillPicker
          skills={skills}
          enabledSkills={enabledSkills}
          isLoading={isLoading}
          searchPlaceholder="搜索作家风格..."
          loadingText="正在加载风格库..."
          emptyText="没有匹配的风格"
          itemClassName="p-6"
          onChange={enabled => mutation.mutate(enabled)}
        />
      </div>
    </CanvasContainer>
  )
}

export default SkillManagement
