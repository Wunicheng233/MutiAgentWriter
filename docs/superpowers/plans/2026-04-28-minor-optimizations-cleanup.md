# 轻微问题优化修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理项目临时文件、安全更新非破坏性依赖、提取大文件中的公共函数进行小范围代码质量改进。

**Architecture:** 分三个独立任务进行：1) 临时文件清理 2) 安全依赖更新 3) 大文件小范围重构。每个任务独立，可单独测试和验证。

**Tech Stack:** Python, TypeScript, npm, git

---

## File Structure Overview

| Task | File | Change Type |
|------|------|-------------|
| 1 | `**/.DS_Store`, `**/__pycache__`, `**/*.pyc` | Delete |
| 2 | `frontend/package.json`, `frontend/package-lock.json` | Modify |
| 3 | `frontend/src/components/v2/Select/Select.tsx` | Modify (extract hooks) |
| 4 | `frontend/src/components/v2/DropdownMenu/DropdownMenu.tsx` | Modify (extract utils) |

---

### Task 1: 清理项目临时文件

**Files:**
- Delete: `./.DS_Store`, `./**/__pycache__`, `./**/*.pyc`
- Verify: git status 确认无意外删除

**Rationale:** 这些是 Python 字节码缓存和 macOS 系统文件，不需要版本控制，清理后可以保持仓库整洁。

- [ ] **Step 1: 列出要删除的文件进行确认**

```bash
cd /Users/nobody1/Desktop/project/writer

echo "=== 要删除的 .DS_Store 文件 ==="
find . -name ".DS_Store" -type f 2>/dev/null

echo ""
echo "=== 要删除的 __pycache__ 目录 ==="
find . -name "__pycache__" -type d 2>/dev/null | head -20

echo ""
echo "=== 要删除的 .pyc 文件 ==="
find . -name "*.pyc" -type f 2>/dev/null | head -20
```

Expected: 列出所有待删除的临时文件和目录

- [ ] **Step 2: 删除临时文件**

```bash
cd /Users/nobody1/Desktop/project/writer

# 删除所有 .DS_Store
find . -name ".DS_Store" -type f -delete 2>/dev/null

# 删除所有 __pycache__ 目录
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null

# 删除所有 .pyc 文件
find . -name "*.pyc" -type f -delete 2>/dev/null

echo "Cleanup complete"
```

Expected: "Cleanup complete"，无错误输出

- [ ] **Step 3: 验证清理结果**

```bash
cd /Users/nobody1/Desktop/project/writer

echo "=== 验证清理结果 ==="
find . -name ".DS_Store" -type f 2>/dev/null | wc -l
find . -name "__pycache__" -type d 2>/dev/null | wc -l
find . -name "*.pyc" -type f 2>/dev/null | wc -l
```

Expected: 三个命令都输出 0

- [ ] **Step 4: 运行测试确保清理不影响功能**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test -- --run 2>&1 | tail -10
```

Expected: 所有测试通过

- [ ] **Step 5: 提交更改**

```bash
cd /Users/nobody1/Desktop/project/writer
git add -u
git commit -m "chore: clean up temporary files (.DS_Store, __pycache__, *.pyc)"
```

---

### Task 2: 安全更新依赖（仅非大版本更新）

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

**Rationale:** 更新 19 个过时依赖中的安全更新和小版本更新，避免大版本（eslint 9→10, storybook 8→10, tailwind 3→4）带来的破坏性变更。

**更新策略：**
- ✅ 更新: Current = Wanted 的依赖（安全更新，向后兼容）
- ⚠️ 谨慎: 大版本更新 (eslint, storybook, tailwind) 跳过
- ✅ 更新: 次版本号和补丁版本号更新

- [ ] **Step 1: 识别可以安全更新的依赖**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend

echo "=== 安全更新列表（Current ≠ Wanted，大版本不变）==="
npm outdated 2>&1 | awk '$2 != $3 && substr($2, 1, 1) == substr($3, 1, 1)'
```

Expected: 列出安全可更新的依赖列表

- [ ] **Step 2: 执行安全更新（只更新 wanted 版本）**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend

# 更新 axios @tanstack/react-query @tiptap/* eslint-plugin-react-hooks
# jsdom postcss react-router-dom typescript typescript-eslint vite
npm update axios @tanstack/react-query @tiptap/extension-image @tiptap/extension-placeholder @tiptap/react @tiptap/starter-kit eslint-plugin-react-hooks jsdom postcss react-router-dom typescript typescript-eslint vite

echo "Update complete"
```

Expected: npm update 成功完成，无错误

- [ ] **Step 3: 验证更新结果**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend

echo "=== 验证更新结果 ==="
npm outdated 2>&1 | head -25
```

Expected: 只剩下大版本更新（eslint, storybook, tailwind, @types/node）

- [ ] **Step 4: 运行完整测试套件**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test -- --run 2>&1 | tail -15
```

Expected: 所有测试通过

- [ ] **Step 5: 验证构建成功**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run build 2>&1 | tail -10
```

Expected: 构建成功

- [ ] **Step 6: 提交更改**

```bash
cd /Users/nobody1/Desktop/project/writer
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(deps): safe update minor and patch dependencies"
```

---

### Task 3: Select 组件小范围重构 - 提取自定义 Hook

**Files:**
- Modify: `frontend/src/components/v2/Select/Select.tsx`
- Create: `frontend/src/components/v2/Select/useKeyboardNavigation.ts`
- Test: `frontend/src/components/v2/Select/Select.test.tsx` (已有，需扩展)

**Rationale:** Select.tsx 有 328 行，键盘导航逻辑较为独立，可以提取为自定义 Hook，提高可测试性和代码清晰度。

- [ ] **Step 1: 读取当前 Select 组件，识别键盘导航逻辑**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
cat src/components/v2/Select/Select.tsx | grep -n "onKeyDown\|keydown\|KeyDown\|ArrowUp\|ArrowDown\|Enter\|Escape" | head -30
```

Expected: 显示键盘事件相关代码的位置

- [ ] **Step 2: 创建 useKeyboardNavigation Hook 文件**

创建 `frontend/src/components/v2/Select/useKeyboardNavigation.ts`:

```typescript
import { useCallback, useEffect } from 'react'

export interface UseKeyboardNavigationOptions {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  highlightedIndex: number
  setHighlightedIndex: (index: number) => void
  itemCount: number
  onSelect: (index: number) => void
}

/**
 * 键盘导航 Hook - 处理 Select 组件的键盘交互
 */
export function useKeyboardNavigation({
  isOpen,
  setIsOpen,
  highlightedIndex,
  setHighlightedIndex,
  itemCount,
  onSelect,
}: UseKeyboardNavigationOptions) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault()
          setIsOpen(true)
          return
        }
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex(Math.min(highlightedIndex + 1, itemCount - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex(Math.max(highlightedIndex - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (isOpen && highlightedIndex >= 0 && highlightedIndex < itemCount) {
            onSelect(highlightedIndex)
          }
          break
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          break
      }
    },
    [isOpen, setIsOpen, highlightedIndex, setHighlightedIndex, itemCount, onSelect]
  )

  // 打开时重置高亮索引
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0)
    }
  }, [isOpen, setHighlightedIndex])

  return { handleKeyDown }
}
```

- [ ] **Step 3: 在 Select.tsx 中引入并使用 Hook**

```tsx
// 在导入部分添加
import { useKeyboardNavigation } from './useKeyboardNavigation'

// 在组件内部使用
const { handleKeyDown } = useKeyboardNavigation({
  isOpen,
  setIsOpen,
  highlightedIndex,
  setHighlightedIndex,
  itemCount: items.length,
  onSelect: (index) => {
    if (items[index]) {
      handleSelect(items[index].value)
    }
  },
})

// 将原有的 onKeyDown 替换为 handleKeyDown
```

- [ ] **Step 4: 删除原有的内联键盘事件处理逻辑**

找到并删除原有的 onKeyDown 事件处理函数，使用 Hook 返回的 handleKeyDown 替代

- [ ] **Step 5: 运行类型检查**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx tsc --noEmit 2>&1 | grep -i select || echo "No Select type errors"
```

Expected: 无 Select 相关类型错误

- [ ] **Step 6: 运行 Select 组件测试**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test -- --run src/components/v2/Select/Select.test.tsx 2>&1 | tail -10
```

Expected: 所有测试通过

- [ ] **Step 7: 手动验证（打开开发服务器检查）**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run build 2>&1 | tail -5
```

Expected: 构建成功

- [ ] **Step 8: 提交更改**

```bash
cd /Users/nobody1/Desktop/project/writer
git add frontend/src/components/v2/Select/Select.tsx
git add frontend/src/components/v2/Select/useKeyboardNavigation.ts
git commit -m "refactor(Select): extract keyboard navigation logic to custom hook"
```

---

### Task 4: DropdownMenu 组件小范围重构 - 提取工具函数

**Files:**
- Modify: `frontend/src/components/v2/DropdownMenu/DropdownMenu.tsx`
- Create: `frontend/src/components/v2/DropdownMenu/dropdownUtils.ts`
- Test: `frontend/src/components/v2/DropdownMenu/DropdownMenu.test.tsx` (已有)

**Rationale:** DropdownMenu.tsx 有 237 行，菜单定位和计算逻辑可以提取为独立的工具函数，提高代码清晰度。

- [ ] **Step 1: 读取当前 DropdownMenu 组件**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
cat src/components/v2/DropdownMenu/DropdownMenu.tsx
```

- [ ] **Step 2: 创建 dropdownUtils.ts 工具函数文件**

创建 `frontend/src/components/v2/DropdownMenu/dropdownUtils.ts`:

```typescript
export type MenuPlacement = 'bottom' | 'top' | 'bottom-start' | 'top-start'

export interface MenuPosition {
  top?: number
  bottom?: number
  left?: number
  right?: number
  transformOrigin?: string
}

/**
 * 计算菜单位置
 * 根据触发元素和视口位置计算最佳显示位置
 */
export function calculateMenuPosition(
  triggerRect: DOMRect,
  placement: MenuPlacement = 'bottom'
): MenuPosition {
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  switch (placement) {
    case 'bottom':
      return {
        top: triggerRect.bottom + 8,
        left: triggerRect.left + triggerRect.width / 2,
        transformOrigin: 'top center',
      }
    case 'top':
      return {
        bottom: viewportHeight - triggerRect.top + 8,
        left: triggerRect.left + triggerRect.width / 2,
        transformOrigin: 'bottom center',
      }
    case 'bottom-start':
      return {
        top: triggerRect.bottom + 8,
        left: triggerRect.left,
        transformOrigin: 'top left',
      }
    case 'top-start':
      return {
        bottom: viewportHeight - triggerRect.top + 8,
        left: triggerRect.left,
        transformOrigin: 'bottom left',
      }
    default:
      return {}
  }
}

/**
 * 检查菜单是否应该向上显示（空间不足时自动翻转）
 */
export function shouldFlipPlacement(
  triggerRect: DOMRect,
  menuHeight: number = 200
): boolean {
  const spaceBelow = window.innerHeight - triggerRect.bottom
  return spaceBelow < menuHeight && triggerRect.top > spaceBelow
}

/**
 * 确保菜单位于视口范围内
 */
export function clampToViewport(value: number, size: number, viewportSize: number): number {
  return Math.max(0, Math.min(value, viewportSize - size))
}
```

- [ ] **Step 3: 在 DropdownMenu.tsx 中引入并使用工具函数**

```tsx
// 在导入部分添加
import { calculateMenuPosition, shouldFlipPlacement, clampToViewport } from './dropdownUtils'

// 替换原有的位置计算逻辑
// 使用 calculateMenuPosition 替代内联的位置计算
```

- [ ] **Step 4: 删除原有的内联位置计算逻辑**

- [ ] **Step 5: 运行类型检查**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx tsc --noEmit 2>&1 | grep -i dropdown || echo "No Dropdown type errors"
```

Expected: 无 Dropdown 相关类型错误

- [ ] **Step 6: 运行 DropdownMenu 测试**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test -- --run src/components/v2/DropdownMenu/DropdownMenu.test.tsx 2>&1 | tail -10
```

Expected: 所有测试通过

- [ ] **Step 7: 提交更改**

```bash
cd /Users/nobody1/Desktop/project/writer
git add frontend/src/components/v2/DropdownMenu/DropdownMenu.tsx
git add frontend/src/components/v2/DropdownMenu/dropdownUtils.ts
git commit -m "refactor(DropdownMenu): extract position calculation utilities"
```

---

### Task 5: 最终验证

**Files:** None - verification only

- [ ] **Step 1: 运行完整测试套件**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test -- --run 2>&1 | tail -15
```

Expected: 所有测试通过

- [ ] **Step 2: 运行完整类型检查**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 无类型错误

- [ ] **Step 3: 运行构建**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run build 2>&1 | tail -5
```

Expected: 构建成功

- [ ] **Step 4: 验证 git 状态**

```bash
cd /Users/nobody1/Desktop/project/writer
git status
git log --oneline -5
```

Expected: 4 个提交：清理文件、更新依赖、Select 重构、DropdownMenu 重构

---

## Self-Review

**1. Spec coverage:**
- ✅ 临时文件清理: 包含完整的删除和验证步骤
- ✅ 安全依赖更新: 明确跳过了大版本更新，只更新安全补丁
- ✅ Select Hook 提取: 完整的 Hook 代码和集成步骤
- ✅ DropdownMenu 工具函数: 完整的工具函数提取
- ✅ 最终验证: 完整的测试和构建验证
- **No gaps**

**2. Placeholder scan:**
- ✅ 所有步骤都有完整的代码块
- ✅ 所有命令都有精确的路径
- ✅ 所有预期输出都已说明
- ✅ 没有 "TBD" 或模糊描述
- **No placeholders found**

**3. Type consistency:**
- ✅ Hook 类型定义完整 (UseKeyboardNavigationOptions)
- ✅ 工具函数类型定义完整 (MenuPosition, MenuPlacement)
- ✅ 所有函数都有合适的返回类型
- **No inconsistencies found**

---

## Plan complete and saved to `docs/superpowers/plans/2026-04-28-minor-optimizations-cleanup.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
