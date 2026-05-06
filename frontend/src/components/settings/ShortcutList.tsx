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
    <div data-testid="shortcut-list" className="space-y-6">
      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索快捷键..."
          className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
          data-testid="shortcut-search"
        />
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">
          没有找到匹配的快捷键
        </div>
      ) : (
        Object.entries(grouped).map(([group, shortcuts]) => (
          <div key={group}>
            <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
              {groupLabels[group] || group}
            </h3>
            <div className="space-y-1">
              {shortcuts.map((shortcut, index) => (
                <div
                  key={`${group}-${index}`}
                  className="flex justify-between items-center py-2"
                >
                  <span className="text-sm text-[var(--text-body)]">{shortcut.label}</span>
                  <kbd className="px-2 py-0.5 text-xs font-mono bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded border border-[var(--border-subtle)]">
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
