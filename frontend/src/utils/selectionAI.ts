export const RewriteMode = {
  POLISH: 'polish',
  EXPAND: 'expand',
  SHORTEN: 'shorten',
  CHARACTER_VOICE: 'character_voice',
  MORE_DRAMATIC: 'more_dramatic',
  ADD_FORESHADOWING: 'add_foreshadowing',
  CHECK_CONTINUITY: 'check_continuity',
} as const

export type RewriteMode = typeof RewriteMode[keyof typeof RewriteMode]

export interface CharacterInfo {
  name: string
  personality?: string
  appearance?: string
  catchphrase?: string
}

export interface RewriteContext {
  projectName?: string
  chapterTitle?: string
  precedingText?: string
  selectedText: string
  followingText?: string
  characters?: CharacterInfo[]
  worldSetting?: string
  mode: RewriteMode
  characterName?: string
}

const modeInstructions: Record<RewriteMode, string> = {
  [RewriteMode.POLISH]: '润色这段文字，让文笔更优美，保持原意不变。',
  [RewriteMode.EXPAND]: '扩写这段文字，增加细节描写，让场景更生动。',
  [RewriteMode.SHORTEN]: '缩写这段文字，精简表达，保持核心意思。',
  [RewriteMode.CHARACTER_VOICE]: '用指定角色的语气和性格重写这段对话/描述。',
  [RewriteMode.MORE_DRAMATIC]: '增强这段文字的戏剧张力，让情节更有冲突感。',
  [RewriteMode.ADD_FORESHADOWING]: '在这段文字中巧妙地植入伏笔，为后续情节铺垫。',
  [RewriteMode.CHECK_CONTINUITY]: '检查这段文字与前文的连续性和一致性，指出可能的矛盾点。',
}

export function buildRewritePrompt(ctx: RewriteContext): string {
  const parts: string[] = []

  parts.push('你是一位专业的写作助手。请根据以下要求修改文本。\n')

  if (ctx.projectName) {
    parts.push(`项目名称：${ctx.projectName}`)
  }
  if (ctx.chapterTitle) {
    parts.push(`当前章节：${ctx.chapterTitle}`)
  }

  if (ctx.characters && ctx.characters.length > 0) {
    parts.push('\n角色设定：')
    ctx.characters.forEach(char => {
      const charParts = [`- ${char.name}`]
      if (char.personality) charParts.push(`，性格：${char.personality}`)
      if (char.catchphrase) charParts.push(`，口头禅：${char.catchphrase}`)
      parts.push(charParts.join(''))
    })
  }

  if (ctx.worldSetting) {
    parts.push(`\n世界观设定：${ctx.worldSetting}`)
  }

  parts.push(`\n需要修改的文本：`)
  parts.push(`"${ctx.selectedText}"`)

  if (ctx.mode === RewriteMode.CHARACTER_VOICE && ctx.characterName) {
    const character = ctx.characters?.find(c => c.name === ctx.characterName)
    parts.push(`\n请用角色【${ctx.characterName}】的语气重写这段文字。`)
    if (character?.personality) {
      parts.push(`该角色性格：${character.personality}`)
    }
    if (character?.catchphrase) {
      parts.push(`该角色口头禅：${character.catchphrase}`)
    }
  } else {
    parts.push(`\n要求：${modeInstructions[ctx.mode]}`)
  }

  parts.push('\n请直接输出修改后的文本，不要解释。')

  return parts.join('\n')
}
