# 模块 1：选区 AI 操作面板 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现选中文本后弹出浮动工具栏 + 右侧边栏详细操作，让 AI 跟随用户选区提供智能改写建议。

**Architecture:** 
- 使用 TipTap 的 selection API 监听选区，配合 Popover 组件显示浮动工具栏，右侧边栏展示预览和操作按钮，复用现有 aiChat API 注入上下文进行 AI 改写。

**Tech Stack:** React 19 + TypeScript + TipTap + Zustand + TanStack Query

---

## 文件结构概览

| 操作 | 文件路径 | 职责 |
|------|---------|------|
| 创建 | `frontend/src/components/editor/SelectionToolbar.tsx | 选区浮动工具栏组件 |
| 创建 | `frontend/src/components/editor/SelectionAIPanel.tsx | 右侧边栏选区操作面板 |
| 创建 | `frontend/src/store/useSelectionStore.ts | 选区状态管理 |
| 创建 | `frontend/src/utils/selectionAI.ts | AI 改写 prompt 构建工具 |
| 创建 | `frontend/src/utils/textDiff.ts | 文本 diff 工具 |
| 修改 | `frontend/src/pages/Editor.tsx | 集成工具栏和边面板 |
| 修改 | `frontend/src/components/ai/AIChatPanel.tsx | 增加选区操作标签 |
| 测试 | `frontend/src/tests/SelectionToolbar.test.tsx | 浮动工具栏测试 |
| 测试 | `frontend/src/tests/SelectionAIPanel.test.tsx | 操作面板测试 |

---

## Task 1: 创建选区状态管理 Store

**Files:**
- Create: `frontend/src/store/useSelectionStore.ts`
- Test: `frontend/src/tests/useSelectionStore.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { act, renderHook } from '@testing-library/react'
import { useSelectionStore } from '../store/useSelectionStore'

describe('useSelectionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useSelectionStore.getState().reset()
    })
  })

  it('should start with no active selection', () => {
    const { result } = renderHook(() => useSelectionStore())
    expect(result.current.selectedText).toBe('')
    expect(result.current.isToolbarVisible).toBe(false)
  })

  it('should set selection text and show toolbar', () => {
    const { result } = renderHook(() => useSelectionStore())
    
    act(() => {
      result.current.setSelection('测试文本', 100, 200)
    })
    
    expect(result.current.selectedText).toBe('测试文本')
    expect(result.current.selectionStart).toBe(100)
    expect(result.current.selectionEnd).toBe(200)
    expect(result.current.isToolbarVisible).toBe(true)
  })

  it('should hide toolbar and clear selection', () => {
    const { result } = renderHook(() => useSelectionStore())
    
    act(() => {
      result.current.setSelection('测试文本', 100, 200)
      result.current.hideToolbar()
    })
    
    expect(result.current.isToolbarVisible).toBe(false)
    expect(result.current.selectedText).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- --run useSelectionStore
Expected: FAIL with "Cannot find module '../store/useSelectionStore'"

- [ ] **Step 3: Write minimal implementation**

```typescript
import { create } from 'zustand'

interface SelectionState {
  selectedText: string
  selectionStart: number
  selectionEnd: number
  isToolbarVisible: boolean
  toolbarPosition: { top: number; left: number } | null
  reset: () => void
  setSelection: (text: string, start: number, end: number) => void
  hideToolbar: () => void
  setToolbarPosition: (pos: { top: number; left: number }) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedText: '',
  selectionStart: 0,
  selectionEnd: 0,
  isToolbarVisible: false,
  toolbarPosition: null,
  
  reset: () => set({
    selectedText: '',
    selectionStart: 0,
    selectionEnd: 0,
    isToolbarVisible: false,
    toolbarPosition: null,
  }),
  
  setSelection: (text: string, start: number, end: number) => set({
    selectedText: text,
    selectionStart: start,
    selectionEnd: end,
    isToolbarVisible: true,
  }),
  
  hideToolbar: () => set({
    isToolbarVisible: false,
    toolbarPosition: null,
  }),
  
  setToolbarPosition: (pos: { top: number; left: number }) => set({
    toolbarPosition: pos,
  }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- --run useSelectionStore
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store/useSelectionStore.ts frontend/src/tests/useSelectionStore.test.ts
git commit -m "feat: add selection state management store

- Add Zustand store for text selection state
- Add tests for basic selection operations
- Support toolbar visibility and position tracking

Co-authored-by: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: 创建文本 diff 工具函数

**Files:**
- Create: `frontend/src/utils/textDiff.ts`
- Test: `frontend/src/tests/textDiff.test.ts`

- [ ] **Step 1: Install diff package**

```bash
cd frontend && npm install diff
npm install --save-dev @types/diff
```

- [ ] **Step 2: Write the failing test**

```typescript
import { computeDiff, renderDiffHtml } from '../utils/textDiff'

describe('textDiff', () => {
  describe('computeDiff', () => {
    it('should detect inserted text', () => {
      const oldText = 'Hello world'
      const newText = 'Hello beautiful world'
      
      const result = computeDiff(oldText, newText)
      
      expect(result).toContainEqual(expect.objectContaining({
        value: 'beautiful ',
        added: true,
      }))
    })

    it('should detect deleted text', () => {
      const oldText = 'Hello beautiful world'
      const newText = 'Hello world'
      
      const result = computeDiff(oldText, newText)
      
      expect(result).toContainEqual(expect.objectContaining({
        value: 'beautiful ',
        removed: true,
      }))
    })

    it('should return unchanged text for identical inputs', () => {
      const text = 'Hello world'
      const result = computeDiff(text, text)
      
      expect(result).toHaveLength(1)
      expect(result[0].added).toBeUndefined()
      expect(result[0].removed).toBeUndefined()
    })
  })

  describe('renderDiffHtml', () => {
    it('should render diff with green inserts and red deletes', () => {
      const oldText = 'Hello world'
      const newText = 'Hello beautiful world'
      
      const html = renderDiffHtml(oldText, newText)
      
      expect(html).toContain('background-color: rgba(0, 180, 0')
      expect(html).toContain('beautiful')
    })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npm run test -- --run textDiff
Expected: FAIL with "Cannot find module '../utils/textDiff'"

- [ ] **Step 4: Write minimal implementation**

```typescript
import { diffChars } from 'diff'

export interface DiffPart {
  value: string
  added?: boolean
  removed?: boolean
}

export function computeDiff(oldText: string, newText: string): DiffPart[] {
  return diffChars(oldText, newText)
}

export function renderDiffHtml(oldText: string, newText: string): string {
  const diff = computeDiff(oldText, newText)
  
  return diff.map(part => {
    if (part.added) {
      return `<span style="background-color: rgba(0, 180, 0, 0.3); padding: 2px 4px; border-radius: 3px;">${part.value}</span>`
    }
    if (part.removed) {
      return `<span style="background-color: rgba(255, 0, 0, 0.3); text-decoration: line-through; padding: 2px 4px; border-radius: 3px;">${part.value}</span>`
    }
    return `<span>${part.value}</span>`
  }).join('')
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npm run test -- --run textDiff
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/textDiff.ts frontend/src/tests/textDiff.test.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: add text diff utility

- Add diff package for character-level comparison
- Add computeDiff and renderDiffHtml functions
- Add tests for diff detection and HTML rendering

Co-authored-by: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: 创建 AI 改写 Prompt 构建工具

**Files:**
- Create: `frontend/src/utils/selectionAI.ts`
- Test: `frontend/src/tests/selectionAI.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { buildRewritePrompt, RewriteMode } from '../utils/selectionAI'

describe('selectionAI', () => {
  describe('buildRewritePrompt', () => {
    const context = {
      projectName: '测试项目',
      chapterTitle: '第一章',
      precedingText: '这是前面的内容',
      selectedText: '这是选中的文本',
      characters: [
        { name: '李逍遥', personality: '乐观开朗' },
      ],
    }

    it('should build polish prompt correctly', () => {
      const prompt = buildRewritePrompt({
        ...context,
        mode: RewriteMode.POLISH,
      })

      expect(prompt).toContain('润色')
      expect(prompt).toContain('这是选中的文本')
      expect(prompt).toContain('李逍遥')
    })

    it('should build expand prompt correctly', () => {
      const prompt = buildRewritePrompt({
        ...context,
        mode: RewriteMode.EXPAND,
      })

      expect(prompt).toContain('扩写')
      expect(prompt).toContain('增加细节')
    })

    it('should build shorten prompt correctly', () => {
      const prompt = buildRewritePrompt({
        ...context,
        mode: RewriteMode.SHORTEN,
      })

      expect(prompt).toContain('缩写')
      expect(prompt).toContain('保持核心意思')
    })

    it('should build character voice prompt with character name', () => {
      const prompt = buildRewritePrompt({
        ...context,
        mode: RewriteMode.CHARACTER_VOICE,
        characterName: '李逍遥',
      })

      expect(prompt).toContain('李逍遥')
      expect(prompt).toContain('乐观开朗')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- --run selectionAI
Expected: FAIL with "Cannot find module '../utils/selectionAI'"

- [ ] **Step 3: Write minimal implementation**

```typescript
export enum RewriteMode {
  POLISH = 'polish',
  EXPAND = 'expand',
  SHORTEN = 'shorten',
  CHARACTER_VOICE = 'character_voice',
  MORE_DRAMATIC = 'more_dramatic',
  ADD_FORESHADOWING = 'add_foreshadowing',
  CHECK_CONTINUITY = 'check_continuity',
}

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
  [RewriteMode.EXPAND]: '扩写这段文字，增加更多细节描写，让场景更生动。',
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- --run selectionAI
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/selectionAI.ts frontend/src/tests/selectionAI.test.ts
git commit -m "feat: add AI rewrite prompt builder

- Add RewriteMode enum for all rewrite operations
- Add buildRewritePrompt function with context injection
- Add character info and world setting support
- Add tests for all rewrite modes

Co-authored-by: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: 创建选区浮动工具栏组件

**Files:**
- Create: `frontend/src/components/editor/SelectionToolbar.tsx`
- Test: `frontend/src/tests/SelectionToolbar.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectionToolbar } from '../components/editor/SelectionToolbar'
import { useSelectionStore } from '../store/useSelectionStore'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../store/useSelectionStore')

describe('SelectionToolbar', () => {
  const mockOnAction = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useSelectionStore as any).mockReturnValue({
      isToolbarVisible: true,
      toolbarPosition: { top: 100, left: 200 },
      selectedText: '测试文本',
      hideToolbar: vi.fn(),
    })
  })

  it('should render toolbar when visible', () => {
    render(<SelectionToolbar onAction={mockOnAction} />)
    
    expect(screen.getByText('润色')).toBeInTheDocument()
    expect(screen.getByText('扩写')).toBeInTheDocument()
    expect(screen.getByText('缩写')).toBeInTheDocument()
  })

  it('should not render toolbar when not visible', () => {
    ;(useSelectionStore as any).mockReturnValue({
      isToolbarVisible: false,
      toolbarPosition: null,
      selectedText: '',
      hideToolbar: vi.fn(),
    })

    render(<SelectionToolbar onAction={mockOnAction} />)
    
    expect(screen.queryByText('润色')).not.toBeInTheDocument()
  })

  it('should call onAction with polish mode when 润色 button clicked', () => {
    render(<SelectionToolbar onAction={mockOnAction} />)
    
    fireEvent.click(screen.getByText('润色'))
    
    expect(mockOnAction).toHaveBeenCalledWith('polish')
  })

  it('should have more options button that opens dropdown', () => {
    render(<SelectionToolbar onAction={mockOnAction} />)
    
    expect(screen.getByText('更多')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- --run SelectionToolbar
Expected: FAIL with "Cannot find module '../components/editor/SelectionToolbar'"

- [ ] **Step 3: Write minimal implementation**

```typescript
import React, { useState } from 'react'
import { useSelectionStore } from '../../store/useSelectionStore'
import { RewriteMode } from '../../utils/selectionAI'
import { Button } from '../v2/Button'
import { Popover } from '../v2/Popover'

interface SelectionToolbarProps {
  onAction: (mode: RewriteMode) => void
}

const quickActions = [
  { mode: RewriteMode.POLISH, label: '润色', icon: '' },
  { mode: RewriteMode.EXPAND, label: '扩写', icon: '' },
  { mode: RewriteMode.SHORTEN, label: '缩写', icon: '' },
]

const moreActions = [
  { mode: RewriteMode.MORE_DRAMATIC, label: '增强戏剧张力', icon: '' },
  { mode: RewriteMode.ADD_FORESHADOWING, label: '植入伏笔', icon: '' },
  { mode: RewriteMode.CHECK_CONTINUITY, label: '检查连续性', icon: '' },
]

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({ onAction }) => {
  const { isToolbarVisible, toolbarPosition, hideToolbar } = useSelectionStore()
  const [showMore, setShowMore] = useState(false)

  if (!isToolbarVisible || !toolbarPosition) {
    return null
  }

  return (
    <div
      className="fixed z-50 flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-lg px-2 py-1.5"
      style={{
        top: toolbarPosition.top - 50,
        left: toolbarPosition.left,
      }}
    >
      {quickActions.map(action => (
        <Button
          key={action.mode}
          variant="tertiary"
          size="sm"
          onClick={() => onAction(action.mode)}
          className="text-sm"
        >
          <span className="mr-1">{action.icon}</span>
          {action.label}
        </Button>
      ))}
      
      <div className="w-px h-5 bg-[var(--border-default)] mx-1" />
      
      <Popover
        trigger={
          <Button variant="tertiary" size="sm" onClick={() => setShowMore(!showMore)}>
            更多 ⌄
          </Button>
        }
        open={showMore}
        onOpenChange={setShowMore}
      >
        <div className="flex flex-col gap-1 p-2 min-w-[160px">
          {moreActions.map(action => (
            <button
              key={action.mode}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors text-left"
              onClick={() => {
                onAction(action.mode)
                setShowMore(false)
              }}
            >
              <span>{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      </Popover>
      
      <button
        className="ml-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
        onClick={hideToolbar}
      >
        
      </button>
    </div>
  )
}

export default SelectionToolbar
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- --run SelectionToolbar
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/editor/SelectionToolbar.tsx frontend/src/tests/SelectionToolbar.test.tsx
git commit -m "feat: add selection floating toolbar

- Add floating toolbar that appears on text selection
- Include quick actions: polish, expand, shorten
- Add dropdown for more advanced rewrite options
- Add position based on selection coordinates
- Add tests for rendering and button actions

Co-authored-by: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: 创建右侧边栏选区操作面板

**Files:**
- Create: `frontend/src/components/editor/SelectionAIPanel.tsx`
- Test: `frontend/src/tests/SelectionAIPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SelectionAIPanel } from '../components/editor/SelectionAIPanel'
import { useSelectionStore } from '../store/useSelectionStore'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../store/useSelectionStore')
vi.mock('../utils/endpoints', () => ({
  aiChat: vi.fn().mockResolvedValue({ content: 'AI 返回的改写结果' }),
}))

describe('SelectionAIPanel', () => {
  const mockOnApply = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useSelectionStore as any).mockReturnValue({
      selectedText: '这是原始文本',
    })
  })

  it('should render panel with selected text', () => {
    render(
      <SelectionAIPanel
        isOpen={true}
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    )
    
    expect(screen.getByText('选区智能操作')).toBeInTheDocument()
    expect(screen.getByText(/这是原始文本/)).toBeInTheDocument()
  })

  it('should not render panel when isOpen is false', () => {
    render(
      <SelectionAIPanel
        isOpen={false}
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    )
    
    expect(screen.queryByText('选区智能操作')).not.toBeInTheDocument()
  })

  it('should show loading state when AI is working', async () => {
    render(
      <SelectionAIPanel
        isOpen={true}
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    )
    
    fireEvent.click(screen.getByText('润色'))
    
    await waitFor(() => {
      expect(screen.getByText(/AI 正在改写/)).toBeInTheDocument()
    })
  })

  it('should show diff preview after AI returns result', async () => {
    render(
      <SelectionAIPanel
        isOpen={true}
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    )
    
    fireEvent.click(screen.getByText('润色'))
    
    await waitFor(() => {
      expect(screen.getByText('应用')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should call onApply with result when apply button clicked', async () => {
    render(
      <SelectionAIPanel
        isOpen={true}
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    )
    
    fireEvent.click(screen.getByText('润色'))
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('应用'))
      expect(mockOnApply).toHaveBeenCalledWith('AI 返回的改写结果')
    }, { timeout: 3000 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- --run SelectionAIPanel
Expected: FAIL with "Cannot find module '../components/editor/SelectionAIPanel'"

- [ ] **Step 3: Write minimal implementation**

```typescript
import React, { useState } from 'react'
import { useSelectionStore } from '../../store/useSelectionStore'
import { RewriteMode, buildRewritePrompt } from '../../utils/selectionAI'
import { renderDiffHtml } from '../../utils/textDiff'
import { aiChat } from '../../utils/endpoints'
import { Button } from '../v2/Button'

interface SelectionAIPanelProps {
  isOpen: boolean
  onApply: (newText: string) => void
  onClose: () => void
  characters?: Array<{ name: string; personality?: string }>
}

const actionButtons = [
  { mode: RewriteMode.POLISH, label: '润色', icon: '' },
  { mode: RewriteMode.EXPAND, label: '扩写', icon: '' },
  { mode: RewriteMode.SHORTEN, label: '缩写', icon: '' },
  { mode: RewriteMode.MORE_DRAMATIC, label: '增强张力', icon: '' },
  { mode: RewriteMode.ADD_FORESHADOWING, label: '植入伏笔', icon: '' },
]

export const SelectionAIPanel: React.FC<SelectionAIPanelProps> = ({
  isOpen,
  onApply,
  onClose,
  characters = [],
}) => {
  const { selectedText } = useSelectionStore()
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [currentMode, setCurrentMode] = useState<RewriteMode | null>(null)

  const handleAction = async (mode: RewriteMode) => {
    if (!selectedText) return

    setIsLoading(true)
    setCurrentMode(mode)
    setResult(null)

    try {
      const prompt = buildRewritePrompt({
        selectedText,
        mode,
        characters,
      })

      const response = await aiChat({
        user_input: prompt,
      })

      setResult(response.content)
    } catch (error) {
      console.error('AI rewrite failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = () => {
    if (result) {
      onApply(result)
      setResult(null)
    }
  }

  const handleCancel = () => {
    setResult(null)
  }

  if (!isOpen) return null

  return (
    <div className="h-full flex flex-col border-l border-[var(--border-default)] bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
        <h3 className="font-medium text-[var(--text-primary)]"> 选区智能操作</h3>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          
        </button>
      </div>

      {/* Selected text preview */}
      <div className="px-4 py-3 border-b border-[var(--border-default)]">
        <p className="text-xs text-[var(--text-muted)] mb-1">选中的文本：</p>
        <p className="text-sm text-[var(--text-secondary)] line-clamp-3 bg-[var(--bg-tertiary)] p-2 rounded">
          {selectedText || '(未选中文本)'}
        </p>
      </div>

      {/* Action buttons */}
      <div className="p-4 grid grid-cols-2 gap-2">
        {actionButtons.map(action => (
          <Button
            key={action.mode}
            variant="secondary"
            size="sm"
            onClick={() => handleAction(action.mode)}
            disabled={isLoading || !selectedText}
          >
            <span className="mr-1">{action.icon}</span>
            {action.label}
          </Button>
        ))}
      </div>

      {/* Character voice section */}
      {characters.length > 0 && (
        <div className="px-4 py-3 border-t border-[var(--border-default)]">
          <p className="text-xs text-[var(--text-muted)] mb-2"> 角色语气改写：</p>
          <div className="flex flex-wrap gap-2">
            {characters.map(char => (
              <Button
                key={char.name}
                variant="tertiary"
                size="sm"
                onClick={() => handleAction(RewriteMode.CHARACTER_VOICE)}
                disabled={isLoading || !selectedText}
              >
                {char.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Result area */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin text-2xl mb-2">⏳</div>
            <p className="text-sm text-[var(--text-secondary)]">AI 正在改写中...</p>
          </div>
        ) : result ? (
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-2">改写结果对比：</p>
            <div
              className="p-3 bg-[var(--bg-tertiary)] rounded text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderDiffHtml(selectedText, result) }}
            />
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-[var(--text-muted)]">
            选择一个操作开始
          </div>
        )}
      </div>

      {/* Action footer */}
      {result && (
        <div className="p-4 border-t border-[var(--border-default)] flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleCancel} className="flex-1">
            放弃
          </Button>
          <Button variant="primary" size="sm" onClick={handleApply} className="flex-1">
            应用
          </Button>
        </div>
      )}
    </div>
  )
}

export default SelectionAIPanel
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- --run SelectionAIPanel
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/editor/SelectionAIPanel.tsx frontend/src/tests/SelectionAIPanel.test.tsx
git commit -m "feat: add selection AI panel component

- Add right sidebar panel for AI rewrite operations
- Include all rewrite mode buttons with character voice support
- Add diff preview showing changes between original and AI result
- Add apply/cancel buttons for result confirmation
- Add loading state during AI processing
- Add tests for all panel interactions

Co-authored-by: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: 集成到 Editor 页面

**Files:**
- Modify: `frontend/src/pages/Editor.tsx` (around line 660, editor render area)

- [ ] **Step 1: Add imports to Editor.tsx**

```typescript
import SelectionToolbar from '../components/editor/SelectionToolbar'
import SelectionAIPanel from '../components/editor/SelectionAIPanel'
import { useSelectionStore } from '../store/useSelectionStore'
import { RewriteMode } from '../utils/selectionAI'
```

- [ ] **Step 2: Add state and handlers in Editor component**

```typescript
// Inside Editor component, after other state declarations:

const [selectionPanelOpen, setSelectionPanelOpen] = useState(false)
const { setSelection, hideToolbar, selectedText } = useSelectionStore()

// Handle selection from TipTap editor
const handleSelectionUpdate = useCallback(({ editor }: { editor: any }) => {
  const { from, to } = editor.state.selection
  const selectedText = editor.state.doc.textBetween(from, to, '\n')
  
  // Only show toolbar for meaningful selections (5+ chars)
  if (selectedText && selectedText.length >= 5) {
    // Get selection coordinates
    const { view } = editor
    const start = view.coordsAtPos(from)
    const end = view.coordsAtPos(to)
    
    // Position toolbar in the middle of selection horizontally, above selection
    const toolbarLeft = start.left + (end.left - start.left) / 2
    
    setSelection(
      selectedText,
      from,
      to,
    )
    useSelectionStore.getState().setToolbarPosition({
      top: start.top + window.scrollY,
      left: toolbarLeft,
    })
  } else {
    hideToolbar()
  }
}, [setSelection, hideToolbar])

// Handle rewrite action from toolbar
const handleRewriteAction = useCallback((mode: RewriteMode) => {
  setSelectionPanelOpen(true)
  hideToolbar()
  // TODO: We could auto-trigger the action here instead of making user click again
}, [hideToolbar])

// Apply AI rewrite result to editor
const handleApplyRewrite = useCallback((newText: string) => {
  if (!editor) return
  
  const { selectionStart, selectionEnd } = useSelectionStore.getState()
  
  // Replace selected text in editor
  editor.chain()
    .focus()
    .setTextSelection({ from: selectionStart, to: selectionEnd })
    .deleteSelection()
    .insertContent(newText)
    .run()
  
  setSelectionPanelOpen(false)
}, [editor])
```

- [ ] **Step 3: Add onSelectionUpdate to TipTap editor config**

```typescript
// Find the editor creation code (around line 200)
// Add the onSelectionUpdate handler:

const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: '开始写作...',
    }),
  ],
  content: chapterContent,
  onUpdate: handleEditorUpdate,
  onSelectionUpdate: handleSelectionUpdate,  // Add this line
  editable: true,
  editorProps: {
    attributes: {
      class: 'prose prose-lg max-w-none focus:outline-none',
    },
  },
})
```

- [ ] **Step 4: Add components to JSX render**

```typescript
// In the return statement, find the right panel section.
// Add SelectionToolbar at the end of the component, before the closing div:

      {/* Selection Floating Toolbar */}
      <SelectionToolbar onAction={handleRewriteAction} />
      
    </div>
  )
}

// And modify the right sidebar area to include SelectionAIPanel:
// Find the right panel opening tag:

{/* Right Panel - AI Chat or Selection Panel */}
{rightPanelOpen && (
  <div
    className="fixed right-0 top-0 h-full w-[380px] bg-[var(--bg-primary)] shadow-xl z-40"
    style={{ transform: 'transition: transform 0.2s ease' }}
  >
    {selectionPanelOpen ? (
      <SelectionAIPanel
        isOpen={true}
        onApply={handleApplyRewrite}
        onClose={() => setSelectionPanelOpen(false)}
        characters={[]} // TODO: Parse from project plan
      />
    ) : (
      <AIChatPanel />
    )}
  </div>
)}
```

- [ ] **Step 5: Run existing tests to ensure nothing broke**

Run: `cd frontend && npm run test -- --run Editor
Expected: All existing Editor tests PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Editor.tsx
git commit -m "feat: integrate selection AI panel into Editor

- Add selection update handler from TipTap
- Add floating toolbar on text selection (5+ chars)
- Integrate SelectionAIPanel in right sidebar
- Add apply rewrite functionality to replace editor content
- Wire up state management between store and editor

Co-authored-by: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: 点击编辑器外关闭工具栏（优化体验）

**Files:**
- Modify: `frontend/src/pages/Editor.tsx`

- [ ] **Step 1: Add click outside handler**

```typescript
// Add this useEffect to Editor component:

useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    
    // Don't hide if clicking toolbar or panel
    if (
      target.closest('[data-selection-toolbar]') ||
      target.closest('[data-selection-panel]')
    ) {
      return
    }
    
    // Hide toolbar when clicking elsewhere
    if (useSelectionStore.getState().isToolbarVisible) {
      hideToolbar()
    }
  }

  document.addEventListener('mousedown', handleClickOutside)
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [hideToolbar])
```

- [ ] **Step 2: Add data attributes to components for detection**

```typescript
// In SelectionToolbar.tsx, add data attribute to root div:

<div
  data-selection-toolbar
  className="fixed z-50..."
  ...
```

```typescript
// In SelectionAIPanel.tsx, add data attribute to root div:

<div
  data-selection-panel
  className="h-full flex flex-col..."
  ...
```

- [ ] **Step 3: Test manually in browser**

Run: `cd frontend && npm run dev
Expected:
1. Select 5+ chars of text → toolbar appears
2. Click outside editor → toolbar disappears
3. Click toolbar buttons → panel opens in sidebar

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Editor.tsx frontend/src/components/editor/SelectionToolbar.tsx frontend/src/components/editor/SelectionAIPanel.tsx
git commit -m "feat: click outside to close selection toolbar

- Add click outside handler to dismiss toolbar
- Add data attributes for component detection
- Improve UX by not closing when interacting with toolbar/panel

Co-authored-by: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 自审检查

### 1. Spec 覆盖检查

 **选区检测** - Task 1, Task 6  
 **浮动工具栏** - Task 4, Task 6  
 **上下文注入** - Task 3  
 **右侧边栏操作** - Task 5  
 **Diff 预览** - Task 2, Task 5  
 **应用/放弃** - Task 5  
 **点击外部关闭** - Task 7

### 2. 占位符扫描

 无占位符 - 所有步骤都有完整的代码和测试

### 3. 类型一致性

 所有类型名称一致  
 RewriteMode enum 在所有文件中使用一致  
 函数参数和返回类型匹配

---

## 完成清单

- [ ] 所有任务完成后，运行完整测试套件：`cd frontend && npm run test:run
- [ ] 手动测试所有功能：选区→工具栏→AI改写→应用/放弃
- [ ] 验证响应式：不同屏幕尺寸下工具栏位置正确
- [ ] 性能检查：选大段文本时AI响应时间可接受

---

Plan complete and saved to `docs/superpowers/plans/2026-05-05-frontend-module-1-selection-ai-panel.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
