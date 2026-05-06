# v2 组件库完整化 - 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 v2 组件库全量建设，包括视觉验证、4个缺失组件补全、动画/无障碍增强、3个特殊页面组件重构、工程化文档

**Architecture:** 自下而上分5阶段执行：Phase 0 建立视觉基线 → Phase 1 补全通用组件 → Phase 2 组件体验增强 → Phase 3 页面深度重构 → Phase 4 工程化收尾。每个阶段独立可验证，确保质量可控。

**Tech Stack:** React + TypeScript + Tailwind CSS + Vitest + Testing Library + Storybook

---

## 文件结构总览

```
frontend/src/components/v2/
├── Slider/
│   ├── Slider.tsx          (New)
│   └── Slider.test.tsx     (New)
├── Table/
│   ├── Table.tsx           (New)
│   └── Table.test.tsx      (New)
├── Pagination/
│   ├── Pagination.tsx      (New)
│   └── Pagination.test.tsx (New)
├── Empty/
│   ├── Empty.tsx           (New)
│   └── Empty.test.tsx      (New)
├── Modal/Modal.tsx         (Modify - add animation)
├── Tooltip/Tooltip.tsx     (Modify - add animation)
├── index.ts                (Modify - add exports)
└── README.md               (New - documentation)
```

---

# Phase 0: 视觉验证 & 快速修复

---

## Task 0.1: 启动开发服务器并检查基础页面

**Files:**
- Check: All pages under `frontend/src/pages/`

- [ ] **Step 1: 启动开发服务器**

```bash
cd frontend && npm run dev
```

Expected: Vite server starts at `http://localhost:5173`, no build errors

- [ ] **Step 2: 检查 Login 页面**

Open: `http://localhost:5173/login`

Visual checklist:
- Card 组件有正确的边框和圆角
- Input 聚焦时有正确的高亮边框
- Button hover 有正确的颜色变化和阴影
- 文字层级清晰（标题 > label > body）
- 无布局溢出或截断

- [ ] **Step 3: 检查 Register 页面**

Open: `http://localhost:5173/register`

Visual checklist: Same as Login page

- [ ] **Step 4: 检查 Dashboard 页面**

Open: `http://localhost:5173/dashboard` (may need login first)

Visual checklist:
- 项目卡片网格对齐正确
- Badge 颜色与状态匹配
- Progress 进度条高度和颜色正确
- 按钮间距和大小一致

- [ ] **Step 5: 记录发现的问题**

Create a temporary note file:

```bash
cd frontend && touch visual-issues.md
```

Record any issues found with: page name, description, screenshot suggestion

- [ ] **Step 6: Commit (if no changes needed)**

```bash
# If no changes needed, just record completion in your mind
echo "Phase 0 Task 0.1 complete"
```

---

## Task 0.2: 检查 Project Overview 与 Editor 页面

**Files:**
- Check: `src/pages/ProjectOverview.tsx`, `src/pages/Editor.tsx`

- [ ] **Step 1: 检查 Project Overview 页面**

Open: Project overview page

Visual checklist:
- Tabs 组件下划线对齐正确
- AgentCard 状态徽章颜色与状态匹配
- Progress 进度条显示正常
- Button 状态（disabled/loading）显示正确

- [ ] **Step 2: 检查 Editor 页面**

Open: Editor page

Visual checklist:
- 工具栏按钮间距一致
- 右侧面板 Card 内边距正确
- 编辑区字体和行高舒适

- [ ] **Step 3: 检查 Settings 页面**

Open: Settings page

Visual checklist:
- ThemeSelector 按钮样式统一
- Input disabled 状态显示正确
- Badge 对齐正确

- [ ] **Step 4: 修复 10 分钟内能解决的小问题**

Example typical quick fixes:
```tsx
// Fix 1: Add missing CSS variable to global CSS
// In frontend/src/index.css
:root {
  --accent-primary: #4a7c59;
  /* verify all vars exist */
}

// Fix 2: Adjust Card padding in Dashboard
className="p-6"  // instead of "p-4"
```

- [ ] **Step 5: Run tests**

```bash
cd frontend && npm run test:run
```

Expected: All 203 tests pass

- [ ] **Step 6: Commit quick fixes**

```bash
git add frontend/src/pages/*.tsx frontend/src/index.css
git commit -m "fix: resolve visual issues found in Phase 0"
```

---

# Phase 1: 缺失组件补全

---

## Task 1.1: Slider 滑块组件

**Files:**
- Create: `frontend/src/components/v2/Slider/Slider.tsx`
- Create: `frontend/src/components/v2/Slider/Slider.test.tsx`
- Create: `frontend/src/components/v2/Slider/Slider.stories.tsx`
- Modify: `frontend/src/components/v2/index.ts` (add export)

- [ ] **Step 1: Write failing test**

```tsx
// Slider.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Slider } from './Slider'

describe('Slider', () => {
  it('renders correctly with default value', () => {
    render(<Slider value={50} />)
    const slider = screen.getByRole('slider')
    expect(slider).toBeInTheDocument()
    expect(slider).toHaveValue('50')
  })

  it('calls onChange when value changes', async () => {
    const onChange = vi.fn()
    render(<Slider value={30} onChange={onChange} />)

    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '70' } })

    expect(onChange).toHaveBeenCalledWith(70)
  })

  it('renders disabled state correctly', () => {
    render(<Slider value={50} disabled />)
    const slider = screen.getByRole('slider')
    expect(slider).toBeDisabled()
  })

  it('renders label and value when enabled', () => {
    render(<Slider value={75} label="强度" showValue />)
    expect(screen.getByText('强度')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm run test:run -- --include Slider
```

Expected: FAIL with "Cannot find module './Slider'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// Slider.tsx
import React, { useState } from 'react'

export interface SliderProps {
  value?: number
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onChange?: (value: number) => void
  label?: string
  showValue?: boolean
  className?: string
}

export const Slider: React.FC<SliderProps> = ({
  value: controlledValue,
  defaultValue = 50,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  onChange,
  label,
  showValue = false,
  className = '',
}) => {
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue)
  const value = isControlled ? controlledValue : internalValue

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onChange?.(newValue)
  }

  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      {(label || showValue) && (
        <div className="flex justify-between items-center">
          {label && <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>}
          {showValue && <span className="text-sm text-[var(--text-secondary)]">{value}</span>}
        </div>
      )}
      <div className="relative flex items-center w-full h-5">
        <div className="absolute w-full h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-[var(--accent-primary)] rounded-full transition-all duration-150"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          className="absolute w-full h-4 opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <div
          className={`absolute w-4 h-4 bg-[var(--accent-primary)] rounded-full shadow-md transform -translate-x-1/2 transition-all duration-150 pointer-events-none ${
            disabled ? 'opacity-50' : 'hover:scale-125'
          }`}
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

Slider.displayName = 'Slider'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npm run test:run -- --include Slider
```

Expected: All 4 tests PASS

- [ ] **Step 5: Add export to v2/index.ts**

```typescript
// Add to existing exports
export * from './Slider/Slider'
```

- [ ] **Step 6: Create Storybook story**

```tsx
// Slider.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Slider } from './Slider'

const meta: Meta<typeof Slider> = {
  title: 'v2/Slider',
  component: Slider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    min: { control: { type: 'number' } },
    max: { control: { type: 'number' } },
    step: { control: { type: 'number' } },
    disabled: { control: { type: 'boolean' } },
    label: { control: { type: 'text' } },
    showValue: { control: { type: 'boolean' } },
  },
}

export default meta
type Story = StoryObj<typeof Slider>

export const Default: Story = {
  args: {
    value: 50,
    label: '强度',
    showValue: true,
  },
}

export const Disabled: Story = {
  args: {
    value: 30,
    disabled: true,
    label: '已禁用',
    showValue: true,
  },
}

export const WithStep: Story = {
  args: {
    value: 0.5,
    min: 0,
    max: 1,
    step: 0.1,
    label: '精细调节',
    showValue: true,
  },
}
```

- [ ] **Step 7: Run all tests to verify no regression**

```bash
cd frontend && npm run test:run
```

Expected: 203 + 4 = 207 tests pass

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/v2/Slider/ frontend/src/components/v2/index.ts
git commit -m "feat: add Slider v2 component with tests and stories"
```

---

## Task 1.2: Table 数据表格组件

**Files:**
- Create: `frontend/src/components/v2/Table/Table.tsx`
- Create: `frontend/src/components/v2/Table/Table.test.tsx`
- Create: `frontend/src/components/v2/Table/Table.stories.tsx`
- Modify: `frontend/src/components/v2/index.ts` (add export)

- [ ] **Step 1: Write failing test**

```tsx
// Table.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Table } from './Table'

interface TestData {
  id: number
  name: string
  status: string
}

const columns = [
  { key: 'id', title: 'ID' },
  { key: 'name', title: '名称' },
  { key: 'status', title: '状态' },
]

const dataSource: TestData[] = [
  { id: 1, name: '项目一', status: '进行中' },
  { id: 2, name: '项目二', status: '已完成' },
]

describe('Table', () => {
  it('renders table with headers and data correctly', () => {
    render(<Table columns={columns} dataSource={dataSource} rowKey="id" />)

    // Headers
    expect(screen.getByText('ID')).toBeInTheDocument()
    expect(screen.getByText('名称')).toBeInTheDocument()
    expect(screen.getByText('状态')).toBeInTheDocument()

    // Data
    expect(screen.getByText('项目一')).toBeInTheDocument()
    expect(screen.getByText('项目二')).toBeInTheDocument()
  })

  it('renders empty state when no data', () => {
    render(<Table columns={columns} dataSource={[]} rowKey="id" />)
    expect(screen.getByText('暂无数据')).toBeInTheDocument()
  })

  it('renders with custom render function', () => {
    const customColumns = [
      { key: 'name', title: '名称' },
      {
        key: 'status',
        title: '状态',
        render: (value: string) => <span className="custom-status">{value}</span>,
      },
    ]

    render(<Table columns={customColumns} dataSource={dataSource} rowKey="id" />)

    // The rendered content should be findable
    expect(screen.getByText('进行中')).toBeInTheDocument()
  })

  it('applies hoverable styles when enabled', () => {
    render(<Table columns={columns} dataSource={dataSource} rowKey="id" hoverable />)
    // Just verify it renders without crashing
    expect(screen.getByText('项目一')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm run test:run -- --include Table
```

Expected: FAIL with "Cannot find module './Table'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// Table.tsx
import React from 'react'

export interface Column<T = any> {
  key: string
  title: React.ReactNode
  render?: (value: any, record: T, index: number) => React.ReactNode
  width?: string | number
  align?: 'left' | 'center' | 'right'
}

export interface TableProps<T = any> {
  columns: Column<T>[]
  dataSource: T[]
  rowKey?: string
  striped?: boolean
  hoverable?: boolean
  bordered?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'py-2 px-3',
  md: 'py-3 px-4',
  lg: 'py-4 px-5',
}

export function Table<T extends Record<string, any>>({
  columns,
  dataSource,
  rowKey = 'id',
  striped = false,
  hoverable = true,
  bordered = false,
  size = 'md',
  className = '',
}: TableProps<T>) {
  const paddingClass = sizeClasses[size]

  const getAlignClass = (align?: string) => {
    switch (align) {
      case 'center': return 'text-center'
      case 'right': return 'text-right'
      default: return 'text-left'
    }
  }

  return (
    <div className={`w-full overflow-auto ${className}`.trim()}>
      <table className={`w-full border-collapse ${bordered ? 'border border-[var(--border-default)]' : ''}`}>
        <thead>
          <tr className="bg-[var(--bg-secondary)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${paddingClass} font-medium text-[var(--text-primary)] border-b-2 border-[var(--border-default)] ${getAlignClass(col.align)}`}
                style={{ width: col.width }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={`${paddingClass} text-center text-[var(--text-secondary)]`}>
                暂无数据
              </td>
            </tr>
          ) : (
            dataSource.map((record, index) => (
              <tr
                key={record[rowKey] ?? index}
                className={`
                  border-b border-[var(--border-default)]
                  ${striped && index % 2 === 1 ? 'bg-[var(--bg-tertiary)]' : ''}
                  ${hoverable ? 'hover:bg-[var(--bg-tertiary)] transition-colors' : ''}
                `}
              >
                {columns.map((col) => {
                  const value = record[col.key]
                  return (
                    <td
                      key={col.key}
                      className={`${paddingClass} text-[var(--text-body)] ${getAlignClass(col.align)}`}
                    >
                      {col.render ? col.render(value, record, index) : value}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

Table.displayName = 'Table'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npm run test:run -- --include Table
```

Expected: All 4 tests PASS

- [ ] **Step 5: Add export to v2/index.ts**

```typescript
// Add to existing exports
export * from './Table/Table'
```

- [ ] **Step 6: Create Storybook story**

```tsx
// Table.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Table } from './Table'

const meta: Meta<typeof Table> = {
  title: 'v2/Table',
  component: Table,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Table>

interface DataItem {
  id: number
  name: string
  status: string
  progress: number
}

const columns = [
  { key: 'id', title: 'ID', width: '80px' },
  { key: 'name', title: '项目名称' },
  { key: 'status', title: '状态' },
  {
    key: 'progress',
    title: '进度',
    render: (value: number) => (
      <div className="flex items-center gap-2">
        <div className="w-20 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent-primary)] rounded-full"
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="text-sm text-[var(--text-secondary)]">{value}%</span>
      </div>
    ),
  },
]

const dataSource: DataItem[] = [
  { id: 1, name: '长篇小说创作', status: '进行中', progress: 65 },
  { id: 2, name: '短篇故事集', status: '已完成', progress: 100 },
  { id: 3, name: '剧本创作', status: '待开始', progress: 0 },
]

export const Default: Story = {
  args: {
    columns,
    dataSource,
    rowKey: 'id',
  },
}

export const Striped: Story = {
  args: {
    columns,
    dataSource,
    rowKey: 'id',
    striped: true,
  },
}

export const Small: Story = {
  args: {
    columns,
    dataSource,
    rowKey: 'id',
    size: 'sm',
  },
}

export const Empty: Story = {
  args: {
    columns,
    dataSource: [],
    rowKey: 'id',
  },
}
```

- [ ] **Step 7: Run all tests to verify no regression**

```bash
cd frontend && npm run test:run
```

Expected: 207 + 4 = 211 tests pass

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/v2/Table/ frontend/src/components/v2/index.ts
git commit -m "feat: add Table v2 component with tests and stories"
```

---

## Task 1.3: Pagination 分页组件

**Files:**
- Create: `frontend/src/components/v2/Pagination/Pagination.tsx`
- Create: `frontend/src/components/v2/Pagination/Pagination.test.tsx`
- Create: `frontend/src/components/v2/Pagination/Pagination.stories.tsx`
- Modify: `frontend/src/components/v2/index.ts` (add export)

- [ ] **Step 1: Write failing test**

```tsx
// Pagination.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('renders page buttons correctly', () => {
    render(<Pagination current={1} total={50} pageSize={10} />)

    // Should show 1-5 buttons
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()

    // Prev/Next buttons
    expect(screen.getByLabelText('上一页')).toBeInTheDocument()
    expect(screen.getByLabelText('下一页')).toBeInTheDocument()
  })

  it('disables prev button on first page', () => {
    render(<Pagination current={1} total={50} pageSize={10} />)
    const prevBtn = screen.getByLabelText('上一页')
    expect(prevBtn).toBeDisabled()
  })

  it('disables next button on last page', () => {
    render(<Pagination current={5} total={50} pageSize={10} />)
    const nextBtn = screen.getByLabelText('下一页')
    expect(nextBtn).toBeDisabled()
  })

  it('calls onChange when page is clicked', async () => {
    const onChange = vi.fn()
    render(<Pagination current={1} total={50} pageSize={10} onChange={onChange} />)

    await fireEvent.click(screen.getByText('3'))
    expect(onChange).toHaveBeenCalledWith(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm run test:run -- --include Pagination
```

Expected: FAIL with "Cannot find module './Pagination'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// Pagination.tsx
import React from 'react'

export interface PaginationProps {
  current: number
  total: number
  pageSize?: number
  onChange?: (page: number) => void
  showSizeChanger?: boolean
  showQuickJumper?: boolean
  className?: string
}

export const Pagination: React.FC<PaginationProps> = ({
  current,
  total,
  pageSize = 10,
  onChange,
  className = '',
}) => {
  const totalPages = Math.ceil(total / pageSize)

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (current <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (current >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        pages.push(current - 1)
        pages.push(current)
        pages.push(current + 1)
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages
  }

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== current) {
      onChange?.(page)
    }
  }

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

  return (
    <div className={`flex items-center gap-1 ${className}`.trim()}>
      {/* Prev Button */}
      <button
        aria-label="上一页"
        disabled={current <= 1}
        onClick={() => handlePageClick(current - 1)}
        className={`
          flex items-center justify-center w-8 h-8 rounded-md text-sm
          transition-colors duration-150
          ${current <= 1
            ? 'text-[var(--text-muted)] cursor-not-allowed opacity-50'
            : 'text-[var(--text-body)] hover:bg-[var(--bg-tertiary)]'
          }
        `}
      >
        <ChevronLeft />
      </button>

      {/* Page Numbers */}
      {getPageNumbers().map((page, index) => (
        typeof page === 'number' ? (
          <button
            key={index}
            onClick={() => handlePageClick(page)}
            className={`
              flex items-center justify-center w-8 h-8 rounded-md text-sm
              transition-all duration-150
              ${page === current
                ? 'bg-[var(--accent-primary)] text-white font-medium'
                : 'text-[var(--text-body)] hover:bg-[var(--bg-tertiary)]'
              }
            `}
          >
            {page}
          </button>
        ) : (
          <span key={index} className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)]">
            {page}
          </span>
        )
      ))}

      {/* Next Button */}
      <button
        aria-label="下一页"
        disabled={current >= totalPages}
        onClick={() => handlePageClick(current + 1)}
        className={`
          flex items-center justify-center w-8 h-8 rounded-md text-sm
          transition-colors duration-150
          ${current >= totalPages
            ? 'text-[var(--text-muted)] cursor-not-allowed opacity-50'
            : 'text-[var(--text-body)] hover:bg-[var(--bg-tertiary)]'
          }
        `}
      >
        <ChevronRight />
      </button>
    </div>
  )
}

Pagination.displayName = 'Pagination'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npm run test:run -- --include Pagination
```

Expected: All 4 tests PASS

- [ ] **Step 5: Add export to v2/index.ts**

```typescript
// Add to existing exports
export * from './Pagination/Pagination'
```

- [ ] **Step 6: Create Storybook story**

```tsx
// Pagination.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Pagination } from './Pagination'

const meta: Meta<typeof Pagination> = {
  title: 'v2/Pagination',
  component: Pagination,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    current: { control: { type: 'number', min: 1, max: 10 } },
    total: { control: { type: 'number', min: 1 } },
    pageSize: { control: { type: 'number', min: 1 } },
  },
}

export default meta
type Story = StoryObj<typeof Pagination>

export const Default: Story = {
  args: {
    current: 1,
    total: 50,
    pageSize: 10,
  },
}

export const MiddlePage: Story = {
  args: {
    current: 5,
    total: 100,
    pageSize: 10,
  },
}

export const LastPage: Story = {
  args: {
    current: 10,
    total: 100,
    pageSize: 10,
  },
}

export const SmallTotal: Story = {
  args: {
    current: 2,
    total: 30,
    pageSize: 10,
  },
}
```

- [ ] **Step 7: Run all tests to verify no regression**

```bash
cd frontend && npm run test:run
```

Expected: 211 + 4 = 215 tests pass

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/v2/Pagination/ frontend/src/components/v2/index.ts
git commit -m "feat: add Pagination v2 component with tests and stories"
```

---

## Task 1.4: Empty 空状态组件

**Files:**
- Create: `frontend/src/components/v2/Empty/Empty.tsx`
- Create: `frontend/src/components/v2/Empty/Empty.test.tsx`
- Create: `frontend/src/components/v2/Empty/Empty.stories.tsx`
- Modify: `frontend/src/components/v2/index.ts` (add export)

- [ ] **Step 1: Write failing test**

```tsx
// Empty.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Empty } from './Empty'

describe('Empty', () => {
  it('renders with default title', () => {
    render(<Empty />)
    expect(screen.getByText('暂无数据')).toBeInTheDocument()
  })

  it('renders with custom title and description', () => {
    render(<Empty title="没有项目" description="点击按钮创建第一个项目" />)

    expect(screen.getByText('没有项目')).toBeInTheDocument()
    expect(screen.getByText('点击按钮创建第一个项目')).toBeInTheDocument()
  })

  it('renders with action button', () => {
    render(
      <Empty
        title="空列表"
        action={<button type="button">创建</button>}
      />
    )

    expect(screen.getByRole('button', { name: '创建' })).toBeInTheDocument()
  })

  it('renders with different icon types', () => {
    const { rerender } = render(<Empty icon="document" />)
    // Document icon should render

    rerender(<Empty icon="folder" />)
    // Folder icon should render

    rerender(<Empty icon="list" />)
    // List icon should render
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm run test:run -- --include Empty
```

Expected: FAIL with "Cannot find module './Empty'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// Empty.tsx
import React from 'react'

export type EmptyIconType = 'document' | 'folder' | 'list'

export interface EmptyProps {
  icon?: EmptyIconType | React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

// Document icon
const DocumentIcon = () => (
  <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 8h20c2 0 4 2 4 4v40c0 2-2 4-4 4H20c-2 0-4-2-4-4V12c0-2 2-4 4-4z" />
    <path d="M28 20h8M28 28h16M28 36h12" />
  </svg>
)

// Folder icon
const FolderIcon = () => (
  <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 16h18l4 4h26a2 2 0 0 1 2 2v26a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V18a2 2 0 0 1 2-2z" />
  </svg>
)

// List icon
const ListIcon = () => (
  <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16h40M12 28h40M12 40h40M12 52h40" />
    <circle cx="8" cy="16" r="2" />
    <circle cx="8" cy="28" r="2" />
    <circle cx="8" cy="40" r="2" />
    <circle cx="8" cy="52" r="2" />
  </svg>
)

const iconMap: Record<EmptyIconType, React.FC> = {
  document: DocumentIcon,
  folder: FolderIcon,
  list: ListIcon,
}

export const Empty: React.FC<EmptyProps> = ({
  icon = 'document',
  title = '暂无数据',
  description,
  action,
  className = '',
}) => {
  const renderIcon = () => {
    if (typeof icon === 'string' && iconMap[icon as EmptyIconType]) {
      const IconComponent = iconMap[icon as EmptyIconType]
      return <IconComponent />
    }
    return icon
  }

  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center max-w-sm mx-auto ${className}`.trim()}>
      <div className="text-[var(--text-muted)] mb-4">
        {renderIcon()}
      </div>
      {title && (
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          {description}
        </p>
      )}
      {action && (
        <div>{action}</div>
      )}
    </div>
  )
}

Empty.displayName = 'Empty'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npm run test:run -- --include Empty
```

Expected: All 4 tests PASS

- [ ] **Step 5: Add export to v2/index.ts**

```typescript
// Add to existing exports
export * from './Empty/Empty'
```

- [ ] **Step 6: Create Storybook story**

```tsx
// Empty.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Empty } from './Empty'
import { Button } from '../Button/Button'

const meta: Meta<typeof Empty> = {
  title: 'v2/Empty',
  component: Empty,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    icon: {
      control: { type: 'select' },
      options: ['document', 'folder', 'list'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Empty>

export const Default: Story = {
  args: {},
}

export const WithDescription: Story = {
  args: {
    title: '还没有项目',
    description: '创建你的第一个创作项目，开始你的写作之旅',
  },
}

export const WithAction: Story = {
  args: {
    icon: 'folder',
    title: '暂无项目',
    description: '点击下方按钮创建你的第一个项目',
    action: <Button variant="primary">创建项目</Button>,
  },
}

export const EmptyList: Story = {
  args: {
    icon: 'list',
    title: '列表为空',
    description: '还没有添加任何内容',
  },
}
```

- [ ] **Step 7: Run all tests to verify no regression**

```bash
cd frontend && npm run test:run
```

Expected: 215 + 4 = 219 tests pass

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/v2/Empty/ frontend/src/components/v2/index.ts
git commit -m "feat: add Empty v2 component with tests and stories"
```

---

# Phase 1 Complete
Phase 1 is complete. We have added 4 new components. Now we move to Phase 2: Component enhancements.

---

## Task 2.1: Modal 动画增强

**Files:**
- Modify: `frontend/src/components/v2/Modal/Modal.tsx`

- [ ] **Step 1: Read current Modal code**

First, inspect existing code structure

- [ ] **Step 2: Add fade-in animation CSS**

```tsx
// Inside Modal component, update the wrapper classes
// Add these transition classes to the overlay and content

// Overlay:
className={`
  fixed inset-0 z-50
  bg-black/50 backdrop-blur-sm
  transition-opacity duration-150 ease-out
  ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}
`}

// Content wrapper:
className={`
  fixed z-50 top-1/2 left-1/2 -translate-x-1/2
  transition-all duration-150 ease-out
  ${open ? '-translate-y-1/2 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}
`}
```

- [ ] **Step 3: Run Modal tests**

```bash
cd frontend && npm run test:run -- --include Modal
```

Expected: All existing Modal tests pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/v2/Modal/Modal.tsx
git commit -m "enhance: add fade-in animation to Modal v2"
```

---

## Task 2.2: Tooltip animation + Accessibility pass

**Files:**
- Modify: `frontend/src/components/v2/Tooltip/Tooltip.tsx`
- Modify: `frontend/src/components/v2/DropdownMenu/DropdownMenu.tsx`
- Modify: `frontend/src/components/v2/Popover/Popover.tsx`

- [ ] **Step 1: Add similar animation to Tooltip**

Same pattern as Modal - add transition for smooth appearance

- [ ] **Step 2: Add ARIA attributes for accessibility**

```tsx
// Add:
role="tooltip"
id={uniqueId}
// And for the trigger element:
aria-describedby={uniqueId}
```

- [ ] **Step 3: Apply same pattern to DropdownMenu and Popover**

- [ ] **Step 4: Run all related tests**

```bash
cd frontend && npm run test:run -- --include Tooltip --include DropdownMenu --include Popover
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/v2/Tooltip/Tooltip.tsx frontend/src/components/v2/DropdownMenu/DropdownMenu.tsx frontend/src/components/v2/Popover/Popover.tsx
git commit -m "enhance: add animations and ARIA attributes to floating components"
```

---

## Phase 2 Summary
Phase 2 enhancements are complete. Now Phase 3: Deep page refactoring

---

## Task 3.1: AgentCard 重构

**Files:**
- Create: `frontend/src/components/v2/AgentCard/AgentCard.tsx`
- Create: `frontend/src/components/v2/AgentCard/AgentCard.test.tsx`
- Modify: `frontend/src/components/v2/index.ts` (add export)
- Modify: `frontend/src/pages/ProjectOverview.tsx` (replace usage)

- [ ] **Step 1: Create new AgentCard v2**

```tsx
// AgentCard.tsx in v2
import React from 'react'
import { Card } from '../Card/Card'
import { Badge } from '../Badge/Badge'

export type AgentStatus = 'idle' | 'running' | 'done' | 'error'

export interface AgentCardProps {
  name: string
  subtitle: string
  status: AgentStatus
  progress?: number
  currentStep?: string
  className?: string
}

const statusColors: Record<AgentStatus, 'default' | 'success' | 'warning' | 'error'> = {
  idle: 'default',
  running: 'warning',
  done: 'success',
  error: 'error',
}

const statusLabels: Record<AgentStatus, string> = {
  idle: '等待中',
  running: '执行中',
  done: '已完成',
  error: '错误',
}

export const AgentCard: React.FC<AgentCardProps> = ({
  name,
  subtitle,
  status,
  progress,
  currentStep,
  className = '',
}) => {
  return (
    <Card className={`p-4 ${className}`.trim()}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-[var(--text-primary)]">{name}</h4>
          <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'running' ? 'animate-pulse' : ''
            }`}
            style={{
              backgroundColor:
                status === 'done' ? 'var(--accent-primary)' :
                status === 'running' ? '#f59e0b' :
                status === 'error' ? '#ef4444' :
                'var(--text-muted)',
            }}
          />
          <Badge variant={statusColors[status]}>{statusLabels[status]}</Badge>
        </div>
      </div>

      {progress !== undefined && (
        <div className="mt-3">
          <div className="w-full h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}

      {currentStep && (
        <p className="mt-2 text-sm text-[var(--text-secondary)] truncate">
          {currentStep}
        </p>
      )}
    </Card>
  )
}

AgentCard.displayName = 'AgentCard'
```

- [ ] **Step 2: Run tests, then update ProjectOverview**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/v2/AgentCard/ frontend/src/components/v2/index.ts frontend/src/pages/ProjectOverview.tsx
git commit -m "refactor: migrate AgentCard to v2 design system"
```

---

## Task 3.2: SkillSelector + ThemeSelector 重构

**Files:**
- Refactor SkillSelector to use v2 CheckboxGroup + Slider
- Refactor ThemeSelector to use v2 Buttons

(Following the same pattern: write test, implement, replace usage, commit)

---

## Phase 4: 工程化 & 文档

## Task 4.1: v2 README 文档

**Files:**
- Create: `frontend/src/components/v2/README.md`

- [ ] **Step 1: Write documentation**

Content should include:
- Installation/import guide
- CSS variables reference
- Component API reference
- Best practices (composition pattern, controlled vs uncontrolled)

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/v2/README.md
git commit -m "docs: add v2 component library README"
```

---

## 最终验证

- [ ] **Step 1: 运行全部测试**

```bash
cd frontend && npm run test:run
```

Expected: All ~230 tests pass

- [ ] **Step 2: TypeScript 类型检查**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No type errors

- [ ] **Step 3: 开发服务器最终验证**

```bash
cd frontend && npm run dev
```

Expected: Server starts without errors

---

**Plan Complete!**
