import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from './Badge'
import { Input } from './Input'
import {
  listSkills,
  updateProjectSkills,
} from '../utils/endpoints'
import type { EnabledSkillConfig, SkillDefinition } from '../types/api'
import { useToast } from './toastContext'

interface SkillSelectorProps {
  projectId: number
  enabledSkills?: EnabledSkillConfig[]
}

const DEFAULT_APPLIES_TO = ['planner', 'writer', 'revise']

function defaultConfig(skill: SkillDefinition): Record<string, string | number | boolean | null> {
  const strengthSchema = skill.config_schema?.strength
  const defaultStrength =
    typeof strengthSchema === 'object' && strengthSchema && !Array.isArray(strengthSchema)
      ? Number(strengthSchema.default ?? 0.7)
      : 0.7
  return {
    strength: Number.isFinite(defaultStrength) ? defaultStrength : 0.7,
    mode: 'style_only',
  }
}

function normalizeEnabled(enabledSkills: EnabledSkillConfig[] = []): EnabledSkillConfig[] {
  return enabledSkills.map(item => ({
    skill_id: item.skill_id,
    applies_to_override: item.applies_to_override ?? DEFAULT_APPLIES_TO,
    config: item.config ?? {},
  }))
}

export const SkillSelector: React.FC<SkillSelectorProps> = ({
  projectId,
  enabledSkills = [],
}) => {
  const [query, setQuery] = React.useState('')
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const normalizedEnabled = React.useMemo(() => normalizeEnabled(enabledSkills), [enabledSkills])
  const enabledIds = new Set(normalizedEnabled.map(item => item.skill_id))

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

  const skills = data?.skills ?? []
  const filteredSkills = skills.filter(skill => {
    const text = `${skill.id} ${skill.name} ${skill.description} ${skill.tags.join(' ')}`.toLowerCase()
    return text.includes(query.toLowerCase())
  })

  const toggleSkill = (skill: SkillDefinition) => {
    const nextEnabled = enabledIds.has(skill.id)
      ? normalizedEnabled.filter(item => item.skill_id !== skill.id)
      : [
          ...normalizedEnabled,
          {
            skill_id: skill.id,
            applies_to_override: DEFAULT_APPLIES_TO,
            config: defaultConfig(skill),
          },
        ]
    mutation.mutate(nextEnabled)
  }

  if (isLoading) {
    return <div className="text-sm text-[var(--text-secondary)]">正在加载 Skill...</div>
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="搜索 Skill..."
        value={query}
        onChange={event => setQuery(event.target.value)}
      />

      <div className="space-y-3">
        {filteredSkills.map(skill => {
          const checked = enabledIds.has(skill.id)

          return (
            <label
              key={skill.id}
              className={`block cursor-pointer rounded-lg border p-4 transition-all ${
                checked ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] bg-opacity-10' : 'border-[var(--border-default)] hover:border-sage/40 hover:bg-[var(--bg-secondary)] bg-opacity-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  aria-label={`启用 ${skill.name}`}
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSkill(skill)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{skill.name}</p>
                    <Badge variant="secondary">priority {skill.priority}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{skill.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {skill.tags.slice(0, 4).map(tag => (
                      <Badge key={tag} variant={tag === 'author-style' ? 'agent' : 'secondary'}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    默认作用于：{(skill.applies_to || DEFAULT_APPLIES_TO).join(' / ')}
                  </p>
                </div>
              </div>
            </label>
          )
        })}
      </div>

      {filteredSkills.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border-default)] p-4 text-sm text-[var(--text-secondary)]">
          没有匹配的 Skill。
        </div>
      )}
    </div>
  )
}

export default SkillSelector
