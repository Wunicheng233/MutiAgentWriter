import type { EnabledSkillConfig, JsonValue, SkillDefinition } from '../types/api'

export const DEFAULT_SKILL_APPLIES_TO = ['planner', 'writer', 'revise']

export function isAuthorStyleSkill(skill?: Pick<SkillDefinition, 'id' | 'tags'> | null): boolean {
  if (!skill) return false
  const tags = new Set(skill.tags ?? [])
  return tags.has('author-style') || tags.has('perspective') || skill.id.endsWith('-perspective')
}

export function defaultSkillConfig(skill: SkillDefinition): Record<string, JsonValue> {
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

export function normalizeEnabledSkills(enabledSkills: EnabledSkillConfig[] = []): EnabledSkillConfig[] {
  return enabledSkills.map(item => ({
    skill_id: item.skill_id,
    applies_to_override: item.applies_to_override ?? DEFAULT_SKILL_APPLIES_TO,
    config: item.config ?? {},
  }))
}

export function buildNextEnabledSkills(
  selectedSkill: SkillDefinition,
  enabledSkills: EnabledSkillConfig[] = [],
  allSkills: SkillDefinition[] = []
): EnabledSkillConfig[] {
  const normalizedEnabled = normalizeEnabledSkills(enabledSkills)
  const enabledIds = new Set(normalizedEnabled.map(item => item.skill_id))

  if (enabledIds.has(selectedSkill.id)) {
    return normalizedEnabled.filter(item => item.skill_id !== selectedSkill.id)
  }

  const skillById = new Map(allSkills.map(skill => [skill.id, skill]))
  const selectedIsAuthorStyle = isAuthorStyleSkill(selectedSkill)
  const preservedEnabled = selectedIsAuthorStyle
    ? normalizedEnabled.filter(item => !isAuthorStyleSkill(skillById.get(item.skill_id)))
    : normalizedEnabled

  return [
    ...preservedEnabled,
    {
      skill_id: selectedSkill.id,
      applies_to_override: DEFAULT_SKILL_APPLIES_TO,
      config: defaultSkillConfig(selectedSkill),
    },
  ]
}
