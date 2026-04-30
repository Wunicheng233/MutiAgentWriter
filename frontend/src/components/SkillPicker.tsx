import React from 'react'
import { Badge, Input } from './v2'
import type { EnabledSkillConfig, SkillDefinition } from '../types/api'
import {
  DEFAULT_SKILL_APPLIES_TO,
  buildNextEnabledSkills,
  normalizeEnabledSkills,
} from '../utils/skillSelection'
import { extractAuthorNameParts } from '../utils/skillDisplay'

interface SkillPickerProps {
  skills: SkillDefinition[]
  enabledSkills?: EnabledSkillConfig[]
  isLoading?: boolean
  searchPlaceholder?: string
  loadingText?: string
  emptyText?: string
  showPriority?: boolean
  itemClassName?: string
  onChange: (enabled: EnabledSkillConfig[]) => void
}

export const SkillPicker: React.FC<SkillPickerProps> = ({
  skills,
  enabledSkills = [],
  isLoading = false,
  searchPlaceholder = '搜索 Skill...',
  loadingText = '正在加载 Skill...',
  emptyText = '没有匹配的 Skill',
  showPriority = false,
  itemClassName = 'p-4',
  onChange,
}) => {
  const [query, setQuery] = React.useState('')
  const normalizedEnabled = React.useMemo(() => normalizeEnabledSkills(enabledSkills), [enabledSkills])
  const enabledIds = new Set(normalizedEnabled.map(item => item.skill_id))

  const filteredSkills = React.useMemo(() => skills.filter(skill => {
    const text = `${skill.id} ${skill.name} ${skill.description} ${skill.tags.join(' ')}`.toLowerCase()
    return text.includes(query.toLowerCase())
  }), [skills, query])

  const toggleSkill = (skill: SkillDefinition) => {
    onChange(buildNextEnabledSkills(skill, normalizedEnabled, skills))
  }

  if (isLoading) {
    return <div className="text-sm text-[var(--text-secondary)]">{loadingText}</div>
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder={searchPlaceholder}
        value={query}
        onChange={event => setQuery(event.target.value)}
      />

      <div className="space-y-3">
        {filteredSkills.map(skill => {
          const checked = enabledIds.has(skill.id)
          const { chinese, english } = extractAuthorNameParts(skill.name)

          return (
            <label
              key={skill.id}
              className={`block cursor-pointer rounded-[var(--radius-lg)] border transition-all ${
                checked
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] bg-opacity-8 shadow-sm'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-secondary)]'
              } ${itemClassName}`}
            >
              <div className="flex items-start gap-4">
                <input
                  aria-label={`启用 ${chinese} 风格`}
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSkill(skill)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[var(--text-primary)]">{chinese}｜{english}</p>
                    {showPriority && <Badge variant={checked ? 'primary' : 'secondary'}>priority {skill.priority}</Badge>}
                    {skill.tags.slice(0, showPriority ? 4 : 2).map(tag => (
                      <Badge key={tag} variant={checked ? 'primary' : 'secondary'}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{skill.description}</p>
                  {showPriority && (
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      默认作用于：{(skill.applies_to || DEFAULT_SKILL_APPLIES_TO).join(' / ')}
                    </p>
                  )}
                </div>
              </div>
            </label>
          )
        })}

        {filteredSkills.length === 0 && (
          <div className="rounded-[var(--radius-lg)] bg-[var(--bg-tertiary)] py-12 text-center">
            <p className="text-[var(--text-secondary)]">{emptyText}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SkillPicker
