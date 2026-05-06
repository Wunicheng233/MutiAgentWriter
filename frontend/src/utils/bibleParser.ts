import type { Character, WorldSetting } from '../types/api'

/**
 * 从策划文档中解析角色信息
 * 使用简单的正则匹配提取角色名和相关描述
 */
export function parseCharactersFromPlan(planText: string): Omit<Character, 'id' | 'createdAt' | 'updatedAt'>[] {
  const characters: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>[] = []

  const lines = planText.split('\n')

  let currentCharacter: Omit<Character, 'id' | 'createdAt' | 'updatedAt'> | null = null
  let inCharacterSection = false
  let isProtagonistSection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // 检测 ## 章节标题
    if (line.match(/^##[^#]/)) {
      const title = line.replace(/^##+\s*/, '')
      isProtagonistSection = /主角|主要角色/.test(title)
      // 角色区块包括角色、人物、人设、主角等
      inCharacterSection = /角色|人物|人设|主角/.test(title)

      // 如果离开角色区块，保存当前角色
      if (!inCharacterSection && currentCharacter) {
        characters.push(currentCharacter)
        currentCharacter = null
      }
      continue
    }

    // 在角色区块内解析 ### 角色
    if (inCharacterSection && line.match(/^###[^#]/)) {
      // 保存上一个角色
      if (currentCharacter) {
        characters.push(currentCharacter)
      }

      // 开始新角色
      const name = line.replace(/^###+\s*/, '').trim()
      currentCharacter = {
        name,
        role: isProtagonistSection ? 'protagonist' : 'support',
        isMainCharacter: isProtagonistSection,
      }
      continue
    }

    // 解析角色属性 - 支持以 - 开头的列表项
    if (currentCharacter && line.startsWith('-')) {
      const content = line.replace(/^-\s*/, '')

      if (/性格|个性|性情/.test(content)) {
        currentCharacter.personality = content.replace(/.*?[：:]\s*/, '')
      } else if (/外貌|长相|样子|外表/.test(content)) {
        currentCharacter.appearance = content.replace(/.*?[：:]\s*/, '')
      } else if (/身份|职业/.test(content)) {
        currentCharacter.background = content.replace(/.*?[：:]\s*/, '')
      } else if (/口头禅|名言/.test(content)) {
        currentCharacter.catchphrase = content.replace(/.*?[：:]\s*/, '')
      }
    }
  }

  // 保存最后一个角色
  if (currentCharacter) {
    characters.push(currentCharacter)
  }

  return characters
}

/**
 * 从策划文档中解析世界观设定
 */
export function parseWorldFromPlan(planText: string): Partial<WorldSetting> {
  const result: Partial<WorldSetting> = {}

  const lines = planText.split('\n')
  let inWorldSection = false
  let currentSubSection: string | null = null
  let accumulatedContent = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // 检测 ## 世界观章节
    if (line.match(/^##[^#]/)) {
      const title = line.replace(/^##+\s*/, '')
      if (/世界观|世界设定|设定/.test(title)) {
        inWorldSection = true
      } else if (inWorldSection) {
        // 离开世界观章节
        inWorldSection = false
        if (currentSubSection && accumulatedContent) {
          saveSubSection(result, currentSubSection, accumulatedContent)
        }
        currentSubSection = null
        accumulatedContent = ''
      }
      continue
    }

    if (!inWorldSection) continue

    // 检测 ### 子章节
    if (line.match(/^###[^#]/)) {
      // 保存上一个子章节
      if (currentSubSection && accumulatedContent) {
        saveSubSection(result, currentSubSection, accumulatedContent)
      }
      currentSubSection = line.replace(/^###+\s*/, '').trim()
      accumulatedContent = ''
      continue
    }

    // 累积内容
    if (currentSubSection && line && !line.startsWith('```')) {
      accumulatedContent += line + '\n'
    }
  }

  // 保存最后一个子章节
  if (currentSubSection && accumulatedContent) {
    saveSubSection(result, currentSubSection, accumulatedContent)
  }

  return result
}

function saveSubSection(result: Partial<WorldSetting>, subSection: string, content: string) {
  const trimmed = content.trim()
  if (!trimmed) return

  if (/力量体系|修为|境界|修炼/.test(subSection)) {
    result.powerSystem = trimmed
  } else if (/规则|法则|世界规则/.test(subSection)) {
    result.rules = trimmed
  } else if (/文化|风俗|社会/.test(subSection)) {
    result.culture = trimmed
  }
}

/**
 * 从策划文档中解析完整的 Bible 数据
 */
export function parseBibleFromPlan(planText: string): Partial<{
  characters: ReturnType<typeof parseCharactersFromPlan>
  world: Partial<WorldSetting>
}> {
  return {
    characters: parseCharactersFromPlan(planText),
    world: parseWorldFromPlan(planText),
  }
}
