# ESLint 错误修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 8 个 ESLint 错误，包括 React Compiler 优化阻止问题、Fast Refresh 违规、未使用的导入/变量和 any 类型使用，以提升代码质量并启用 React Compiler 优化。

**Architecture:** 按优先级修复，高优先级（React Compiler 阻止）先处理，然后是中优先级（未使用项），最后是低优先级（测试文件）。所有修复遵循现有代码模式，不改变组件行为。

**Tech Stack:** React 18+, TypeScript, ESLint, Vitest

---

## File Structure Overview

| Task | File | Change Type |
|------|------|-------------|
| 1 | `frontend/src/components/v2/Pagination/Pagination.tsx` | Modify |
| 2 | `frontend/src/components/Toast.tsx` → New: `frontend/src/components/toastContext.ts` | Move + Modify |
| 3 | `frontend/src/pages/ProjectOutline.tsx` | Modify |
| 4 | `frontend/src/pages/ProjectOverview.tsx` | Modify |
| 5 | `frontend/src/pages/ProjectExport.tsx` | Modify |
| 6 | `frontend/src/components/layout/NavRail.tsx` | Modify |
| 7 | `frontend/src/components/v2/Table/Table.tsx` | Modify |

---

### Task 1: 修复 Pagination 组件渲染期间创建组件的问题

**Files:**
- Modify: `frontend/src/components/v2/Pagination/Pagination.tsx:59-69,74,76-88,114-126`
- Test: `frontend/src/components/v2/Pagination/Pagination.test.tsx`

**Rationale:** 在渲染函数内部定义 ChevronLeft 和 ChevronRight 组件会阻止 React Compiler 优化，并且每次渲染都会重新创建组件。将 SVG 内联到 JSX 中可以避免这个问题。

- [ ] **Step 1: 删除渲染函数内部的 Chevron 组件定义**

删除以下代码（约第 59-69 行）:
```tsx
const ChevronLeft = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ChevronRight = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
```

- [ ] **Step 2: 用内联 SVG 替换 <ChevronLeft />**

将第 74 行的:
```tsx
<ChevronLeft />
```

替换为:
```tsx
<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
</svg>
```

- [ ] **Step 3: 用内联 SVG 替换 <ChevronRight />**

将第 114 行附近的:
```tsx
<ChevronRight />
```

替换为:
```tsx
<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
</svg>
```

- [ ] **Step 4: 运行 ESLint 验证错误已修复**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx eslint src/components/v2/Pagination/Pagination.tsx 2>&1
```

Expected: 无 "Cannot create components during render" 错误

- [ ] **Step 5: 运行 Pagination 测试确保无回归**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test -- --run src/components/v2/Pagination/Pagination.test.tsx 2>&1 | tail -15
```

Expected: 所有测试通过

- [ ] **Step 6: 提交更改**

```bash
cd /Users/nobody1/Desktop/project/writer
git add frontend/src/components/v2/Pagination/Pagination.tsx
git commit -m "fix: inline SVG icons in Pagination to avoid render-time component creation"
```

---

### Task 2: 分离 Toast Context 和 Hooks 以修复 Fast Refresh 违规

**Files:**
- Modify: `frontend/src/components/Toast.tsx`
- Create: `frontend/src/components/toastContext.ts`
- Verify: 所有导入 `useToast` 的文件仍正常工作

**Rationale:** Toast.tsx 同时导出了 context、hooks 和组件，违反了 Fast Refresh 规则（不能从仅包含组件的文件导出非组件值）。将 context 和 hooks 移动到单独的文件中。

- [ ] **Step 1: 创建 toastContext.ts 文件**

创建 `frontend/src/components/toastContext.ts`:
```tsx
import { useState, useCallback, createContext, useContext } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

export interface ToastContextType {
  showToast: (message: string, type: ToastType) => void
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
```

- [ ] **Step 2: 更新 Toast.tsx 移除重复定义并从 toastContext.ts 导入**

将 `frontend/src/components/Toast.tsx` 的内容替换为:
```tsx
import React, { useState, useCallback } from 'react'
import { Alert } from './v2/Alert/Alert'
import { ToastContext, Toast, ToastType } from './toastContext'

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 min-w-[280px]">
        {toasts.map(toast => (
          <Alert
            key={toast.id}
            variant={toast.type === 'error' ? 'error' : toast.type}
            closable
          >
            {toast.message}
          </Alert>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

ToastProvider.displayName = 'ToastProvider'
```

- [ ] **Step 3: 运行 ESLint 验证错误已修复**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx eslint src/components/Toast.tsx 2>&1
```

Expected: 无 Fast Refresh 相关错误

- [ ] **Step 4: 验证所有 useToast 导入仍然有效**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: 无 TypeScript 编译错误

- [ ] **Step 5: 运行相关测试**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test -- --run 2>&1 | tail -15
```

Expected: 测试通过

- [ ] **Step 6: 提交更改**

```bash
cd /Users/nobody1/Desktop/project/writer
git add frontend/src/components/Toast.tsx frontend/src/components/toastContext.ts
git commit -m "fix: move Toast context and hooks to separate file for Fast Refresh compliance"
```

---

### Task 3: 修复 ProjectOutline 中的 setState 级联渲染问题

**Files:**
- Modify: `frontend/src/pages/ProjectOutline.tsx:76-87`
- Test: 现有页面功能测试

**Rationale:** 在 useEffect 中同步调用 setState 会导致级联渲染，因为第一次 setState 触发重新渲染，第二次 useEffect 再次运行。使用函数式更新或 ref 可以避免这个问题。

- [ ] **Step 1: 分析当前问题代码**

当前代码（第 76-87 行）:
```tsx
useEffect(() => {
  if (!data?.config) return

  setConfigForm({
    skip_plan_confirmation: data.config.skip_plan_confirmation ?? false,
    skip_chapter_confirmation: data.config.skip_chapter_confirmation ?? false,
    allow_plot_adjustment: data.config.allow_plot_adjustment ?? false,
    chapter_word_count: data.config.chapter_word_count ?? 2000,
    start_chapter: data.config.start_chapter ?? 1,
    end_chapter: data.config.end_chapter ?? 10,
  })
}, [data])
```

问题: `data` 在依赖数组中，但这个 useEffect 设置 state 会触发重新渲染，如果 `data.config` 是每次都新创建的对象，会导致无限循环。

- [ ] **Step 2: 优化依赖数组，使用 useEvent 或精确依赖**

使用 useEvent 模式，或者优化为更精确的依赖:

```tsx
useEffect(() => {
  if (!data?.config) return

  setConfigForm({
    skip_plan_confirmation: data.config.skip_plan_confirmation ?? false,
    skip_chapter_confirmation: data.config.skip_chapter_confirmation ?? false,
    allow_plot_adjustment: data.config.allow_plot_adjustment ?? false,
    chapter_word_count: data.config.chapter_word_count ?? 2000,
    start_chapter: data.config.start_chapter ?? 1,
    end_chapter: data.config.end_chapter ?? 10,
  })
}, [
  data?.config?.skip_plan_confirmation,
  data?.config?.skip_chapter_confirmation,
  data?.config?.allow_plot_adjustment,
  data?.config?.chapter_word_count,
  data?.config?.start_chapter,
  data?.config?.end_chapter,
])
```

*注意：这确保只有当 config 的实际值改变时才重新运行 effect，而不是每次 data 对象引用改变时都重新运行。*

- [ ] **Step 3: 运行 ESLint 验证错误已修复**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx eslint src/pages/ProjectOutline.tsx 2>&1 | grep -i "setState\|cascading"
```

Expected: 无相关错误输出

- [ ] **Step 4: 运行完整类型检查**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无 TypeScript 错误

- [ ] **Step 5: 提交更改**

```bash
cd /Users/nobody1/Desktop/project/writer
git add frontend/src/pages/ProjectOutline.tsx
git commit -m "fix: use precise config dependencies in ProjectOutline useEffect to avoid cascading renders"
```

---

### Task 4: 移除 ProjectOverview 中未使用的 useState 导入

**Files:**
- Modify: `frontend/src/pages/ProjectOverview.tsx:1`

**Rationale:** useState 被导入但未使用，违反 ESLint rules。

- [ ] **Step 1: 移除未使用的 useState 导入**

将第 1 行从:
```tsx
import React, { useEffect, useState } from 'react'
```

改为:
```tsx
import React, { useEffect } from 'react'
```

- [ ] **Step 2: 运行 ESLint 验证**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx eslint src/pages/ProjectOverview.tsx 2>&1 | grep -i "unused"
```

Expected: 无 "unused" 相关的错误

- [ ] **Step 3: 运行类型检查**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx tsc --noEmit 2>&1 | head -10
```

Expected: 无 TypeScript 错误

- [ ] **Step 4: 提交更改**

```bash
cd /Users/nobody1/Desktop/project/writer
git add frontend/src/pages/ProjectOverview.tsx
git commit -m "fix: remove unused useState import in ProjectOverview"
```

---

### Task 5: 移除 ProjectExport 中未使用的 useMutation 导入

**Files:**
- Modify: `frontend/src/pages/ProjectExport.tsx:2`

**Rationale:** useMutation 被导入但未使用（实际使用的是来自 @tanstack/react-query 的 useMutation，但需要验证）。*注意：验证后发现 useMutation 实际上被使用了，这个任务可能不需要执行。请在实施前仔细检查。*

*更新：实际代码显示 useMutation 被使用了（第 59 行和第 72 行），所以不需要移除这个导入。跳过此任务。*

- [ ] **Step 1: 验证 useMutation 是否真的未使用**

检查文件中是否有 `useMutation(` 的调用:
```bash
cd /Users/nobody1/Desktop/project/writer/frontend
grep -n "useMutation" src/pages/ProjectExport.tsx
```

Expected: 如果没有匹配，继续移除；如果有匹配，标记任务为跳过。

- [ ] **Step 2: 如果确实未使用，从导入中移除**

将第 2 行从:
```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
```

改为:
```tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
```

- [ ] **Step 3: 运行 ESLint 和类型检查**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx eslint src/pages/ProjectExport.tsx 2>&1 | grep -i "unused"
npx tsc --noEmit 2>&1 | head -10
```

Expected: 无错误

- [ ] **Step 4: 提交更改（如果执行了移除）**

```bash
cd /Users/nobody1/Desktop/project/writer
git add frontend/src/pages/ProjectExport.tsx
git commit -m "fix: remove unused useMutation import in ProjectExport"
```

*注意：此任务仅在确认 useMutation 确实未使用时执行。*

---

### Task 6: 移除 NavRail 中未使用的 hovered 变量

**Files:**
- Modify: `frontend/src/components/layout/NavRail.tsx:136`

**Rationale:** `hovered` 状态变量被定义但从未使用，导致 ESLint 警告。

- [ ] **Step 1: 移除未使用的 hovered 状态变量**

将第 136 行从:
```tsx
const [hovered, setHovered] = useState(false)
```

改为:
```tsx
const [, setHovered] = useState(false)
```

*或者：如果确认 setHovered 也未使用，完全删除整行*

- [ ] **Step 2: 验证 setHovered 是否被使用**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
grep -n "setHovered" src/components/layout/NavRail.tsx
```

Expected: 第 157、161 行使用了 setHovered，所以保留 `setHovered` 但可以用逗号语法标记第一个参数为未使用: `const [, setHovered] = useState(false)`

- [ ] **Step 3: 运行 ESLint 验证**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx eslint src/components/layout/NavRail.tsx 2>&1 | grep -i "unused"
```

Expected: 无 "unused variable" 错误

- [ ] **Step 4: 运行类型检查和测试**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx tsc --noEmit 2>&1 | head -10
npm run test -- --run src/components/layout/NavRail.test.tsx 2>&1 | tail -10
```

Expected: 无错误，测试通过

- [ ] **Step 5: 提交更改**

```bash
cd /Users/nobody1/Desktop/project/writer
git add frontend/src/components/layout/NavRail.tsx
git commit -m "fix: mark unused hovered state variable with comma syntax"
```

---

### Task 7: 修复 Table 组件中的 any 类型使用

**Files:**
- Modify: `frontend/src/components/v2/Table/Table.tsx:3,6,11,28`

**Rationale:** 使用 `any` 类型绕过类型检查，违反类型安全原则。改为使用 `object` 或泛型约束。

- [ ] **Step 1: 更新 Column 接口的泛型约束**

将第 3 行从:
```tsx
export interface Column<T = any> {
```

改为:
```tsx
export interface Column<T extends object = object> {
```

- [ ] **Step 2: 更新 render 函数的 value 参数类型**

将第 6 行从:
```tsx
render?: (value: any, record: T, index: number) => React.ReactNode
```

改为:
```tsx
render?: (value: unknown, record: T, index: number) => React.ReactNode
```

*注意：使用 `unknown` 比 `any` 更安全，因为它强制类型检查。*

- [ ] **Step 3: 更新 TableProps 接口的泛型约束**

将第 11 行从:
```tsx
export interface TableProps<T = any> {
```

改为:
```tsx
export interface TableProps<T extends object = object> {
```

- [ ] **Step 4: 更新 Table 函数的泛型约束**

将第 28 行从:
```tsx
export function Table<T extends Record<string, any>>({
```

改为:
```tsx
export function Table<T extends Record<string, unknown>>({
```

- [ ] **Step 5: 运行 ESLint 验证**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx eslint src/components/v2/Table/Table.tsx 2>&1 | grep -i "any"
```

Expected: 无 "@typescript-eslint/no-explicit-any" 错误

- [ ] **Step 6: 运行完整类型检查**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: 无 TypeScript 错误

- [ ] **Step 7: 运行 Table 组件测试**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test -- --run src/components/v2/Table/Table.test.tsx 2>&1 | tail -15
```

Expected: 所有测试通过

- [ ] **Step 8: 提交更改**

```bash
cd /Users/nobody1/Desktop/project/writer
git add frontend/src/components/v2/Table/Table.tsx
git commit -m "fix: replace any types with object/unknown in Table component for type safety"
```

---

### Task 8: 最终验证

**Files:** None - verification only

- [ ] **Step 1: 运行完整的 ESLint 检查**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx eslint src 2>&1 | tail -30
```

Expected: 高优先级和中优先级错误已全部修复

- [ ] **Step 2: 运行完整的 TypeScript 类型检查**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx tsc --noEmit 2>&1
```

Expected: 无 TypeScript 错误

- [ ] **Step 3: 运行完整的前端测试套件**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test -- --run 2>&1 | tail -20
```

Expected: 300+ 测试通过

- [ ] **Step 4: 验证 React Compiler 可以正常工作**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run build 2>&1 | tail -20
```

Expected: 构建成功，无 React Compiler 相关的警告

- [ ] **Step 5: 最终总结验证**

确认以下问题已解决:
1.  Pagination: 内联 SVG，消除渲染期间创建组件的问题
2.  Toast: Context 和 hooks 分离，符合 Fast Refresh 规则
3.  ProjectOutline: useEffect 依赖优化，消除级联渲染
4.  ProjectOverview: 移除未使用的 useState 导入
5.  NavRail: 修复未使用的 hovered 变量警告
6.  Table: 替换 any 类型，提升类型安全性

---

## Self-Review Check

**1. Spec coverage:**
-  涵盖所有高优先级 ESLint 错误（Pagination, Toast, ProjectOutline）
-  涵盖所有中优先级问题（未使用的导入/变量、any 类型）
-  任务分解清晰，每个任务都有明确的步骤和预期结果
- **无缺口**

**2. Placeholder scan:**
-  所有代码更改都有精确的代码块
-  所有命令都有精确的路径和预期输出
-  没有模糊的 "implement" 或 "fix" 指令
-  Task 5 明确标记了"仅在确认后执行"的条件
- **无 placeholders**

**3. Type consistency:**
-  所有文件路径与实际项目结构匹配
-  行号大致准确（考虑到文件可能有小的变动）
-  类型更改一致（any → object/unknown）
-  导入路径与项目实际结构匹配
- **无不一致之处**
