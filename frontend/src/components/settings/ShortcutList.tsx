import React, { useState, useMemo } from 'react'
import { SHORTCUTS, filterShortcuts } from '../../utils/shortcuts'

const groupLabels: Record<string, string> = {
  editor: '编辑器操作',
  modes: '模式切换',
  panels: '面板操作',
  navigation: '导航操作',
}

export const ShortcutList: React.FC = () => {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return filterShortcuts(search)
  }, [search])

  // Group by category for display
  const grouped = useMemo(() => {
    const result: Record<string, typeof filtered> = {}
    filtered.forEach(s => {
      const group = s.group || 'other'
      if (!result[group]) result[group] = []
      result[group].push(s)
    })
    return result
  }, [filtered])

  return (
    <div data-testid="shortcut-list">
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索快捷键..."
          className="w-full px-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          data-testid="shortcut-search"
        />
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          没有找到匹配的快捷键
        </div>
      ) : (
        Object.entries(grouped).map(([group, shortcuts]) => (
          <div key={group} className="mb-6">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
              {groupLabels[group] || group}
            </h3>
            <div className="space-y-2">
              {shortcuts.map((shortcut, index) => (
                <div
                  key={`${group}-${index}`}
                  className="flex justify-between items-center py-2 px-3 rounded bg-[var(--bg-tertiary)]"
                >
                  <span className="text-[var(--text-body)]">{shortcut.label}</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default ShortcutList
