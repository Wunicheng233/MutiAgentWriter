# 设置页面重设计 - 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将设置页面从单页卡片布局重构为侧边栏分类导航，暴露更多编辑器和 AI 偏好设置

**Architecture:** 
- 左侧侧边栏导航（6 个分类）
- 右侧内容区按分类渲染对应设置项
- 基于现有 `useLayoutStore` 扩展，新增状态和 actions
- 快捷键列表使用静态常量文件

**Tech Stack:** React 19 + TypeScript + Zustand + Tailwind CSS + Vitest

---

## 文件总览

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/store/useLayoutStore.ts` | 修改 | 新增 `defaultRewriteMode` 和 `clearAllLocalState` |
| `frontend/src/utils/shortcuts.ts` | 新建 | 快捷键列表静态常量 |
| `frontend/src/components/settings/SettingsSidebar.tsx` | 新建 | 侧边栏导航组件 |
| `frontend/src/components/settings/ShortcutList.tsx` | 新建 | 快捷键列表（含搜索） |
| `frontend/src/pages/Settings.tsx` | 修改 | 完整重构为侧边栏布局 |
| `frontend/src/tests/settings.test.tsx` | 修改 | 扩展测试覆盖新功能 |

---

## Task 1: 扩展 useLayoutStore 状态

**Files:**
- Modify: `frontend/src/store/useLayoutStore.ts`
- Test: `frontend/src/tests/useLayoutStore.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// Add to existing test file
import { RewriteMode } from '../utils/selectionAI'

describe('useLayoutStore - new settings state', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      defaultRewriteMode: RewriteMode.POLISH,
    })
  })

  it('should have defaultRewriteMode default to POLISH', () => {
    expect(useLayoutStore.getState().defaultRewriteMode).toBe(RewriteMode.POLISH)
  })

  it('should set defaultRewriteMode', () => {
    useLayoutStore.getState().setDefaultRewriteMode(RewriteMode.EXPAND)
    expect(useLayoutStore.getState().defaultRewriteMode).toBe(RewriteMode.EXPAND)
  })

  it('should clear all local state', () => {
    // Set some state first
    useLayoutStore.setState({
      focusMode: true,
      typewriterMode: true,
      fadeMode: true,
      defaultRewriteMode: RewriteMode.EXPAND,
    })
    
    useLayoutStore.getState().clearAllLocalState()
    
    // Verify reset to defaults
    expect(useLayoutStore.getState().focusMode).toBe(false)
    expect(useLayoutStore.getState().typewriterMode).toBe(false)
    expect(useLayoutStore.getState().fadeMode).toBe(false)
    expect(useLayoutStore.getState().defaultRewriteMode).toBe(RewriteMode.POLISH)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:run -- --run tests/useLayoutStore.test.ts`
Expected: FAIL with "Property 'defaultRewriteMode' does not exist"

- [ ] **Step 3: Implement new state and actions**

Add to `interface LayoutState`:

```typescript
import { RewriteMode } from '../utils/selectionAI'

interface LayoutState {
  // ... existing state ...
  
  defaultRewriteMode: RewriteMode
  
  setDefaultRewriteMode: (mode: RewriteMode) => void
  clearAllLocalState: () => void
}
```

Add to state initializer (inside persist):

```typescript
export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      // ... existing state ...
      defaultRewriteMode: RewriteMode.POLISH,
      
      setDefaultRewriteMode: (mode) => set({ defaultRewriteMode: mode }),
      
      clearAllLocalState: () => {
        // Reset to defaults
        set({
          navCollapsed: false,
          rightPanelOpen: false,
          rightPanelWidth: 320,
          rightPanelTab: 'selection' as const,
          focusMode: false,
          headerCollapsed: true,
          autoExpandHeaderInProject: true,
          defaultNavCollapsed: false,
          defaultAIPanelOpen: false,
          typewriterMode: false,
          fadeMode: false,
          vimMode: false,
          commandPaletteOpen: false,
          defaultRewriteMode: RewriteMode.POLISH,
        })
        // Clear localStorage
        if (typeof window !== 'undefined') {
          localStorage.clear()
        }
      },
    }),
    {
      name: 'storyforge-layout-storage',
    }
  )
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:run -- --run tests/useLayoutStore.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store/useLayoutStore.ts frontend/src/tests/useLayoutStore.test.ts
git commit -m "feat: add defaultRewriteMode and clearAllLocalState to layout store"
```

---

## Task 2: 创建快捷键静态常量

**Files:**
- Create: `frontend/src/utils/shortcuts.ts`
- Test: `frontend/src/tests/shortcuts.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { SHORTCUTS, getAllShortcuts, filterShortcuts } from '../utils/shortcuts'

describe('SHORTCUTS', () => {
  it('should define shortcut groups', () => {
    expect(SHORTCUTS).toHaveProperty('editor')
    expect(SHORTCUTS).toHaveProperty('modes')
    expect(SHORTCUTS).toHaveProperty('panels')
    expect(SHORTCUTS).toHaveProperty('navigation')
  })

  it('should have non-empty shortcut arrays', () => {
    expect(SHORTCUTS.editor.length).toBeGreaterThan(0)
    expect(SHORTCUTS.modes.length).toBeGreaterThan(0)
    expect(SHORTCUTS.panels.length).toBeGreaterThan(0)
    expect(SHORTCUTS.navigation.length).toBeGreaterThan(0)
  })

  it('each shortcut should have label and keys', () => {
    SHORTCUTS.editor.forEach(shortcut => {
      expect(shortcut).toHaveProperty('label')
      expect(shortcut).toHaveProperty('keys')
      expect(typeof shortcut.label).toBe('string')
      expect(typeof shortcut.keys).toBe('string')
    })
  })

  it('getAllShortcuts should return flattened list', () => {
    const all = getAllShortcuts()
    expect(Array.isArray(all)).toBe(true)
    expect(all.length).toBeGreaterThan(SHORTCUTS.editor.length)
    all.forEach(shortcut => {
      expect(shortcut).toHaveProperty('label')
      expect(shortcut).toHaveProperty('keys')
      expect(shortcut).toHaveProperty('group')
    })
  })

  it('filterShortcuts should filter by label', () => {
    const result = filterShortcuts('Typewriter')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].label.toLowerCase()).toContain('typewriter')
  })

  it('filterShortcuts should be case-insensitive', () => {
    const result1 = filterShortcuts('typewriter')
    const result2 = filterShortcuts('TYPEWRITER')
    expect(result1.length).toBe(result2.length)
  })

  it('filterShortcuts returns empty array for no match', () => {
    const result = filterShortcuts('xyz-nonexistent')
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:run -- --run tests/shortcuts.test.ts`
Expected: FAIL with "Cannot find module '../utils/shortcuts'"

- [ ] **Step 3: Implement shortcuts utility**

```typescript
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
    { label: '切换 Vim 模式', keys: 'Cmd + Shift + V' },
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
    shortcuts.map(s => ({ ...s, group }))
  )
}

export function filterShortcuts(query: string): (Shortcut & { group: string })[] {
  if (!query.trim()) return getAllShortcuts()
  
  const lowerQuery = query.toLowerCase()
  return getAllShortcuts().filter(s =>
    s.label.toLowerCase().includes(lowerQuery) ||
    s.keys.toLowerCase().includes(lowerQuery)
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:run -- --run tests/shortcuts.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/shortcuts.ts frontend/src/tests/shortcuts.test.ts
git commit -m "feat: add shortcuts utility with search filter"
```

---

## Task 3: 创建设置侧边栏组件

**Files:**
- Create: `frontend/src/components/settings/SettingsSidebar.tsx`
- Test: `frontend/src/tests/SettingsSidebar.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsSidebar } from '../components/settings/SettingsSidebar'

describe('SettingsSidebar', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('should render all category tabs', () => {
    render(<SettingsSidebar activeTab="theme" onTabChange={mockOnChange} />)
    
    expect(screen.getByText('外观主题')).toBeTruthy()
    expect(screen.getByText('编辑器模式')).toBeTruthy()
    expect(screen.getByText('键盘快捷键')).toBeTruthy()
    expect(screen.getByText('AI 偏好')).toBeTruthy()
    expect(screen.getByText('布局设置')).toBeTruthy()
    expect(screen.getByText('账户数据')).toBeTruthy()
  })

  it('should highlight the active tab', () => {
    render(<SettingsSidebar activeTab="editor" onTabChange={mockOnChange} />)
    
    const editorTab = screen.getByText('编辑器模式').closest('button')
    expect(editorTab?.className).toContain('bg-[var(--accent-primary)]')
  })

  it('should call onTabChange when clicking a tab', () => {
    render(<SettingsSidebar activeTab="theme" onTabChange={mockOnChange} />)
    
    fireEvent.click(screen.getByText('键盘快捷键'))
    expect(mockOnChange).toHaveBeenCalledWith('shortcuts')
  })

  it('should have icons for each category', () => {
    render(<SettingsSidebar activeTab="theme" onTabChange={mockOnChange} />)
    
    // Verify each tab has an icon (using emoji or svg)
    const tabs = screen.getAllByRole('button')
    expect(tabs.length).toBe(6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:run -- --run tests/SettingsSidebar.test.tsx`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement SettingsSidebar component**

```typescript
import React from 'react'

export type SettingsTab = 'theme' | 'editor' | 'shortcuts' | 'ai' | 'layout' | 'account'

interface SettingsSidebarProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}

interface TabConfig {
  id: SettingsTab
  label: string
  icon: string
}

const tabs: TabConfig[] = [
  { id: 'theme', label: '外观主题', icon: '' },
  { id: 'editor', label: '编辑器模式', icon: '⌨' },
  { id: 'shortcuts', label: '键盘快捷键', icon: '' },
  { id: 'ai', label: 'AI 偏好', icon: '' },
  { id: 'layout', label: '布局设置', icon: '' },
  { id: 'account', label: '账户数据', icon: '' },
]

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="flex flex-col gap-1" data-testid="settings-sidebar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
            activeTab === tab.id
              ? 'bg-[var(--accent-primary)] text-white'
              : 'text-[var(--text-body)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
          }`}
          data-testid={`settings-tab-${tab.id}`}
        >
          <span className="text-lg">{tab.icon}</span>
          <span className="font-medium">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}

export default SettingsSidebar
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:run -- --run tests/SettingsSidebar.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/settings/SettingsSidebar.tsx frontend/src/tests/SettingsSidebar.test.tsx
git commit -m "feat: add SettingsSidebar navigation component"
```

---

## Task 4: 创建快捷键列表组件

**Files:**
- Create: `frontend/src/components/settings/ShortcutList.tsx`
- Test: `frontend/src/tests/ShortcutList.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { ShortcutList } from '../components/settings/ShortcutList'

describe('ShortcutList', () => {
  it('should render search input', () => {
    render(<ShortcutList />)
    expect(screen.getByPlaceholderText(/搜索快捷键/i)).toBeTruthy()
  })

  it('should render shortcut groups', () => {
    render(<ShortcutList />)
    expect(screen.getByText('编辑器操作')).toBeTruthy()
    expect(screen.getByText('模式切换')).toBeTruthy()
    expect(screen.getByText('面板操作')).toBeTruthy()
    expect(screen.getByText('导航操作')).toBeTruthy()
  })

  it('should render shortcut items with label and keys', () => {
    render(<ShortcutList />)
    expect(screen.getByText('切换 Typewriter 模式')).toBeTruthy()
    expect(screen.getByText('Cmd + Shift + T')).toBeTruthy()
  })

  it('should filter shortcuts based on search input', () => {
    render(<ShortcutList />)
    
    const searchInput = screen.getByPlaceholderText(/搜索快捷键/i)
    fireEvent.change(searchInput, { target: { value: 'Typewriter' } })
    
    expect(screen.getByText('切换 Typewriter 模式')).toBeTruthy()
    // Should not show unrelated shortcuts
    expect(screen.queryByText('切换侧边栏')).toBeNull()
  })

  it('should show empty message when no shortcuts match', () => {
    render(<ShortcutList />)
    
    const searchInput = screen.getByPlaceholderText(/搜索快捷键/i)
    fireEvent.change(searchInput, { target: { value: 'xyz-nonexistent' } })
    
    expect(screen.getByText(/没有找到匹配的快捷键/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:run -- --run tests/ShortcutList.test.tsx`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement ShortcutList component**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:run -- --run tests/ShortcutList.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/settings/ShortcutList.tsx frontend/src/tests/ShortcutList.test.tsx
git commit -m "feat: add ShortcutList component with search"
```

---

## Task 5: 重构 Settings 主页面

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`
- Test: `frontend/src/tests/settings.test.tsx` (replace existing)

- [ ] **Step 1: Write failing test for new layout**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Settings } from '../pages/Settings'
import { useLayoutStore } from '../store/useLayoutStore'
import { RewriteMode } from '../utils/selectionAI'

describe('Settings Page', () => {
  beforeEach(() => {
    // Reset store state
    useLayoutStore.setState({
      typewriterMode: false,
      fadeMode: false,
      vimMode: false,
      focusMode: false,
      defaultAIPanelOpen: false,
      autoExpandHeaderInProject: true,
      defaultRewriteMode: RewriteMode.POLISH,
    })
  })

  it('should render sidebar with all categories', () => {
    render(<Settings />)
    expect(screen.getByTestId('settings-sidebar')).toBeTruthy()
    expect(screen.getByTestId('settings-tab-theme')).toBeTruthy()
    expect(screen.getByTestId('settings-tab-editor')).toBeTruthy()
    expect(screen.getByTestId('settings-tab-shortcuts')).toBeTruthy()
    expect(screen.getByTestId('settings-tab-ai')).toBeTruthy()
    expect(screen.getByTestId('settings-tab-layout')).toBeTruthy()
    expect(screen.getByTestId('settings-tab-account')).toBeTruthy()
  })

  it('should show theme tab content by default', () => {
    render(<Settings />)
    expect(screen.getByText('Warm Parchment')).toBeTruthy()
  })

  it('should switch tabs when clicking sidebar', () => {
    render(<Settings />)
    
    fireEvent.click(screen.getByTestId('settings-tab-editor'))
    expect(screen.getByText('Typewriter 模式')).toBeTruthy()
    
    fireEvent.click(screen.getByTestId('settings-tab-shortcuts'))
    expect(screen.getByTestId('shortcut-search')).toBeTruthy()
  })

  it('editor tab should have mode switches', () => {
    render(<Settings />)
    fireEvent.click(screen.getByTestId('settings-tab-editor'))
    
    expect(screen.getByText('Typewriter 模式')).toBeTruthy()
    expect(screen.getByText('Fade 模式')).toBeTruthy()
    expect(screen.getByText('Vim 模式')).toBeTruthy()
  })

  it('layout tab should have layout switches', () => {
    render(<Settings />)
    fireEvent.click(screen.getByTestId('settings-tab-layout'))
    
    expect(screen.getByText('Focus 模式')).toBeTruthy()
    expect(screen.getByText('右侧面板默认打开')).toBeTruthy()
    expect(screen.getByText('顶栏自动展开')).toBeTruthy()
  })

  it('ai tab should have default rewrite mode selector', () => {
    render(<Settings />)
    fireEvent.click(screen.getByTestId('settings-tab-ai'))
    
    expect(screen.getByText('选区 AI 默认重写模式')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:run -- --run tests/settings.test.tsx`
Expected: FAIL - existing tests don't match new structure

- [ ] **Step 3: Implement the new Settings page**

Replace the entire `Settings.tsx` file:

```typescript
import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Button, Input, Divider, Alert, Switch, Select } from '../components/v2'
import { ThemeSelector } from '../components/ThemeSelector'
import { CanvasContainer } from '../components/layout/CanvasContainer'
import SettingsSidebar, { SettingsTab } from '../components/settings/SettingsSidebar'
import ShortcutList from '../components/settings/ShortcutList'
import { useAuthStore } from '../store/useAuthStore'
import { useLayoutStore } from '../store/useLayoutStore'
import { clearApiKey, getUserMonthlyTokenStats, updateApiKey } from '../utils/endpoints'
import { useToast } from '../components/toastContext'
import { RewriteMode } from '../utils/selectionAI'

const tabTitles: Record<SettingsTab, string> = {
  theme: '外观主题',
  editor: '编辑器模式',
  shortcuts: '键盘快捷键',
  ai: 'AI 助手偏好',
  layout: '布局设置',
  account: '账户与数据',
}

const rewriteModeOptions = [
  { value: RewriteMode.POLISH, label: '润色' },
  { value: RewriteMode.EXPAND, label: '扩写' },
  { value: RewriteMode.SHORTEN, label: '缩写' },
  { value: RewriteMode.MORE_DRAMATIC, label: '增强戏剧张力' },
]

export const Settings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = (searchParams.get('tab') as SettingsTab) || 'theme'
  
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabFromUrl)
  
  const { user, setUser } = useAuthStore()
  const {
    typewriterMode,
    fadeMode,
    vimMode,
    focusMode,
    defaultAIPanelOpen,
    autoExpandHeaderInProject,
    defaultRewriteMode,
    toggleTypewriterMode,
    toggleFadeMode,
    toggleVimMode,
    toggleFocusMode,
    setDefaultAIPanelOpen,
    setAutoExpandHeaderInProject,
    setDefaultRewriteMode,
    clearAllLocalState,
  } = useLayoutStore()
  
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [newApiKey, setNewApiKey] = useState('')
  const [alert, setAlert] = useState<{ variant: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const { data: monthlyStats } = useQuery({
    queryKey: ['user-monthly-token-stats'],
    queryFn: getUserMonthlyTokenStats,
  })

  // Update URL when tab changes
  useEffect(() => {
    setSearchParams({ tab: activeTab })
  }, [activeTab, setSearchParams])

  // Handle tab from URL changes
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  const clearMutation = useMutation({
    mutationFn: clearApiKey,
    onSuccess: (data) => {
      setUser(data)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setAlert({ variant: 'success', message: '已切换为系统默认 API Key' })
      setLoading(false)
      setTimeout(() => setAlert(null), 3000)
    },
    onError: () => {
      showToast('清除失败', 'error')
      setLoading(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateApiKey,
    onSuccess: (data) => {
      setUser(data)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setAlert({ variant: 'success', message: 'API Key 已更新' })
      setNewApiKey('')
      setLoading(false)
      setTimeout(() => setAlert(null), 3000)
    },
    onError: () => {
      showToast('更新失败', 'error')
      setLoading(false)
    },
  })

  const handleClear = () => {
    setLoading(true)
    clearMutation.mutate()
  }

  const handleUpdate = () => {
    if (!newApiKey.trim()) {
      showToast('请输入 API Key', 'error')
      return
    }
    setLoading(true)
    updateMutation.mutate(newApiKey.trim())
  }

  const handleClearLocalState = () => {
    clearAllLocalState()
    setShowClearConfirm(false)
    showToast('本地缓存已清除，请刷新页面', 'success')
  }

  const displayApiKey = () => {
    if (!user?.api_key) return '(未设置)'
    if (user.api_key.length <= 8) return user.api_key
    return `${user.api_key.slice(0, 4)}...${user.api_key.slice(-4)}`
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'theme':
        return <ThemeSelector />

      case 'editor':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[var(--text-primary)] font-medium">Typewriter 模式</p>
                <p className="text-sm text-[var(--text-muted)]">光标保持在视口 1/3 处，平滑滚动</p>
              </div>
              <Switch checked={typewriterMode} onChange={toggleTypewriterMode} />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[var(--text-primary)] font-medium">Fade 模式</p>
                <p className="text-sm text-[var(--text-muted)]">淡化非当前段落，聚焦当前编辑内容</p>
              </div>
              <Switch checked={fadeMode} onChange={toggleFadeMode} />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[var(--text-primary)] font-medium">Vim 模式</p>
                <p className="text-sm text-[var(--text-muted)]">启用 Vim 键绑定，需刷新页面生效</p>
              </div>
              <Switch checked={vimMode} onChange={toggleVimMode} />
            </div>
          </div>
        )

      case 'shortcuts':
        return <ShortcutList />

      case 'ai':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-[var(--text-primary)] font-medium mb-2">
                选区 AI 默认重写模式
              </label>
              <Select
                value={defaultRewriteMode}
                onChange={(e) => setDefaultRewriteMode(e.target.value as RewriteMode)}
                options={rewriteModeOptions}
                className="w-full"
              />
            </div>

            <Divider />

            <div>
              <h3 className="text-lg font-medium mb-4 text-[var(--text-primary)]">API Key 设置</h3>
              
              <div className="flex justify-between items-center py-2 mb-4">
                <span className="text-[var(--text-secondary)]">当前 Key</span>
                <code className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-[var(--text-body)] text-sm">
                  {displayApiKey()}
                </code>
              </div>

              <div className="space-y-4">
                <Input
                  label="火山引擎 API Key"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                />
                <Button
                  variant="primary"
                  onClick={handleUpdate}
                  disabled={loading}
                >
                  {loading ? '保存中...' : '保存'}
                </Button>
              </div>

              <Divider className="my-6" />
              <div>
                <Button
                  variant="secondary"
                  onClick={handleClear}
                  disabled={loading}
                >
                  {loading ? '清除中...' : '使用系统默认 Key'}
                </Button>
              </div>
            </div>
          </div>
        )

      case 'layout':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[var(--text-primary)] font-medium">Focus 模式</p>
                <p className="text-sm text-[var(--text-muted)]">隐藏非必要 UI 元素，聚焦写作</p>
              </div>
              <Switch checked={focusMode} onChange={toggleFocusMode} />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[var(--text-primary)] font-medium">右侧面板默认打开</p>
                <p className="text-sm text-[var(--text-muted)]">进入项目时自动打开 AI 面板</p>
              </div>
              <Switch checked={defaultAIPanelOpen} onChange={setDefaultAIPanelOpen} />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[var(--text-primary)] font-medium">顶栏自动展开</p>
                <p className="text-sm text-[var(--text-muted)]">进入项目时自动展开顶部导航栏</p>
              </div>
              <Switch checked={autoExpandHeaderInProject} onChange={setAutoExpandHeaderInProject} />
            </div>
          </div>
        )

      case 'account':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-[var(--text-primary)]">账户信息</h3>
              <div className="flex justify-between items-center py-2">
                <span className="text-[var(--text-secondary)]">用户名</span>
                <span className="text-[var(--text-body)] font-medium">{user?.username}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[var(--text-secondary)]">邮箱</span>
                <span className="text-[var(--text-body)] font-medium">{user?.email}</span>
              </div>
            </div>

            {monthlyStats && monthlyStats.total_tokens > 0 && (
              <>
                <Divider />
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-[var(--text-primary)]">
                    本月使用统计 ({monthlyStats.month})
                  </h3>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[var(--text-secondary)]">总 Token</span>
                    <span className="text-[var(--text-body)] font-medium">{monthlyStats.total_tokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[var(--text-secondary)]">Prompt</span>
                    <span className="text-[var(--text-body)] font-medium">{monthlyStats.total_prompt_tokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[var(--text-secondary)]">Completion</span>
                    <span className="text-[var(--text-body)] font-medium">{monthlyStats.total_completion_tokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[var(--text-secondary)]">估算费用</span>
                    <span className="text-[var(--text-body)] font-medium">${monthlyStats.estimated_cost_usd.toFixed(4)}</span>
                  </div>
                </div>
              </>
            )}

            <Divider />
            
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-[var(--text-primary)]">数据管理</h3>
              <Button
                variant="secondary"
                onClick={() => setShowClearConfirm(true)}
              >
                清除本地缓存
              </Button>
              <p className="text-sm text-[var(--text-muted)]">
                清除所有本地保存的设置和状态，恢复为默认值
              </p>
            </div>

            {/* Clear Confirmation Modal */}
            {showClearConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className="max-w-md w-full mx-4">
                  <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">
                    确认清除本地缓存
                  </h3>
                  <p className="text-[var(--text-secondary)] mb-6">
                    此操作将清除所有本地保存的设置和状态，包括主题偏好、模式设置等。操作不可撤销。
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => setShowClearConfirm(false)}
                    >
                      取消
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleClearLocalState}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      确认清除
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <CanvasContainer maxWidth={900}>
      <h1 className="text-3xl font-medium text-[var(--text-primary)] mb-8">设置</h1>

      {alert && (
        <Alert variant={alert.variant} className="mb-6">
          {alert.message}
        </Alert>
      )}

      <div className="flex gap-8">
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0">
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-medium text-[var(--text-primary)] mb-6">
            {tabTitles[activeTab]}
          </h2>
          <Card>
            {renderTabContent()}
          </Card>
        </div>
      </div>
    </CanvasContainer>
  )
}

export default Settings
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:run -- --run tests/settings.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite to ensure no regressions**

Run: `cd frontend && npm run test:run -- --run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Settings.tsx frontend/src/tests/settings.test.tsx
git commit -m "feat: redesign Settings page with sidebar navigation"
```

---

## Task 6: 确保 Select 组件支持所需 props

**Files:**
- Verify: `frontend/src/components/v2/Select.tsx`

- [ ] **Step 1: Check if Select component exists**

Run: `ls frontend/src/components/v2/Select.tsx`

If the file doesn't exist, create a simple Select component:

```typescript
import React from 'react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: SelectOption[]
  className?: string
  placeholder?: string
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  className = '',
  placeholder,
}) => {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`px-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

export default Select
```

- [ ] **Step 2: Add to v2 index exports**

Update `frontend/src/components/v2/index.ts` to include Select export.

- [ ] **Step 3: Commit if changes were made**

```bash
git add frontend/src/components/v2/Select.tsx frontend/src/components/v2/index.ts
git commit -m "feat: add Select component for settings dropdowns"
```

---

## Task 7: 集成设置入口到导航

**Files:**
- Verify: Navigation already has Settings link

- [ ] **Step 1: Verify settings navigation exists**

Check that the navigation rail already has a settings link. If not, add it. This is likely already implemented.

- [ ] **Step 2: No changes needed if already present**

If settings navigation is already working, just verify it links to the correct route.

---

## 验收清单

- [ ] 设置页面采用侧边栏 + 内容区两栏布局
- [ ] 6 个分类完整实现（外观主题、编辑器模式、键盘快捷键、AI 偏好、布局设置、账户数据）
- [ ] 点击侧边栏切换分类内容正确
- [ ] URL query 参数支持直接跳转（`?tab=editor`）
- [ ] 所有设置项修改即时生效并持久化
- [ ] 快捷键列表可搜索过滤
- [ ] 清除本地缓存功能完整（确认弹窗 + Toast 提示）
- [ ] 所有新增功能有完整的单元测试
- [ ] 所有现有测试通过
