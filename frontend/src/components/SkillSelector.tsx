import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listSkills, updateProjectSkills } from '../utils/endpoints'
import type { EnabledSkillConfig } from '../types/api'
import { useToast } from './toastContext'
import SkillPicker from './SkillPicker'

interface SkillSelectorProps {
  projectId: number
  enabledSkills?: EnabledSkillConfig[]
}

export const SkillSelector: React.FC<SkillSelectorProps> = ({
  projectId,
  enabledSkills = [],
}) => {
  const { showToast } = useToast()
  const queryClient = useQueryClient()

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

  return (
    <SkillPicker
      skills={data?.skills ?? []}
      enabledSkills={enabledSkills}
      isLoading={isLoading}
      showPriority
      onChange={enabled => mutation.mutate(enabled)}
    />
  )
}

export default SkillSelector
