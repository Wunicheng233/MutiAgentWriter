export interface Shortcut {
  label: string
  keys: string
  group?: string
}

export interface ShortcutGroups {
  editor: Shortcut[]
  modes: Shortcut[]
  panels: Shortcut[]
  navigation: Shortcut[]
}

export const SHORTCUTS: ShortcutGroups = {
  editor: [
    { label: '保存', keys: 'Cmd + S' },
    { label: '撤销', keys: 'Cmd + Z' },
    { label: '重做', keys: 'Cmd + Shift + Z' },
  ],
  modes: [
    { label: '切换 Typewriter 模式', keys: 'Cmd + Shift + T' },
    { label: '切换 Fade 模式', keys: 'Cmd + Shift + G' },
    { label: '切换 Focus 模式', keys: 'Cmd + Shift + F' },
  ],
  panels: [
    { label: '打开命令面板', keys: 'Cmd + K' },
    { label: '切换 AI 面板', keys: 'Cmd + \\' },
    { label: '打开 AI 面板', keys: 'Cmd + I' },
  ],
  navigation: [
    { label: '切换侧边栏', keys: 'Cmd + B' },
    { label: '切换顶栏', keys: 'Cmd + T' },
  ],
}

export function getAllShortcuts(): (Shortcut & { group: string })[] {
  return Object.entries(SHORTCUTS).flatMap(([group, shortcuts]) =>
    shortcuts.map((s: Shortcut) => ({ ...s, group }))
  )
}

export function filterShortcuts(query: string): (Shortcut & { group: string })[] {
  if (!query.trim()) return getAllShortcuts()

  const lowerQuery = query.toLowerCase()
  return getAllShortcuts().filter((s: Shortcut & { group: string }) =>
    s.label.toLowerCase().includes(lowerQuery) ||
    s.keys.toLowerCase().includes(lowerQuery)
  )
}
