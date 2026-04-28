import React, { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Input } from '../components/v2'
import { CanvasContainer } from '../components/layout/CanvasContainer'
import {
  getProject,
  listSkills,
  updateProjectSkills,
} from '../utils/endpoints'
import type { EnabledSkillConfig, SkillDefinition } from '../types/api'
import { useToast } from '../components/toastContext'

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

interface AuthorNameParts {
  chinese: string
  english: string
}

function extractAuthorNameParts(name: string): AuthorNameParts {
  // 处理中英文分隔："村上春树思维操作系统 | Haruki Murakami Perspective"
  const parts = name.split(/\s*[|｜]\s*/)
  const chinesePart = parts[0].trim()
  const englishPart = parts[1] || ''

  // 作家 slug 映射 (slug -> [中文名, 英文名])
  const authorMap: Record<string, [string, string]> = {
    'fenghuo': ['烽火戏诸侯', 'Fenghuo Xizhuhou'],
    'fenghuoxizhuhou': ['烽火戏诸侯', 'Fenghuo Xizhuhou'],
    'huwei': ['狐尾的笔', 'Huwei De Bi'],
    'huweidebi': ['狐尾的笔', 'Huwei De Bi'],
    'yuyuzhu': ['郁雨竹', 'Yu Yuzhu'],
    'jinyong': ['金庸', 'Jin Yong'],
    'liudanpashui': ['榴弹怕水', 'Liudan Pashui'],
    'maopu': ['猫腻', 'Mao Ni'],
    'wangzengqi': ['汪曾祺', 'Wang Zengqi'],
    'zhangdada': ['张大大', 'Zhang Dada'],
    'chenzhongshi': ['陈忠实', 'Chen Zhongshi'],
    'luxun': ['鲁迅', 'Lu Xun'],
    'murakami': ['村上春树', 'Haruki Murakami'],
    'rowling': ['J.K.罗琳', 'J.K. Rowling'],
    'jkrowling': ['J.K.罗琳', 'J.K. Rowling'],
    'cixin': ['刘慈欣', 'Liu Cixin'],
    'liucixin': ['刘慈欣', 'Liu Cixin'],
    'tangjiashao': ['唐家三少', 'Tang Jia San Shao'],
  }

  // 处理 slug 格式：liudanpashui-perspective / jin-yong-perspective
  if (name.includes('-perspective') || name.includes('_perspective')) {
    const slug = name.toLowerCase().replace(/[-_](perspective|style)$/, '').replace(/[-_]/g, '')
    if (authorMap[slug]) {
      return { chinese: authorMap[slug][0], english: authorMap[slug][1] }
    }
    // 模糊匹配
    for (const [key, [chinese, english]] of Object.entries(authorMap)) {
      if (slug.includes(key)) return { chinese, english }
    }
  }

  // 从中文部分提取作家名（移除后缀）
  const chinese = chinesePart
    .replace(/的?视角$/, '')
    .replace(/的?思维操作系统$/, '')
    .replace(/的?风格系统$/, '')
    .replace(/的?创作思维$/, '')
    .replace(/的?写作系统$/, '')
    .replace(/的?文风系统$/, '')
    .trim()

  // 用中文名称在映射表中查找
  for (const [, [mapChinese, mapEnglish]] of Object.entries(authorMap)) {
    if (chinese === mapChinese || chinese.includes(mapChinese) || mapChinese.includes(chinese)) {
      return { chinese: mapChinese, english: mapEnglish }
    }
  }

  // 从英文部分提取作家名（移除 Perspective/Style 后缀）
  const english = englishPart
    .replace(/\s*(Perspective|Style|System)$/i, '')
    .trim() || chinese

  return { chinese, english }
}

export const SkillManagement: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const projectId = id ? parseInt(id, 10) : 0
  const [query, setQuery] = useState('')
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
  const normalizedEnabled = normalizeEnabled(enabledSkills)
  const enabledIds = new Set(normalizedEnabled.map(item => item.skill_id))

  const filteredSkills = useMemo(() => skills.filter(skill => {
    const text = `${skill.name} ${skill.description} ${skill.tags.join(' ')}`.toLowerCase()
    return text.includes(query.toLowerCase())
  }), [skills, query])

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

        <Input
          placeholder="搜索作家风格..."
          value={query}
          onChange={event => setQuery(event.target.value)}
        />

        {isLoading ? (
          <div className="text-center py-16">
            <p className="text-[var(--text-secondary)]">正在加载风格库...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSkills.map(skill => {
              const checked = enabledIds.has(skill.id)
              const { chinese, english } = extractAuthorNameParts(skill.name)

              return (
                <label
                  key={skill.id}
                  className={`block cursor-pointer rounded-[var(--radius-lg)] p-6 transition-all duration-200 ease-out border ${
                    checked
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] bg-opacity-8 shadow-md'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-5">
                    <input
                      aria-label={`启用 ${chinese} 风格`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSkill(skill)}
                      className="mt-1 w-5 h-5 rounded border-2"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-medium text-[var(--text-primary)]">
                          {chinese}｜{english}
                        </h3>
                        <div className="flex gap-2">
                          {skill.tags.slice(0, 2).map(tag => (
                            <Badge
                              key={tag}
                              variant={checked ? 'primary' : 'secondary'}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <p className="mt-3 leading-relaxed text-[var(--text-body)]">
                        {skill.description}
                      </p>
                    </div>
                  </div>
                </label>
              )
            })}

            {filteredSkills.length === 0 && (
              <div className="text-center py-16 rounded-2xl bg-[var(--bg-tertiary)]">
                <p className="text-[var(--text-secondary)]">没有匹配的风格</p>
              </div>
            )}
          </div>
        )}
      </div>
    </CanvasContainer>
  )
}

export default SkillManagement
