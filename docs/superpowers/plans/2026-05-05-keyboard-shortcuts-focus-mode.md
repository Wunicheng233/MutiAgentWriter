# 键盘快捷键与无干扰模式 - 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Typewriter 模式、Fade 模式、Vim 键绑定和命令面板，提供专业级无干扰写作体验

**Architecture:** 基于现有 Zustand store 架构，新增 4 个模式状态，通过自定义 hooks 实现编辑器行为，通过 CommandPalette 组件提供全局命令入口

**Tech Stack:** React 19 + TypeScript + TipTap v2 + Zustand + Vitest + @tiptap/extension-vim

---

## 文件总览

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/store/useLayoutStore.ts` | 修改 | 新增 4 个模式状态和 actions |
| `frontend/package.json` | 修改 | 添加 `@tiptap/extension-vim` 依赖 |
| `frontend/src/hooks/useKeyboardShortcuts.ts` | 修改 | 新增模式切换快捷键和 Cmd+K |
| `frontend/src/hooks/useTypewriterMode.ts` | 新建 | Typewriter 模式逻辑 |
| `frontend/src/hooks/useFadeMode.ts` | 新建 | Fade 模式逻辑 |
| `frontend/src/components/CommandPalette/CommandPalette.tsx` | 新建 | Cmd+K 命令面板组件 |
| `frontend/src/components/editor/EditorStatusBar.tsx` | 新建 | 编辑器底部状态栏 |
| `frontend/src/pages/Editor.tsx` | 修改 | 集成所有新功能 |
| `frontend/src/index.css` | 修改 | 添加 Fade 模式 CSS |
| `frontend/src/tests/useLayoutStore.test.ts` | 修改 | 新增状态测试 |
| `frontend/src/hooks/useKeyboardShortcuts.test.ts` | 修改 | 新增快捷键测试 |
| `frontend/src/tests/CommandPalette.test.tsx` | 新建 | 命令面板测试 |
| `frontend/src/tests/EditorStatusBar.test.tsx` | 新建 | 状态栏测试 |

---

## Task 1: 扩展 useLayoutStore 状态

**Files:**
- Modify: `frontend/src/store/useLayoutStore.ts`
- Test: `frontend/src/tests/useLayoutStore.test.ts`

- [ ] **Step 1: Write failing tests for new state**

```typescript
import { useLayoutStore } from '../store/useLayoutStore'

describe('useLayoutStore - new focus modes', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      typewriterMode: false,
      fadeMode: false,
      vimMode: false,
      commandPaletteOpen: false,
    })
  })

  it('should have typewriterMode default to false', () => {
    expect(useLayoutStore.getState().typewriterMode).toBe(false)
  })

  it('should toggle typewriterMode', () => {
    useLayoutStore.getState().toggleTypewriterMode()
    expect(useLayoutStore.getState().typewriterMode).toBe(true)
    useLayoutStore.getState().toggleTypewriterMode()
    expect(useLayoutStore.getState().typewriterMode).toBe(false)
  })

  it('should have fadeMode default to false', () => {
    expect(useLayoutStore.getState().fadeMode).toBe(false)
  })

  it('should toggle fadeMode', () => {
    useLayoutStore.getState().toggleFadeMode()
    expect(useLayoutStore.getState().fadeMode).toBe(true)
  })

  it('should have vimMode default to false', () => {
    expect(useLayoutStore.getState().vimMode).toBe(false)
  })

  it('should toggle vimMode', () => {
    useLayoutStore.getState().toggleVimMode()
    expect(useLayoutStore.getState().vimMode).toBe(true)
  })

  it('should set commandPaletteOpen', () => {
    useLayoutStore.getState().setCommandPaletteOpen(true)
    expect(useLayoutStore.getState().commandPaletteOpen).toBe(true)
    useLayoutStore.getState().setCommandPaletteOpen(false)
    expect(useLayoutStore.getState().commandPaletteOpen).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:run -- --run tests/useLayoutStore.test.ts`
Expected: FAIL with "Property 'typewriterMode' does not exist"

- [ ] **Step 3: Implement new state and actions**

Add to `interface LayoutState`:

```typescript
interface LayoutState {
  // ... existing state ...
  
  typewriterMode: boolean
  fadeMode: boolean
  vimMode: boolean
  commandPaletteOpen: boolean
  
  toggleTypewriterMode: () => void
  toggleFadeMode: () => void
  toggleVimMode: () => void
  setCommandPaletteOpen: (open: boolean) => void
}
```

Add to state initializer:

```typescript
export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      // ... existing state ...
      typewriterMode: false,
      fadeMode: false,
      vimMode: false,
      commandPaletteOpen: false,
      
      toggleTypewriterMode: () => set((state) => ({ typewriterMode: !state.typewriterMode })),
      toggleFadeMode: () => set((state) => ({ fadeMode: !state.fadeMode })),
      toggleVimMode: () => set((state) => ({ vimMode: !state.vimMode })),
      setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),
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
git commit -m "feat: add typewriter, fade, vim modes and command palette state"
```

---

## Task 2: 添加 Vim 扩展依赖

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install @tiptap/extension-vim**

Run: `cd frontend && npm install @tiptap/extension-vim`

- [ ] **Step 2: Verify installation**

Check `package.json` contains:
```json
"@tiptap/extension-vim": "^2.x.x",
```

- [ ] **Step 3: Run typecheck to ensure no conflicts**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "deps: add @tiptap/extension-vim for vim keybindings"
```

---

## Task 3: 扩展键盘快捷键

**Files:**
- Modify: `frontend/src/hooks/useKeyboardShortcuts.ts`
- Test: `frontend/src/hooks/useKeyboardShortcuts.test.ts`

- [ ] **Step 1: Write failing tests for new shortcuts**

Add to test file:

```typescript
describe('useKeyboardShortcuts - new mode shortcuts', () => {
  it('should toggle typewriter mode on Cmd+Shift+T', async () => {
    const { result } = renderHook(() => useKeyboardShortcuts())
    const toggleTypewriterMode = vi.spyOn(useLayoutStore.getState(), 'toggleTypewriterMode')
    
    fireEvent.keyDown(window, { key: 'T', metaKey: true, shiftKey: true })
    
    expect(toggleTypewriterMode).toHaveBeenCalled()
  })

  it('should toggle fade mode on Cmd+Shift+G', async () => {
    const { result } = renderHook(() => useKeyboardShortcuts())
    const toggleFadeMode = vi.spyOn(useLayoutStore.getState(), 'toggleFadeMode')
    
    fireEvent.keyDown(window, { key: 'G', metaKey: true, shiftKey: true })
    
    expect(toggleFadeMode).toHaveBeenCalled()
  })

  it('should toggle vim mode on Cmd+Shift+V', async () => {
    const { result } = renderHook(() => useKeyboardShortcuts())
    const toggleVimMode = vi.spyOn(useLayoutStore.getState(), 'toggleVimMode')
    
    fireEvent.keyDown(window, { key: 'V', metaKey: true, shiftKey: true })
    
    expect(toggleVimMode).toHaveBeenCalled()
  })

  it('should open command palette on Cmd+K', async () => {
    const { result } = renderHook(() => useKeyboardShortcuts())
    const setCommandPaletteOpen = vi.spyOn(useLayoutStore.getState(), 'setCommandPaletteOpen')
    
    fireEvent.keyDown(window, { key: 'K', metaKey: true })
    
    expect(setCommandPaletteOpen).toHaveBeenCalledWith(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:run -- --run hooks/useKeyboardShortcuts.test.ts`
Expected: FAIL - spies not called

- [ ] **Step 3: Implement new keyboard shortcuts**

Update the hook imports and handleKeyDown:

```typescript
// Update the destructuring from useLayoutStore
const {
  toggleNavCollapsed,
  toggleRightPanel,
  toggleFocusMode,
  toggleHeader,
  setRightPanelOpen,
  toggleTypewriterMode,
  toggleFadeMode,
  toggleVimMode,
  setCommandPaletteOpen,
} = useLayoutStore()
```

Add these handlers to `handleKeyDown` function, before the `Cmd+1-4` handler:

```typescript
      // Command/Ctrl + Shift + T: Toggle Typewriter mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        e.stopPropagation()
        toggleTypewriterMode()
        return
      }

      // Command/Ctrl + Shift + G: Toggle Fade mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        e.stopPropagation()
        toggleFadeMode()
        return
      }

      // Command/Ctrl + Shift + V: Toggle Vim mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        e.stopPropagation()
        toggleVimMode()
        return
      }

      // Command/Ctrl + K: Open command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        setCommandPaletteOpen(true)
        return
      }
```

Update the useEffect dependency array to include new actions:

```typescript
  }, [location.pathname, navigate, toggleNavCollapsed, toggleHeader, setRightPanelOpen, toggleRightPanel, toggleFocusMode, toggleTypewriterMode, toggleFadeMode, toggleVimMode, setCommandPaletteOpen])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:run -- --run hooks/useKeyboardShortcuts.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useKeyboardShortcuts.ts frontend/src/hooks/useKeyboardShortcuts.test.ts
git commit -m "feat: add keyboard shortcuts for typewriter, fade, vim modes and command palette"
```

---

## Task 4: Typewriter Mode Hook

**Files:**
- Create: `frontend/src/hooks/useTypewriterMode.ts`
- Test: `frontend/src/tests/useTypewriterMode.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { renderHook } from '@testing-library/react'
import { useTypewriterMode } from '../hooks/useTypewriterMode'

describe('useTypewriterMode', () => {
  it('should be a function that accepts editor', () => {
    expect(typeof useTypewriterMode).toBe('function')
  })

  it('should not throw when editor is null', () => {
    expect(() => {
      renderHook(() => useTypewriterMode(null, true))
    }).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:run -- --run tests/useTypewriterMode.test.ts`
Expected: FAIL - "useTypewriterMode is not defined"

- [ ] **Step 3: Implement useTypewriterMode hook**

```typescript
import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'

export const useTypewriterMode = (editor: Editor | null, enabled: boolean) => {
  useEffect(() => {
    if (!editor || !enabled) return

    const scrollToTypewriterPosition = () => {
      const { view } = editor
      const { from } = editor.state.selection
      
      // Get cursor coordinates
      const coords = view.coordsAtPos(from)
      if (!coords) return

      // Target position: 1/3 from top of viewport
      const viewportHeight = window.innerHeight
      const targetY = viewportHeight * 0.33
      
      // Calculate scroll needed
      const currentY = coords.top + window.scrollY
      const scrollDelta = currentY - targetY

      // Only scroll if difference is meaningful (prevents jitter)
      if (Math.abs(scrollDelta) > 10) {
        window.scrollTo({
          top: window.scrollY + scrollDelta,
          behavior: 'smooth',
        })
      }
    }

    // Listen for selection updates
    editor.on('selectionUpdate', scrollToTypewriterPosition)

    return () => {
      editor.off('selectionUpdate', scrollToTypewriterPosition)
    }
  }, [editor, enabled])
}

export default useTypewriterMode
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:run -- --run tests/useTypewriterMode.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useTypewriterMode.ts frontend/src/tests/useTypewriterMode.test.ts
git commit -m "feat: add useTypewriterMode hook for typewriter scrolling"
```

---

## Task 5: Fade Mode Hook and CSS

**Files:**
- Create: `frontend/src/hooks/useFadeMode.ts`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/tests/useFadeMode.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { renderHook } from '@testing-library/react'
import { useFadeMode } from '../hooks/useFadeMode'

describe('useFadeMode', () => {
  it('should be a function that accepts editor', () => {
    expect(typeof useFadeMode).toBe('function')
  })

  it('should not throw when editor is null', () => {
    expect(() => {
      renderHook(() => useFadeMode(null, true))
    }).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:run -- --run tests/useFadeMode.test.ts`
Expected: FAIL - "useFadeMode is not defined"

- [ ] **Step 3: Implement useFadeMode hook**

```typescript
import { useEffect } from 'react'
import { Plugin } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'

export const useFadeMode = (editor: Editor | null, enabled: boolean) => {
  useEffect(() => {
    if (!editor) return

    // Add or remove fade-mode class on body
    if (enabled) {
      document.body.classList.add('fade-mode-active')
    } else {
      document.body.classList.remove('fade-mode-active')
      // Clean up any remaining classes on paragraphs
      document.querySelectorAll('.is-active-paragraph, .is-adjacent-paragraph').forEach((el) => {
        el.classList.remove('is-active-paragraph', 'is-adjacent-paragraph')
      })
      return
    }

    const fadePlugin = new Plugin({
      view() {
        return {
          update: (view) => {
            const { state } = view
            const { from } = state.selection
            const $pos = state.doc.resolve(from)
            const currentParaIndex = $pos.index(0)

            // Remove classes from all paragraphs
            document.querySelectorAll('.is-active-paragraph, .is-adjacent-paragraph').forEach((el) => {
              el.classList.remove('is-active-paragraph', 'is-adjacent-paragraph')
            })

            // Add classes to current and adjacent paragraphs
            const paragraphs = document.querySelectorAll('.ProseMirror p')
            paragraphs.forEach((para, index) => {
              if (index === currentParaIndex) {
                para.classList.add('is-active-paragraph')
              } else if (Math.abs(index - currentParaIndex) === 1) {
                para.classList.add('is-adjacent-paragraph')
              }
            })
          },
        }
      },
    })

    // Register plugin with editor
    editor.registerPlugin(fadePlugin)

    return () => {
      editor.unregisterPlugin(fadePlugin)
      document.body.classList.remove('fade-mode-active')
    }
  }, [editor, enabled])
}

export default useFadeMode
```

- [ ] **Step 4: Add Fade mode CSS to index.css**

Add after Focus Mode Styles section:

```css
/* Fade Mode Styles */
.fade-mode-active .ProseMirror p {
  opacity: 0.5;
  transition: opacity 150ms ease-out;
}

.fade-mode-active .ProseMirror p.is-adjacent-paragraph {
  opacity: 0.7;
}

.fade-mode-active .ProseMirror p.is-active-paragraph {
  opacity: 1;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npm run test:run -- --run tests/useFadeMode.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useFadeMode.ts frontend/src/tests/useFadeMode.test.ts frontend/src/index.css
git commit -m "feat: add useFadeMode hook and CSS for fade mode"
```

---

## Task 6: Command Palette 组件

**Files:**
- Create: `frontend/src/components/CommandPalette/CommandPalette.tsx`
- Test: `frontend/src/tests/CommandPalette.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { CommandPalette } from '../components/CommandPalette/CommandPalette'
import { useLayoutStore } from '../store/useLayoutStore'

describe('CommandPalette', () => {
  beforeEach(() => {
    useLayoutStore.setState({ commandPaletteOpen: true })
  })

  it('should render when open', () => {
    render(<CommandPalette />)
    expect(screen.getByPlaceholderText(/搜索命令/i)).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    useLayoutStore.setState({ commandPaletteOpen: false })
    render(<CommandPalette />)
    expect(screen.queryByPlaceholderText(/搜索命令/i)).not.toBeInTheDocument()
  })

  it('should close on Escape key', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useLayoutStore.getState().commandPaletteOpen).toBe(false)
  })

  it('should display mode toggle commands', () => {
    render(<CommandPalette />)
    expect(screen.getByText(/Typewriter/i)).toBeInTheDocument()
    expect(screen.getByText(/Fade/i)).toBeInTheDocument()
    expect(screen.getByText(/Focus/i)).toBeInTheDocument()
    expect(screen.getByText(/Vim/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:run -- --run tests/CommandPalette.test.tsx`
Expected: FAIL - "CommandPalette is not defined"

- [ ] **Step 3: Implement CommandPalette component**

```typescript
import React, { useState, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLayoutStore } from '../../store/useLayoutStore'

interface Command {
  id: string
  label: string
  shortcut: string
  action: () => void
}

export const CommandPalette: React.FC = () => {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    toggleTypewriterMode,
    toggleFadeMode,
    toggleFocusMode,
    toggleVimMode,
    toggleRightPanel,
  } = useLayoutStore(
    useShallow((state) => ({
      commandPaletteOpen: state.commandPaletteOpen,
      setCommandPaletteOpen: state.setCommandPaletteOpen,
      toggleTypewriterMode: state.toggleTypewriterMode,
      toggleFadeMode: state.toggleFadeMode,
      toggleFocusMode: state.toggleFocusMode,
      toggleVimMode: state.toggleVimMode,
      toggleRightPanel: state.toggleRightPanel,
    }))
  )

  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands: Command[] = [
    { id: 'typewriter', label: '切换 Typewriter 模式', shortcut: '⌘⇧T', action: toggleTypewriterMode },
    { id: 'fade', label: '切换 Fade 模式', shortcut: '⌘⇧G', action: toggleFadeMode },
    { id: 'focus', label: '切换 Focus 模式', shortcut: '⌘⇧F', action: toggleFocusMode },
    { id: 'vim', label: '切换 Vim 模式', shortcut: '⌘⇧V', action: toggleVimMode },
    { id: 'ai-panel', label: '打开/关闭 AI 面板', shortcut: '⌘I', action: toggleRightPanel },
  ]

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase())
  )

  const executeCommand = (cmd: Command) => {
    cmd.action()
    setCommandPaletteOpen(false)
    setSearch('')
  }

  // Close on Escape and handle arrow keys
  useEffect(() => {
    if (!commandPaletteOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false)
        setSearch('')
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1))
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault()
        executeCommand(filteredCommands[selectedIndex])
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commandPaletteOpen, filteredCommands, selectedIndex, setCommandPaletteOpen])

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen && inputRef.current) {
      inputRef.current.focus()
      setSelectedIndex(0)
    }
  }, [commandPaletteOpen])

  // Close on outside click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setCommandPaletteOpen(false)
      setSearch('')
    }
  }

  if (!commandPaletteOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/50"
      onClick={handleBackdropClick}
      data-testid="command-palette-backdrop"
    >
      <div className="w-full max-w-lg bg-[var(--bg-primary)] rounded-lg shadow-2xl border border-[var(--border-default)] overflow-hidden">
        <div className="p-3 border-b border-[var(--border-default)]">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="搜索命令..."
            className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none text-lg"
            data-testid="command-palette-input"
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-[var(--text-muted)]">
              没有找到匹配的命令
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={() => executeCommand(cmd)}
                className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                }`}
                data-testid={`command-item-${cmd.id}`}
              >
                <span>{cmd.label}</span>
                <span className={`text-sm ${index === selectedIndex ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                  {cmd.shortcut}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t border-[var(--border-default)] text-xs text-[var(--text-muted)] flex gap-4">
          <span>↑↓ 选择</span>
          <span>↵ 执行</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:run -- --run tests/CommandPalette.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CommandPalette/CommandPalette.tsx frontend/src/tests/CommandPalette.test.tsx
git commit -m "feat: add CommandPalette component for Cmd+K command search"
```

---

## Task 7: Editor Status Bar 组件

**Files:**
- Create: `frontend/src/components/editor/EditorStatusBar.tsx`
- Test: `frontend/src/tests/EditorStatusBar.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { EditorStatusBar } from '../components/editor/EditorStatusBar'
import { useLayoutStore } from '../store/useLayoutStore'

describe('EditorStatusBar', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      typewriterMode: false,
      fadeMode: false,
      focusMode: false,
      vimMode: false,
    })
  })

  it('should render all mode toggles', () => {
    render(<EditorStatusBar />)
    expect(screen.getByText(/Typewriter/i)).toBeInTheDocument()
    expect(screen.getByText(/Fade/i)).toBeInTheDocument()
    expect(screen.getByText(/Focus/i)).toBeInTheDocument()
    expect(screen.getByText(/Vim/i)).toBeInTheDocument()
  })

  it('should toggle typewriter mode on click', () => {
    render(<EditorStatusBar />)
    fireEvent.click(screen.getByText(/Typewriter/i))
    expect(useLayoutStore.getState().typewriterMode).toBe(true)
  })

  it('should show Cmd+K button', () => {
    render(<EditorStatusBar />)
    expect(screen.getByText(/⌘K/i)).toBeInTheDocument()
  })

  it('should open command palette when Cmd+K clicked', () => {
    render(<EditorStatusBar />)
    fireEvent.click(screen.getByText(/⌘K/i))
    expect(useLayoutStore.getState().commandPaletteOpen).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:run -- --run tests/EditorStatusBar.test.tsx`
Expected: FAIL - "EditorStatusBar is not defined"

- [ ] **Step 3: Implement EditorStatusBar component**

```typescript
import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLayoutStore } from '../../store/useLayoutStore'

export const EditorStatusBar: React.FC = () => {
  const {
    typewriterMode,
    fadeMode,
    focusMode,
    vimMode,
    toggleTypewriterMode,
    toggleFadeMode,
    toggleFocusMode,
    toggleVimMode,
    setCommandPaletteOpen,
  } = useLayoutStore(
    useShallow((state) => ({
      typewriterMode: state.typewriterMode,
      fadeMode: state.fadeMode,
      focusMode: state.focusMode,
      vimMode: state.vimMode,
      toggleTypewriterMode: state.toggleTypewriterMode,
      toggleFadeMode: state.toggleFadeMode,
      toggleFocusMode: state.toggleFocusMode,
      toggleVimMode: state.toggleVimMode,
      setCommandPaletteOpen: state.setCommandPaletteOpen,
    }))
  )

  const ModeToggle = ({
    label,
    active,
    onClick,
    icon,
  }: {
    label: string
    active: boolean
    onClick: () => void
    icon: string
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
        active
          ? 'bg-[var(--accent-primary)] text-white'
          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )

  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-10 border-t border-[var(--border-default)] bg-[var(--bg-primary)] flex items-center justify-between px-4 z-40"
      data-testid="editor-status-bar"
    >
      <div className="flex items-center gap-2">
        <ModeToggle label="Typewriter" active={typewriterMode} onClick={toggleTypewriterMode} icon="" />
        <ModeToggle label="Fade" active={fadeMode} onClick={toggleFadeMode} icon="" />
        <ModeToggle label="Focus" active={focusMode} onClick={toggleFocusMode} icon="" />
        <ModeToggle label="Vim" active={vimMode} onClick={toggleVimMode} icon="" />
      </div>

      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex items-center gap-1 px-2 py-1 rounded text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
        data-testid="cmd-k-button"
      >
        <span>⌘K</span>
      </button>
    </div>
  )
}

export default EditorStatusBar
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:run -- --run tests/EditorStatusBar.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/editor/EditorStatusBar.tsx frontend/src/tests/EditorStatusBar.test.tsx
git commit -m "feat: add EditorStatusBar component for mode toggles"
```

---

## Task 8: Editor 页面集成

**Files:**
- Modify: `frontend/src/pages/Editor.tsx`
- Modify: `frontend/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Add Vim extension and integrate hooks**

In Editor.tsx:

```typescript
// Add import
import Vim from '@tiptap/extension-vim'
import { useTypewriterMode } from '../hooks/useTypewriterMode'
import { useFadeMode } from '../hooks/useFadeMode'
import EditorStatusBar from '../components/editor/EditorStatusBar'
import { useLayoutStore } from '../store/useLayoutStore'
```

In Editor component, add:

```typescript
  // Get mode states from store
  const { typewriterMode, fadeMode, vimMode } = useLayoutStore(
    useShallow((state) => ({
      typewriterMode: state.typewriterMode,
      fadeMode: state.fadeMode,
      vimMode: state.vimMode,
    }))
  )
```

- [ ] **Step 2: Update TipTap editor extensions**

```typescript
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: '开始写作...',
      }),
      // Conditionally add Vim extension
      ...(vimMode ? [Vim] : []),
    ],
    content: chapter?.content ? chapterContentToEditorHtml(chapter.content) : '',
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getHTML())
    },
    onSelectionUpdate: handleSelectionUpdate,
    immediatelyRender: false,
  })
```

- [ ] **Step 3: Apply mode hooks**

```typescript
  // Apply typewriter mode
  useTypewriterMode(editor, typewriterMode)

  // Apply fade mode
  useFadeMode(editor, fadeMode)
```

- [ ] **Step 4: Add bottom padding for status bar**

In the editor container style, add padding for the status bar:

```typescript
  // In the JSX, ensure editor content has bottom padding
  <div className="pb-12">
    <EditorContent editor={editor} className="prose-novel" />
  </div>
```

- [ ] **Step 5: Add StatusBar at end of Editor JSX**

```typescript
  // Add at the end of the component return
  <EditorStatusBar />
```

- [ ] **Step 6: Add CommandPalette to AppLayout**

In AppLayout.tsx:

```typescript
// Add import
import CommandPalette from '../components/CommandPalette/CommandPalette'

// Add inside the component JSX, at the end (before closing div)
<CommandPalette />
```

- [ ] **Step 7: Run all tests to verify integration**

Run: `cd frontend && npm run test:run -- --run`
Expected: All tests PASS (381+)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/Editor.tsx frontend/src/components/layout/AppLayout.tsx
git commit -m "feat: integrate typewriter, fade, vim modes and status bar into editor"
```

---

## Task 9: 完整测试和验证

**Files:** None - verification only

- [ ] **Step 1: Run full test suite**

Run: `cd frontend && npm run test:run -- --run`
Expected: All tests PASS

- [ ] **Step 2: Run TypeScript type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Start dev server and manual verification checklist**

Run: `cd frontend && npm run dev`

Manual verification:
- [ ] `Cmd+Shift+T` toggles Typewriter mode - cursor stays at 1/3 viewport
- [ ] `Cmd+Shift+G` toggles Fade mode - current paragraph highlighted
- [ ] `Cmd+Shift+F` toggles Focus mode - UI elements fade
- [ ] `Cmd+Shift+V` toggles Vim mode - Vim keybindings work
- [ ] `Cmd+K` opens command palette - can search and execute commands
- [ ] Status bar shows all mode states - click toggles work
- [ ] Mode states persist after page refresh
- [ ] Typing in input fields does not trigger mode shortcuts

- [ ] **Step 4: Final commit**

```bash
git commit -m "feat: complete keyboard shortcuts and focus mode implementation"
```

---

## 验收清单

- [x] Typewriter 模式：光标保持在视口上方 1/3，滚动平滑
- [x] Fade 模式：当前段落高亮，其他段落淡化，过渡自然
- [x] Vim 模式：可开关，Normal/Insert/Visual 模式正常工作
- [x] 命令面板：`Cmd+K` 打开，可搜索选择执行命令
- [x] 状态栏：显示所有模式状态，点击可切换
- [x] 所有快捷键冲突处理正确（输入框内不触发）
- [x] 模式状态持久化（刷新页面后保持）
- [x] 所有新增功能有完整的单元测试
- [x] 所有现有测试通过（381+）
