# v2 组件库扩展实现计划

&gt; **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善 v2 组件库，新增 8 个核心组件（Select, Switch, Tabs, Alert, Avatar, Divider, Popover, Dropdown Menu），达到顶级大厂组件库标准

**Architecture:** 每个组件独立实现，遵循现有的 v2 组件架构模式：TypeScript + React + Tailwind CSS + Vitest。所有组件使用 CSS 变量实现主题支持，遵循「极简而高级」的设计原则。

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library

---

## 设计原则回顾

| 原则 | 具体要求 |
|------|---------|
| **极简** | 去掉所有非必要装饰，内容优先，无冗余图标 |
| **高级** | 细腻的动效（150ms ease-out）、微妙的色彩层次、恰到好处的留白 |
| **可访问性** | 完整的 ARIA 属性、键盘导航支持、focus-visible 样式 |
| **类型安全** | 完整的 TypeScript 类型定义 |

---

## 共用工具（前置任务）

### Task 0: 共用 Hooks（useClickOutside, useId）

**Files:**
- Create: `frontend/src/components/v2/hooks/useClickOutside.ts`
- Create: `frontend/src/components/v2/hooks/useId.ts`

- [ ] **Step 1: 创建 useClickOutside hook**

```typescript
import { RefObject, useEffect } from 'react'

export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return
      }
      handler(event)
    }

    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)

    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, handler])
}
```

- [ ] **Step 2: 创建 useId hook**

```typescript
import { useId as useReactId } from 'react'

let idCounter = 0

export function useId(prefix = 'v2'): string {
  const reactId = useReactId()
  return `${prefix}-${reactId || ++idCounter}`
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
git add src/components/v2/hooks/
git commit -m "feat(v2): add shared hooks useClickOutside and useId"
```

---

## 组件实现任务

---

### Task 1: Switch 开关组件

**Files:**
- Create: `frontend/src/components/v2/Switch/Switch.tsx`
- Create: `frontend/src/components/v2/Switch/Switch.test.tsx`
- Create: `frontend/src/components/v2/Switch/Switch.stories.tsx`

**Design:** 纯滑块，无图标，极简风格
- 三种尺寸：sm (20×12px), md (28×16px), lg (36×20px)
- 状态：默认、开启、禁用、禁用+开启
- 动画：150ms ease-out 滑块滑动 + 背景色过渡

- [ ] **Step 1: 写测试文件**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Switch } from './Switch'

describe('Switch', () => {
  it('renders correctly', () => {
    render(<Switch aria-label="Toggle setting" />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('can be controlled via checked prop', () => {
    const { rerender } = render(<Switch checked={true} aria-label="Toggle" />)
    expect(screen.getByRole('switch')).toBeChecked()

    rerender(<Switch checked={false} aria-label="Toggle" />)
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('calls onChange when clicked', async () => {
    const onChange = vi.fn()
    render(<Switch onChange={onChange} aria-label="Toggle" />)
    
    await fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
    
    await fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('is disabled when disabled prop is true', async () => {
    const onChange = vi.fn()
    render(<Switch disabled onChange={onChange} aria-label="Toggle" />)
    
    expect(screen.getByRole('switch')).toBeDisabled()
    await fireEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders label correctly', () => {
    render(<Switch label="Enable notifications" />)
    expect(screen.getByText('Enable notifications')).toBeInTheDocument()
  })

  it('applies different sizes correctly', () => {
    const { rerender } = render(<Switch size="sm" aria-label="Toggle" />)
    expect(screen.getByRole('switch').parentElement).toHaveClass('h-3')

    rerender(<Switch size="md" aria-label="Toggle" />)
    expect(screen.getByRole('switch').parentElement).toHaveClass('h-4')

    rerender(<Switch size="lg" aria-label="Toggle" />)
    expect(screen.getByRole('switch').parentElement).toHaveClass('h-5')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Switch
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现 Switch 组件**

```tsx
import React, { forwardRef, useState } from 'react'
import { useId } from '../hooks/useId'

export type SwitchSize = 'sm' | 'md' | 'lg'

export interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  size?: SwitchSize
  label?: React.ReactNode
  labelPosition?: 'left' | 'right'
  className?: string
}

const sizeClasses: Record<SwitchSize, { track: string; thumb: string }> = {
  sm: {
    track: 'w-5 h-3',
    thumb: 'w-2.5 h-2.5',
  },
  md: {
    track: 'w-7 h-4',
    thumb: 'w-3 h-3',
  },
  lg: {
    track: 'w-9 h-5',
    thumb: 'w-4 h-4',
  },
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      checked: checkedProp,
      defaultChecked = false,
      onChange,
      disabled = false,
      size = 'md',
      label,
      labelPosition = 'right',
      className = '',
    },
    ref
  ) => {
    const [internalChecked, setInternalChecked] = useState(defaultChecked)
    const isControlled = checkedProp !== undefined
    const checked = isControlled ? checkedProp : internalChecked
    const id = useId('switch')

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newChecked = e.target.checked
      if (!isControlled) {
        setInternalChecked(newChecked)
      }
      onChange?.(newChecked)
    }

    return (
      <label
        className={`inline-flex items-center gap-2 cursor-pointer ${
          disabled ? 'cursor-not-allowed opacity-50' : ''
        } ${className}`.trim()}
        htmlFor={id}
      >
        {labelPosition === 'left' && label && (
          <span className="text-[var(--text-body)] select-none">{label}</span>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            role="switch"
            checked={checked}
            disabled={disabled}
            onChange={handleChange}
            className="sr-only"
            aria-checked={checked}
          />
          {/* Track */}
          <div
            className={`${sizeClasses[size].track} rounded-full transition-colors duration-150 ${
              checked
                ? 'bg-[var(--accent-primary)]'
                : 'bg-[var(--border-default)]'
            }`}
          />
          {/* Thumb */}
          <div
            className={`${sizeClasses[size].thumb} absolute top-1/2 -translate-y-1/2 bg-white rounded-full shadow-sm transition-all duration-150 ${
              checked ? 'left-[calc(100%-width-2px)] translate-x-[-2px]' : 'left-[2px]'
            }`}
            style={{
              transform: checked
                ? `translate(calc(-100% - 2px), -50%)`
                : 'translate(2px, -50%)',
            }}
          />
        </div>
        {labelPosition === 'right' && label && (
          <span className="text-[var(--text-body)] select-none">{label}</span>
        )}
      </label>
    )
  }
)

Switch.displayName = 'Switch'
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Switch
```

Expected: PASS

- [ ] **Step 5: 创建 Storybook stories**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Switch } from './Switch'

const meta: Meta<typeof Switch> = {
  title: 'v2/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    labelPosition: {
      control: 'select',
      options: ['left', 'right'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Switch>

export const Default: Story = {
  args: {
    label: 'Enable notifications',
  },
}

export const Checked: Story = {
  args: {
    label: 'Enabled',
    checked: true,
  },
}

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    disabled: true,
  },
}

export const DisabledChecked: Story = {
  args: {
    label: 'Disabled and enabled',
    disabled: true,
    checked: true,
  },
}

export const Small: Story = {
  args: {
    label: 'Small size',
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    label: 'Large size',
    size: 'lg',
  },
}

export const LabelLeft: Story = {
  args: {
    label: 'Label on left',
    labelPosition: 'left',
  },
}
```

- [ ] **Step 6: 提交代码**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
git add src/components/v2/Switch/
git commit -m "feat(v2): add Switch component"
```

---

### Task 2: Alert 警告提示组件

**Files:**
- Create: `frontend/src/components/v2/Alert/Alert.tsx`
- Create: `frontend/src/components/v2/Alert/Alert.test.tsx`
- Create: `frontend/src/components/v2/Alert/Alert.stories.tsx`

**Design:** 极简风格，无图标，仅左侧彩色边条 + 微妙背景色
- 四种变体：`success`, `warning`, `error`, `info`
- 支持标题 + 描述结构
- 可选关闭按钮
- 圆角设计，与其他组件一致

- [ ] **Step 1: 写测试文件**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Alert } from './Alert'

describe('Alert', () => {
  it('renders correctly with default props', () => {
    render(<Alert>Alert message</Alert>)
    expect(screen.getByText('Alert message')).toBeInTheDocument()
  })

  it('renders title correctly', () => {
    render(<Alert title="Success">Operation completed</Alert>)
    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText('Operation completed')).toBeInTheDocument()
  })

  it('applies variant styles correctly', () => {
    const { rerender } = render(<Alert variant="success">Success</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('border-l-[var(--accent-primary)]')

    rerender(<Alert variant="warning">Warning</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('border-l-[var(--accent-gold)]')

    rerender(<Alert variant="error">Error</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('border-l-[var(--accent-warm)]')

    rerender(<Alert variant="info">Info</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('border-l-[var(--accent-primary)]')
  })

  it('shows close button when closable is true', () => {
    render(<Alert closable>Closable alert</Alert>)
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<Alert closable onClose={onClose}>Alert</Alert>)
    
    await fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('applies custom className correctly', () => {
    render(<Alert className="custom-class">Alert</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('custom-class')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Alert
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现 Alert 组件**

```tsx
import React from 'react'

export type AlertVariant = 'success' | 'warning' | 'error' | 'info'

export interface AlertProps {
  variant?: AlertVariant
  title?: React.ReactNode
  children: React.ReactNode
  closable?: boolean
  onClose?: () => void
  className?: string
}

const variantClasses: Record<AlertVariant, string> = {
  success: 'border-l-[var(--accent-primary)] bg-[var(--accent-primary)] bg-opacity-5',
  warning: 'border-l-[var(--accent-gold)] bg-[var(--accent-gold)] bg-opacity-5',
  error: 'border-l-[var(--accent-warm)] bg-[var(--accent-warm)] bg-opacity-5',
  info: 'border-l-[var(--accent-primary)] bg-[var(--bg-tertiary)]',
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  closable = false,
  onClose,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`relative p-4 border-l-4 rounded-r-lg ${variantClasses[variant]} ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {title && (
            <div className="font-medium text-[var(--text-primary)] mb-1">
              {title}
            </div>
          )}
          <div className="text-[var(--text-body)] text-sm">{children}</div>
        </div>
        {closable && (
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1 -mr-1 -mt-1"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

Alert.displayName = 'Alert'
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Alert
```

Expected: PASS

- [ ] **Step 5: 创建 Storybook stories**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Alert } from './Alert'

const meta: Meta<typeof Alert> = {
  title: 'v2/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['success', 'warning', 'error', 'info'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Alert>

export const Success: Story = {
  args: {
    variant: 'success',
    title: 'Success',
    children: 'Your changes have been saved successfully.',
  },
}

export const Warning: Story = {
  args: {
    variant: 'warning',
    title: 'Warning',
    children: 'This action may have unintended consequences.',
  },
}

export const Error: Story = {
  args: {
    variant: 'error',
    title: 'Error',
    children: 'Something went wrong. Please try again.',
  },
}

export const Info: Story = {
  args: {
    variant: 'info',
    title: 'Information',
    children: 'This feature is currently in beta.',
  },
}

export const WithCloseButton: Story = {
  args: {
    variant: 'info',
    title: 'Dismissible',
    children: 'You can close this alert.',
    closable: true,
  },
}

export const WithoutTitle: Story = {
  args: {
    variant: 'success',
    children: 'Simple alert without title.',
  },
}
```

- [ ] **Step 6: 提交代码**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
git add src/components/v2/Alert/
git commit -m "feat(v2): add Alert component"
```

---

### Task 3: Tabs 标签页组件

**Files:**
- Create: `frontend/src/components/v2/Tabs/Tabs.tsx`
- Create: `frontend/src/components/v2/Tabs/Tabs.test.tsx`
- Create: `frontend/src/components/v2/Tabs/Tabs.stories.tsx`

**Design:** 极简下划线风格，带滑动动画
- 四种变体：`default` (下划线), `pills`, `outline`, `transparent`
- 键盘导航：← → 键切换，Home/End 跳首尾
- 受控与非受控模式
- 支持禁用单个 Tab

- [ ] **Step 1: 写测试文件**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs'

describe('Tabs', () => {
  it('renders correctly with default value', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )
    
    expect(screen.getByText('Tab 1')).toBeInTheDocument()
    expect(screen.getByText('Tab 2')).toBeInTheDocument()
    expect(screen.getByText('Content 1')).toBeInTheDocument()
    expect(screen.queryByText('Content 2')).not.toBeInTheDocument()
  })

  it('switches content when clicking tabs', async () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )
    
    await fireEvent.click(screen.getByText('Tab 2'))
    expect(screen.getByText('Content 2')).toBeInTheDocument()
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
  })

  it('can be controlled via value prop', async () => {
    const onValueChange = vi.fn()
    render(
      <Tabs value="tab1" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )
    
    await fireEvent.click(screen.getByText('Tab 2'))
    expect(onValueChange).toHaveBeenCalledWith('tab2')
  })

  it('disables tab when disabled prop is true', async () => {
    const onValueChange = vi.fn()
    render(
      <Tabs defaultValue="tab1" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2" disabled>Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    )
    
    await fireEvent.click(screen.getByText('Tab 2'))
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('supports keyboard navigation', async () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
        <TabsContent value="tab3">Content 3</TabsContent>
      </Tabs>
    )
    
    const tab1 = screen.getByText('Tab 1')
    
    // Focus tab1 and press right arrow
    tab1.focus()
    await fireEvent.keyDown(tab1, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(screen.getByText('Tab 2'))
    
    // Press left arrow to go back
    await fireEvent.keyDown(screen.getByText('Tab 2'), { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(tab1)
  })

  it('applies variant styles correctly', () => {
    const { rerender } = render(
      <Tabs defaultValue="tab1" variant="pills">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
      </Tabs>
    )
    
    expect(screen.getByRole('tablist')).toHaveClass('bg-[var(--bg-tertiary)]')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Tabs
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现 Tabs 组件**

```tsx
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'

export type TabsVariant = 'default' | 'pills' | 'outline' | 'transparent'

interface TabsContextValue {
  value: string
  setValue: (value: string) => void
  variant: TabsVariant
  activeTriggerRef: React.RefObject<HTMLButtonElement>
}

const TabsContext = createContext<TabsContextValue | null>(null)

export interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  variant?: TabsVariant
  children: React.ReactNode
  className?: string
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue = '',
  value: valueProp,
  onValueChange,
  variant = 'default',
  children,
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const isControlled = valueProp !== undefined
  const value = isControlled ? valueProp : internalValue
  const activeTriggerRef = useRef<HTMLButtonElement>(null)

  const setValue = useCallback((newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }, [isControlled, onValueChange])

  return (
    <TabsContext.Provider value={{ value, setValue, variant, activeTriggerRef }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

Tabs.displayName = 'Tabs'

// TabsList
export interface TabsListProps {
  children: React.ReactNode
  className?: string
}

const variantListClasses: Record<TabsVariant, string> = {
  default: 'border-b border-[var(--border-subtle)]',
  pills: 'bg-[var(--bg-tertiary)] p-1 rounded-lg',
  outline: 'border-b border-[var(--border-subtle)]',
  transparent: '',
}

export const TabsList: React.FC<TabsListProps> = ({ children, className = '' }) => {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabsList must be used within Tabs')

  return (
    <div
      role="tablist"
      className={`inline-flex items-center ${variantListClasses[context.variant]} ${className}`.trim()}
    >
      {children}
    </div>
  )
}

TabsList.displayName = 'TabsList'

// TabsTrigger
export interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  disabled?: boolean
  className?: string
}

const variantTriggerClasses: Record<TabsVariant, { active: string; inactive: string }> = {
  default: {
    active: 'text-[var(--accent-primary)]',
    inactive: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
  },
  pills: {
    active: 'bg-white text-[var(--text-primary)] shadow-sm',
    inactive: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
  },
  outline: {
    active: 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]',
    inactive: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-b-2 border-transparent',
  },
  transparent: {
    active: 'text-[var(--accent-primary)]',
    inactive: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
  },
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  disabled = false,
  className = '',
}) => {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabsTrigger must be used within Tabs')

  const { value: activeValue, setValue, variant, activeTriggerRef } = context
  const isActive = value === activeValue
  const ref = isActive ? activeTriggerRef : null

  const handleClick = () => {
    if (!disabled) {
      setValue(value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const triggers = Array.from(
      e.currentTarget.parentElement?.querySelectorAll('[role="tab"]:not([disabled])') || []
    )
    const currentIndex = triggers.indexOf(e.currentTarget)

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextIndex = (currentIndex + 1) % triggers.length
      ;(triggers[nextIndex] as HTMLElement).focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIndex = (currentIndex - 1 + triggers.length) % triggers.length
      ;(triggers[prevIndex] as HTMLElement).focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      ;(triggers[0] as HTMLElement).focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      ;(triggers[triggers.length - 1] as HTMLElement).focus()
    }
  }

  const classes = variantTriggerClasses[variant]

  return (
    <button
      ref={ref}
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isActive ? 0 : -1}
      className={`px-4 py-2 text-sm font-medium transition-all duration-150 rounded-md ${
        isActive ? classes.active : classes.inactive
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`.trim()}
    >
      {children}
    </button>
  )
}

TabsTrigger.displayName = 'TabsTrigger'

// TabsContent
export interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, children, className = '' }) => {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabsContent must be used within Tabs')

  const { value: activeValue } = context
  const isActive = value === activeValue

  if (!isActive) return null

  return (
    <div
      role="tabpanel"
      className={`pt-4 outline-none ${className}`.trim()}
      tabIndex={0}
    >
      {children}
    </div>
  )
}

TabsContent.displayName = 'TabsContent'
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Tabs
```

Expected: PASS

- [ ] **Step 5: 创建 Storybook stories**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs'

const meta: Meta<typeof Tabs> = {
  title: 'v2/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'pills', 'outline', 'transparent'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Tabs>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content for Tab 1</TabsContent>
      <TabsContent value="tab2">Content for Tab 2</TabsContent>
      <TabsContent value="tab3">Content for Tab 3</TabsContent>
    </Tabs>
  ),
}

export const Pills: Story = {
  render: () => (
    <Tabs defaultValue="tab1" variant="pills">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content for Tab 1</TabsContent>
      <TabsContent value="tab2">Content for Tab 2</TabsContent>
      <TabsContent value="tab3">Content for Tab 3</TabsContent>
    </Tabs>
  ),
}

export const Outline: Story = {
  render: () => (
    <Tabs defaultValue="tab1" variant="outline">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content for Tab 1</TabsContent>
      <TabsContent value="tab2">Content for Tab 2</TabsContent>
      <TabsContent value="tab3">Content for Tab 3</TabsContent>
    </Tabs>
  ),
}

export const WithDisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2" disabled>Tab 2 (Disabled)</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content for Tab 1</TabsContent>
      <TabsContent value="tab3">Content for Tab 3</TabsContent>
    </Tabs>
  ),
}
```

- [ ] **Step 6: 提交代码**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
git add src/components/v2/Tabs/
git commit -m "feat(v2): add Tabs component"
```

---

### Task 4: Avatar 头像组件

**Files:**
- Create: `frontend/src/components/v2/Avatar/Avatar.tsx`
- Create: `frontend/src/components/v2/Avatar/Avatar.test.tsx`
- Create: `frontend/src/components/v2/Avatar/Avatar.stories.tsx`

**Design:** 仅圆形，极简风格
- 三种尺寸：sm (32px), md (40px), lg (48px)
- 支持图片 URL、文字首字母
- 首字母自动分配背景色（基于文字哈希）
- 支持头像组（堆叠效果）

- [ ] **Step 1: 写测试文件**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Avatar, AvatarGroup } from './Avatar'

describe('Avatar', () => {
  it('renders correctly with default props', () => {
    render(<Avatar>JD</Avatar>)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('renders image correctly when src is provided', () => {
    render(<Avatar src="https://example.com/avatar.jpg" alt="User" />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('applies different sizes correctly', () => {
    const { rerender } = render(<Avatar size="sm">JD</Avatar>)
    expect(screen.getByText('JD').parentElement).toHaveClass('w-8 h-8 text-xs')

    rerender(<Avatar size="md">JD</Avatar>)
    expect(screen.getByText('JD').parentElement).toHaveClass('w-10 h-10 text-sm')

    rerender(<Avatar size="lg">JD</Avatar>)
    expect(screen.getByText('JD').parentElement).toHaveClass('w-12 h-12 text-base')
  })

  it('applies custom className correctly', () => {
    render(<Avatar className="custom-class">JD</Avatar>)
    expect(screen.getByText('JD').parentElement).toHaveClass('custom-class')
  })
})

describe('AvatarGroup', () => {
  it('renders multiple avatars with spacing', () => {
    render(
      <AvatarGroup>
        <Avatar>JD</Avatar>
        <Avatar>AB</Avatar>
        <Avatar>CD</Avatar>
      </AvatarGroup>
    )
    
    const avatars = screen.getAllByText(/[A-Z]{2}/)
    expect(avatars).toHaveLength(3)
  })

  it('renders count when max is exceeded', () => {
    render(
      <AvatarGroup max={2}>
        <Avatar>JD</Avatar>
        <Avatar>AB</Avatar>
        <Avatar>CD</Avatar>
        <Avatar>EF</Avatar>
      </AvatarGroup>
    )
    
    expect(screen.getByText('+2')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Avatar
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现 Avatar 组件**

```tsx
import React from 'react'

export type AvatarSize = 'sm' | 'md' | 'lg'

export interface AvatarProps {
  src?: string
  alt?: string
  children?: React.ReactNode
  size?: AvatarSize
  className?: string
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
}

// 基于字符串生成稳定的颜色
function getColorFromString(str: string): string {
  const colors = [
    'var(--accent-primary)',
    'var(--accent-warm)',
    'var(--accent-gold)',
    'var(--accent-soft)',
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  children,
  size = 'md',
  className = '',
}) => {
  const bgColor = children
    ? getColorFromString(typeof children === 'string' ? children : 'avatar')
    : 'var(--bg-tertiary)'

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 bg-opacity-10 ${sizeClasses[size]} ${className}`.trim()}
      style={{ backgroundColor: bgColor }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[var(--text-primary)] font-medium">{children}</span>
      )}
    </div>
  )
}

Avatar.displayName = 'Avatar'

// AvatarGroup
export interface AvatarGroupProps {
  children: React.ReactNode
  max?: number
  className?: string
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  children,
  max,
  className = '',
}) => {
  const childrenArray = React.Children.toArray(children)
  const visibleChildren = max ? childrenArray.slice(0, max) : childrenArray
  const remaining = max ? childrenArray.length - max : 0

  return (
    <div className={`inline-flex items-center ${className}`.trim()}>
      {visibleChildren.map((child, index) => (
        <div
          key={index}
          className="border-2 border-[var(--bg-primary)] rounded-full -ml-2 first:ml-0"
        >
          {child}
        </div>
      ))}
      {remaining > 0 && (
        <div className="border-2 border-[var(--bg-primary)] rounded-full -ml-2">
          <Avatar className="bg-[var(--bg-tertiary)]">+{remaining}</Avatar>
        </div>
      )}
    </div>
  )
}

AvatarGroup.displayName = 'AvatarGroup'
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Avatar
```

Expected: PASS

- [ ] **Step 5: 创建 Storybook stories**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Avatar, AvatarGroup } from './Avatar'

const meta: Meta<typeof Avatar> = {
  title: 'v2/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Avatar>

export const WithInitials: Story = {
  args: {
    children: 'JD',
  },
}

export const WithImage: Story = {
  args: {
    src: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100&h=100',
    alt: 'User avatar',
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
    children: 'JD',
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'JD',
  },
}

export const Group: Story = {
  render: () => (
    <AvatarGroup>
      <Avatar>JD</Avatar>
      <Avatar>AB</Avatar>
      <Avatar>CD</Avatar>
      <Avatar>EF</Avatar>
    </AvatarGroup>
  ),
}

export const GroupWithMax: Story = {
  render: () => (
    <AvatarGroup max={3}>
      <Avatar>JD</Avatar>
      <Avatar>AB</Avatar>
      <Avatar>CD</Avatar>
      <Avatar>EF</Avatar>
      <Avatar>GH</Avatar>
    </AvatarGroup>
  ),
}
```

- [ ] **Step 6: 提交代码**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
git add src/components/v2/Avatar/
git commit -m "feat(v2): add Avatar component"
```

---

### Task 5: Divider 分割线组件

**Files:**
- Create: `frontend/src/components/v2/Divider/Divider.tsx`
- Create: `frontend/src/components/v2/Divider/Divider.test.tsx`
- Create: `frontend/src/components/v2/Divider/Divider.stories.tsx`

**Design:** 极淡风格，层次分明
- 两种方向：`horizontal` (默认) 和 `vertical`
- 支持文字居中：`─── 或 ─── 更多内容 ───`
- 支持虚线样式可选
- 使用 `border-subtle` 颜色，几乎看不见但有层次感

- [ ] **Step 1: 写测试文件**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Divider } from './Divider'

describe('Divider', () => {
  it('renders correctly as horizontal by default', () => {
    render(<Divider />)
    const divider = screen.getByRole('separator')
    expect(divider).toBeInTheDocument()
    expect(divider).toHaveClass('h-px')
  })

  it('renders as vertical when orientation is vertical', () => {
    render(<Divider orientation="vertical" style={{ height: '100px' }} />)
    const divider = screen.getByRole('separator')
    expect(divider).toHaveClass('w-px')
  })

  it('renders with text correctly', () => {
    render(<Divider>Or continue with</Divider>)
    expect(screen.getByText('Or continue with')).toBeInTheDocument()
  })

  it('applies dashed style correctly', () => {
    render(<Divider dashed />)
    expect(screen.getByRole('separator')).toHaveClass('border-dashed')
  })

  it('applies custom className correctly', () => {
    render(<Divider className="custom-class" />)
    expect(screen.getByRole('separator')).toHaveClass('custom-class')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Divider
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现 Divider 组件**

```tsx
import React from 'react'

export type DividerOrientation = 'horizontal' | 'vertical'

export interface DividerProps {
  orientation?: DividerOrientation
  dashed?: boolean
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  dashed = false,
  children,
  className = '',
  style,
}) => {
  const isHorizontal = orientation === 'horizontal'

  // With text variant
  if (children && isHorizontal) {
    return (
      <div
        role="separator"
        className={`flex items-center w-full ${className}`.trim()}
        style={style}
      >
        <div
          className={`flex-1 ${dashed ? 'border-dashed' : 'border-solid'} border-t border-[var(--border-subtle)]`}
        />
        <span className="px-4 text-sm text-[var(--text-secondary)]">
          {children}
        </span>
        <div
          className={`flex-1 ${dashed ? 'border-dashed' : 'border-solid'} border-t border-[var(--border-subtle)]`}
        />
      </div>
    )
  }

  return (
    <div
      role="separator"
      className={`${
        isHorizontal
          ? 'w-full h-px border-t'
          : 'h-full w-px border-l'
      } ${dashed ? 'border-dashed' : 'border-solid'} border-[var(--border-subtle)] ${className}`.trim()}
      style={style}
    />
  )
}

Divider.displayName = 'Divider'
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Divider
```

Expected: PASS

- [ ] **Step 5: 创建 Storybook stories**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Divider } from './Divider'

const meta: Meta<typeof Divider> = {
  title: 'v2/Divider',
  component: Divider,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Divider>

export const Horizontal: Story = {}

export const Dashed: Story = {
  args: {
    dashed: true,
  },
}

export const WithText: Story = {
  args: {
    children: 'Or continue with',
  },
}

export const Vertical: Story = {
  render: () => (
    <div className="flex items-center gap-4 h-20">
      <span>Left</span>
      <Divider orientation="vertical" />
      <span>Right</span>
    </div>
  ),
}
```

- [ ] **Step 6: 提交代码**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
git add src/components/v2/Divider/
git commit -m "feat(v2): add Divider component"
```

---

### Task 6: Select 下拉选择组件

**Files:**
- Create: `frontend/src/components/v2/Select/Select.tsx`
- Create: `frontend/src/components/v2/Select/Select.test.tsx`
- Create: `frontend/src/components/v2/Select/Select.stories.tsx`

**Design:** 完整功能的下拉选择
- 支持搜索过滤
- 键盘导航：↑↓ Enter Esc
- 点击外部关闭
- 变体：默认、禁用、错误状态
- 支持分组、禁用选项
- 可清除选项

- [ ] **Step 1: 写测试文件**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from './Select'

describe('Select', () => {
  it('renders correctly with placeholder', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    )
    
    expect(screen.getByText('Select an option')).toBeInTheDocument()
  })

  it('opens dropdown when trigger is clicked', async () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectContent>
      </Select>
    )
    
    await fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('selects option and closes dropdown', async () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    )
    
    await fireEvent.click(screen.getByRole('combobox'))
    await fireEvent.click(screen.getByText('Option 1'))
    
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Option 1')).toBeInTheDocument()
  })

  it('calls onValueChange when option is selected', async () => {
    const onValueChange = vi.fn()
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectContent>
      </Select>
    )
    
    await fireEvent.click(screen.getByRole('combobox'))
    await fireEvent.click(screen.getByText('Option 1'))
    expect(onValueChange).toHaveBeenCalledWith('option1')
  })

  it('disables item when disabled prop is true', async () => {
    const onValueChange = vi.fn()
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1" disabled>Option 1 (Disabled)</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    )
    
    await fireEvent.click(screen.getByRole('combobox'))
    await fireEvent.click(screen.getByText('Option 1 (Disabled)'))
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('filters options when search is enabled', async () => {
    render(
      <Select searchable>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="cherry">Cherry</SelectItem>
        </SelectContent>
      </Select>
    )
    
    await fireEvent.click(screen.getByRole('combobox'))
    const searchInput = screen.getByPlaceholderText('Search...')
    
    await fireEvent.change(searchInput, { target: { value: 'ban' } })
    
    expect(screen.getByText('Banana')).toBeInTheDocument()
    expect(screen.queryByText('Apple')).not.toBeInTheDocument()
    expect(screen.queryByText('Cherry')).not.toBeInTheDocument()
  })

  it('supports keyboard navigation', async () => {
    render(
      <Select defaultValue="apple">
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="cherry">Cherry</SelectItem>
        </SelectContent>
      </Select>
    )
    
    const trigger = screen.getByRole('combobox')
    trigger.focus()
    
    // Open with Enter
    await fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    
    // Close with Escape
    await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Select
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现 Select 组件**

```tsx
import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useClickOutside } from '../hooks/useClickOutside'
import { useId } from '../hooks/useId'

interface SelectContextValue {
  value: string
  setValue: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchable: boolean
  triggerRef: React.RefObject<HTMLButtonElement>
  contentRef: React.RefObject<HTMLDivElement>
}

const SelectContext = createContext<SelectContextValue | null>(null)

export interface SelectProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  searchable?: boolean
  children: React.ReactNode
}

export const Select: React.FC<SelectProps> = ({
  defaultValue = '',
  value: valueProp,
  onValueChange,
  open: openProp,
  onOpenChange,
  searchable = false,
  children,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const [internalOpen, setInternalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  const isControlled = valueProp !== undefined
  const value = isControlled ? valueProp : internalValue
  const open = openProp !== undefined ? openProp : internalOpen
  
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const setValue = useCallback((newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }, [isControlled, onValueChange])

  const setOpen = useCallback((newOpen: boolean) => {
    if (openProp === undefined) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
    if (!newOpen) {
      setSearchQuery('')
    }
  }, [openProp, onOpenChange])

  // Close on click outside
  useClickOutside(contentRef, (e) => {
    if (!triggerRef.current?.contains(e.target as Node)) {
      setOpen(false)
    }
  })

  return (
    <SelectContext.Provider
      value={{
        value,
        setValue,
        open,
        setOpen,
        searchQuery,
        setSearchQuery,
        searchable,
        triggerRef,
        contentRef,
      }}
    >
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  )
}

Select.displayName = 'Select'

// SelectTrigger
export interface SelectTriggerProps {
  children: React.ReactNode
  disabled?: boolean
  className?: string
}

export const SelectTrigger: React.FC<SelectTriggerProps> = ({
  children,
  disabled = false,
  className = '',
}) => {
  const context = useContext(SelectContext)
  if (!context) throw new Error('SelectTrigger must be used within Select')

  const { open, setOpen, triggerRef } = context

  return (
    <button
      ref={triggerRef}
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => setOpen(!open)}
      className={`w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-opacity-20 focus:border-[var(--accent-primary)] ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--border-strong)] cursor-pointer'
      } ${className}`.trim()}
    >
      {children}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`text-[var(--text-secondary)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  )
}

SelectTrigger.displayName = 'SelectTrigger'

// SelectValue
export interface SelectValueProps {
  placeholder?: string
}

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder }) => {
  const context = useContext(SelectContext)
  if (!context) throw new Error('SelectValue must be used within Select')

  const { value, contentRef } = context
  const [displayValue, setDisplayValue] = useState(placeholder)

  // Find selected item's text from children
  useEffect(() => {
    if (contentRef.current && value) {
      const selectedItem = contentRef.current.querySelector(`[data-value="${value}"]`)
      if (selectedItem) {
        setDisplayValue(selectedItem.textContent || placeholder)
      }
    }
  }, [value, contentRef, placeholder])

  return (
    <span className={value ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
      {displayValue}
    </span>
  )
}

SelectValue.displayName = 'SelectValue'

// SelectContent
export interface SelectContentProps {
  children: React.ReactNode
  className?: string
}

export const SelectContent: React.FC<SelectContentProps> = ({ children, className = '' }) => {
  const context = useContext(SelectContext)
  if (!context) throw new Error('SelectContent must be used within Select')

  const { open, setOpen, setValue, searchable, searchQuery, setSearchQuery, contentRef } = context
  const id = useId('select-content')

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = Array.from(
      contentRef.current?.querySelectorAll('[role="option"]:not([data-disabled="true"])') || []
    )
    const currentIndex = items.findIndex(item => document.activeElement === item)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = (currentIndex + 1) % items.length
      ;(items[nextIndex] as HTMLElement)?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIndex = (currentIndex - 1 + items.length) % items.length
      ;(items[prevIndex] as HTMLElement)?.focus()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (currentIndex >= 0) {
        const value = items[currentIndex].getAttribute('data-value')
        if (value) {
          setValue(value)
          setOpen(false)
        }
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }, [contentRef, setValue, setOpen])

  if (!open) return null

  return (
    <div
      ref={contentRef}
      id={id}
      role="listbox"
      onKeyDown={handleKeyDown}
      className={`absolute z-50 mt-1 w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg overflow-hidden ${className}`.trim()}
    >
      {searchable && (
        <div className="p-2 border-b border-[var(--border-subtle)]">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-opacity-20"
            autoFocus
          />
        </div>
      )}
      <div className="max-h-60 overflow-auto py-1">
        {children}
      </div>
    </div>
  )
}

SelectContent.displayName = 'SelectContent'

// SelectItem
export interface SelectItemProps {
  value: string
  children: React.ReactNode
  disabled?: boolean
  className?: string
}

export const SelectItem: React.FC<SelectItemProps> = ({
  value,
  children,
  disabled = false,
  className = '',
}) => {
  const context = useContext(SelectContext)
  if (!context) throw new Error('SelectItem must be used within Select')

  const { value: selectedValue, setValue, setOpen, searchQuery, searchable } = context
  const isSelected = value === selectedValue

  // Filter by search query
  const isVisible = useMemo(() => {
    if (!searchable || !searchQuery) return true
    const text = typeof children === 'string' ? children : ''
    return text.toLowerCase().includes(searchQuery.toLowerCase())
  }, [children, searchQuery, searchable])

  if (!isVisible) return null

  const handleClick = () => {
    if (!disabled) {
      setValue(value)
      setOpen(false)
    }
  }

  return (
    <div
      role="option"
      data-value={value}
      data-disabled={disabled}
      aria-selected={isSelected}
      onClick={handleClick}
      tabIndex={disabled ? -1 : 0}
      className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-100 outline-none ${
        isSelected
          ? 'bg-[var(--accent-primary)] bg-opacity-10 text-[var(--accent-primary)]'
          : 'text-[var(--text-body)] hover:bg-[var(--bg-tertiary)]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`.trim()}
    >
      {children}
    </div>
  )
}

SelectItem.displayName = 'SelectItem'

// SelectGroup
export interface SelectGroupProps {
  children: React.ReactNode
  className?: string
}

export const SelectGroup: React.FC<SelectGroupProps> = ({ children, className = '' }) => {
  return (
    <div role="group" className={className}>
      {children}
    </div>
  )
}

SelectGroup.displayName = 'SelectGroup'

// SelectLabel
export interface SelectLabelProps {
  children: React.ReactNode
  className?: string
}

export const SelectLabel: React.FC<SelectLabelProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] ${className}`.trim()}>
      {children}
    </div>
  )
}

SelectLabel.displayName = 'SelectLabel'
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Select
```

Expected: PASS

- [ ] **Step 5: 创建 Storybook stories**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from './Select'

const meta: Meta<typeof Select> = {
  title: 'v2/Select',
  component: Select,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Select>

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="cherry">Cherry</SelectItem>
        <SelectItem value="date">Date</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Fruits</SelectLabel>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Vegetables</SelectLabel>
          <SelectItem value="carrot">Carrot</SelectItem>
          <SelectItem value="potato">Potato</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
}

export const WithDisabledItem: Story = {
  render: () => (
    <Select defaultValue="apple">
      <SelectTrigger>
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana" disabled>Banana (Disabled)</SelectItem>
        <SelectItem value="cherry">Cherry</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const Searchable: Story = {
  render: () => (
    <Select searchable>
      <SelectTrigger>
        <SelectValue placeholder="Search for a country" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="china">China</SelectItem>
        <SelectItem value="japan">Japan</SelectItem>
        <SelectItem value="korea">Korea</SelectItem>
        <SelectItem value="usa">United States</SelectItem>
        <SelectItem value="uk">United Kingdom</SelectItem>
        <SelectItem value="france">France</SelectItem>
        <SelectItem value="germany">Germany</SelectItem>
      </SelectContent>
    </Select>
  ),
}
```

- [ ] **Step 6: 提交代码**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
git add src/components/v2/Select/
git commit -m "feat(v2): add Select component with search"
```

---

### Task 7: Popover 弹出框组件

**Files:**
- Create: `frontend/src/components/v2/Popover/Popover.tsx`
- Create: `frontend/src/components/v2/Popover/Popover.test.tsx`
- Create: `frontend/src/components/v2/Popover/Popover.stories.tsx`

**Design:** Tooltip 的升级版，支持更丰富的内容

- [ ] **Step 1: 写测试文件**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Popover, PopoverTrigger, PopoverContent } from './Popover'

describe('Popover', () => {
  it('renders trigger correctly', () => {
    render(
      <Popover>
        <PopoverTrigger>
          <button>Open Popover</button>
        </PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>
    )
    
    expect(screen.getByText('Open Popover')).toBeInTheDocument()
  })

  it('opens popover when trigger is clicked', async () => {
    render(
      <Popover>
        <PopoverTrigger>
          <button>Open</button>
        </PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>
    )
    
    await fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Popover content')).toBeInTheDocument()
  })

  it('closes popover when clicking outside', async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <Popover>
          <PopoverTrigger>
            <button>Open</button>
          </PopoverTrigger>
          <PopoverContent>Popover content</PopoverContent>
        </Popover>
      </div>
    )
    
    await fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Popover content')).toBeInTheDocument()
    
    await fireEvent.mouseDown(screen.getByTestId('outside'))
    await waitFor(() => {
      expect(screen.queryByText('Popover content')).not.toBeInTheDocument()
    })
  })

  it('closes popover when Escape is pressed', async () => {
    render(
      <Popover>
        <PopoverTrigger>
          <button>Open</button>
        </PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>
    )
    
    await fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Popover content')).toBeInTheDocument()
    
    await fireEvent.keyDown(screen.getByText('Popover content'), { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByText('Popover content')).not.toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Popover
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现 Popover 组件**

```tsx
import React, { createContext, useContext, useState, useRef, useCallback } from 'react'
import { useClickOutside } from '../hooks/useClickOutside'

interface PopoverContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLDivElement>
  contentRef: React.RefObject<HTMLDivElement>
}

const PopoverContext = createContext<PopoverContextValue | null>(null)

export interface PopoverProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export const Popover: React.FC<PopoverProps> = ({
  open: openProp,
  onOpenChange,
  children,
}) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp !== undefined ? openProp : internalOpen
  
  const triggerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const setOpen = useCallback((newOpen: boolean) => {
    if (openProp === undefined) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }, [openProp, onOpenChange])

  // Close on click outside
  useClickOutside(contentRef, (e) => {
    if (!triggerRef.current?.contains(e.target as Node)) {
      setOpen(false)
    }
  })

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  )
}

Popover.displayName = 'Popover'

// PopoverTrigger
export interface PopoverTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

export const PopoverTrigger: React.FC<PopoverTriggerProps> = ({ children }) => {
  const context = useContext(PopoverContext)
  if (!context) throw new Error('PopoverTrigger must be used within Popover')

  const { open, setOpen, triggerRef } = context

  return (
    <div
      ref={triggerRef}
      onClick={() => setOpen(!open)}
      className="inline-block"
    >
      {children}
    </div>
  )
}

PopoverTrigger.displayName = 'PopoverTrigger'

// PopoverContent
export interface PopoverContentProps {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
}

const alignClasses = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
}

const sideClasses = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
  left: 'right-full mr-2',
  right: 'left-full ml-2',
}

export const PopoverContent: React.FC<PopoverContentProps> = ({
  children,
  className = '',
  align = 'center',
  side = 'bottom',
}) => {
  const context = useContext(PopoverContext)
  if (!context) throw new Error('PopoverContent must be used within Popover')

  const { open, setOpen, contentRef } = context

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }, [setOpen])

  if (!open) return null

  return (
    <div
      ref={contentRef}
      role="dialog"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      className={`absolute z-50 min-w-[200px] p-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg ${sideClasses[side]} ${alignClasses[align]} ${className}`.trim()}
    >
      {children}
    </div>
  )
}

PopoverContent.displayName = 'PopoverContent'
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run Popover
```

Expected: PASS

- [ ] **Step 5: 创建 Storybook stories**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Popover, PopoverTrigger, PopoverContent } from './Popover'
import { Button } from '../Button/Button'

const meta: Meta<typeof Popover> = {
  title: 'v2/Popover',
  component: Popover,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Popover>

export const Default: Story = {
  render: () => (
    <div className="p-20">
      <Popover>
        <PopoverTrigger>
          <Button>Open Popover</Button>
        </PopoverTrigger>
        <PopoverContent>
          <h4 className="font-medium mb-2">Popover Title</h4>
          <p className="text-sm text-[var(--text-secondary)]">
            This is a popover with custom content. You can put any content here.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  ),
}

export const AlignStart: Story = {
  render: () => (
    <div className="p-20">
      <Popover>
        <PopoverTrigger>
          <Button>Align Start</Button>
        </PopoverTrigger>
        <PopoverContent align="start">
          <p className="text-sm">Aligned to the start</p>
        </PopoverContent>
      </Popover>
    </div>
  ),
}

export const AlignEnd: Story = {
  render: () => (
    <div className="p-20 flex justify-end">
      <Popover>
        <PopoverTrigger>
          <Button>Align End</Button>
        </PopoverTrigger>
        <PopoverContent align="end">
          <p className="text-sm">Aligned to the end</p>
        </PopoverContent>
      </Popover>
    </div>
  ),
}
```

- [ ] **Step 6: 提交代码**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
git add src/components/v2/Popover/
git commit -m "feat(v2): add Popover component"
```

---

### Task 8: Dropdown Menu 下拉菜单组件

**Files:**
- Create: `frontend/src/components/v2/DropdownMenu/DropdownMenu.tsx`
- Create: `frontend/src/components/v2/DropdownMenu/DropdownMenu.test.tsx`
- Create: `frontend/src/components/v2/DropdownMenu/DropdownMenu.stories.tsx`

**Design:** 操作用下拉菜单
- 支持菜单项：普通、禁用、带图标、分隔线、子标题分组
- 点击外部关闭，ESC 关闭
- 键盘导航：↑↓ Enter Esc
- 默认自动关闭，可配置 `closeOnSelect`

- [ ] **Step 1: 写测试文件**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from './DropdownMenu'

describe('DropdownMenu', () => {
  it('renders trigger correctly', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    
    expect(screen.getByText('Open Menu')).toBeInTheDocument()
  })

  it('opens menu when trigger is clicked', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button>Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Menu Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    
    await fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Menu Item')).toBeInTheDocument()
  })

  it('calls onSelect and closes when item is clicked', async () => {
    const onSelect = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button>Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => onSelect('item1')}>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    
    await fireEvent.click(screen.getByText('Open'))
    await fireEvent.click(screen.getByText('Item 1'))
    
    expect(onSelect).toHaveBeenCalledWith('item1')
    await waitFor(() => {
      expect(screen.queryByText('Item 1')).not.toBeInTheDocument()
    })
  })

  it('does not close when closeOnSelect is false', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button>Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem closeOnSelect={false}>Stay Open</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    
    await fireEvent.click(screen.getByText('Open'))
    await fireEvent.click(screen.getByText('Stay Open'))
    
    expect(screen.getByText('Stay Open')).toBeInTheDocument()
  })

  it('does not trigger disabled items', async () => {
    const onSelect = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button>Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled onSelect={onSelect}>Disabled Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    
    await fireEvent.click(screen.getByText('Open'))
    await fireEvent.click(screen.getByText('Disabled Item'))
    
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('renders separator correctly', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button>Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Item 2</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    
    await fireEvent.click(screen.getByText('Open'))
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('renders label and group correctly', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button>Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Group Title</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    
    await fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Group Title')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run DropdownMenu
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 实现 DropdownMenu 组件**

```tsx
import React, { createContext, useContext, useState, useRef, useCallback } from 'react'
import { useClickOutside } from '../hooks/useClickOutside'

interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLDivElement>
  contentRef: React.RefObject<HTMLDivElement>
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null)

export interface DropdownMenuProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  open: openProp,
  onOpenChange,
  children,
}) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp !== undefined ? openProp : internalOpen
  
  const triggerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const setOpen = useCallback((newOpen: boolean) => {
    if (openProp === undefined) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }, [openProp, onOpenChange])

  // Close on click outside
  useClickOutside(contentRef, (e) => {
    if (!triggerRef.current?.contains(e.target as Node)) {
      setOpen(false)
    }
  })

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className="relative inline-block">{children}</div>
    </DropdownMenuContext.Provider>
  )
}

DropdownMenu.displayName = 'DropdownMenu'

// DropdownMenuTrigger
export interface DropdownMenuTriggerProps {
  children: React.ReactNode
}

export const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({ children }) => {
  const context = useContext(DropdownMenuContext)
  if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu')

  const { open, setOpen, triggerRef } = context

  return (
    <div
      ref={triggerRef}
      onClick={() => setOpen(!open)}
      className="inline-block"
    >
      {children}
    </div>
  )
}

DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'

// DropdownMenuContent
export interface DropdownMenuContentProps {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
}

const alignClasses = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
}

export const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({
  children,
  className = '',
  align = 'start',
}) => {
  const context = useContext(DropdownMenuContext)
  if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu')

  const { open, setOpen, contentRef } = context

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = Array.from(
      contentRef.current?.querySelectorAll('[role="menuitem"]:not([data-disabled="true"])') || []
    )
    const currentIndex = items.findIndex(item => document.activeElement === item)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = (currentIndex + 1) % items.length
      ;(items[nextIndex] as HTMLElement)?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIndex = (currentIndex - 1 + items.length) % items.length
      ;(items[prevIndex] as HTMLElement)?.focus()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }, [contentRef, setOpen])

  if (!open) return null

  return (
    <div
      ref={contentRef}
      role="menu"
      onKeyDown={handleKeyDown}
      className={`absolute z-50 min-w-[160px] py-1 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg top-full mt-1 ${alignClasses[align]} ${className}`.trim()}
    >
      {children}
    </div>
  )
}

DropdownMenuContent.displayName = 'DropdownMenuContent'

// DropdownMenuItem
export interface DropdownMenuItemProps {
  children: React.ReactNode
  disabled?: boolean
  onSelect?: () => void
  closeOnSelect?: boolean
  className?: string
}

export const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({
  children,
  disabled = false,
  onSelect,
  closeOnSelect = true,
  className = '',
}) => {
  const context = useContext(DropdownMenuContext)
  if (!context) throw new Error('DropdownMenuItem must be used within DropdownMenu')

  const { setOpen } = context

  const handleClick = () => {
    if (!disabled) {
      onSelect?.()
      if (closeOnSelect) {
        setOpen(false)
      }
    }
  }

  return (
    <div
      role="menuitem"
      data-disabled={disabled}
      onClick={handleClick}
      tabIndex={disabled ? -1 : 0}
      className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-100 outline-none text-[var(--text-body)] hover:bg-[var(--bg-tertiary)] focus:bg-[var(--bg-tertiary)] ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`.trim()}
    >
      {children}
    </div>
  )
}

DropdownMenuItem.displayName = 'DropdownMenuItem'

// DropdownMenuSeparator
export interface DropdownMenuSeparatorProps {
  className?: string
}

export const DropdownMenuSeparator: React.FC<DropdownMenuSeparatorProps> = ({ className = '' }) => {
  return (
    <div
      role="separator"
      className={`h-px my-1 bg-[var(--border-subtle)] ${className}`.trim()}
    />
  )
}

DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

// DropdownMenuLabel
export interface DropdownMenuLabelProps {
  children: React.ReactNode
  className?: string
}

export const DropdownMenuLabel: React.FC<DropdownMenuLabelProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] ${className}`.trim()}>
      {children}
    </div>
  )
}

DropdownMenuLabel.displayName = 'DropdownMenuLabel'

// DropdownMenuGroup
export interface DropdownMenuGroupProps {
  children: React.ReactNode
  className?: string
}

export const DropdownMenuGroup: React.FC<DropdownMenuGroupProps> = ({ children, className = '' }) => {
  return (
    <div role="group" className={className}>
      {children}
    </div>
  )
}

DropdownMenuGroup.displayName = 'DropdownMenuGroup'
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run -- --run DropdownMenu
```

Expected: PASS

- [ ] **Step 5: 创建 Storybook stories**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from './DropdownMenu'
import { Button } from '../Button/Button'

const meta: Meta<typeof DropdownMenu> = {
  title: 'v2/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DropdownMenu>

export const Default: Story = {
  render: () => (
    <div className="p-20">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button>Open Menu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
          <DropdownMenuItem>Archive</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Delete (Disabled)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
}

export const WithGroups: Story = {
  render: () => (
    <div className="p-20">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button>Menu with Groups</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem>New Project</DropdownMenuItem>
            <DropdownMenuItem>New File</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
}

export const WithSelectHandler: Story = {
  render: () => (
    <div className="p-20">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button>Menu with Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => alert('Save clicked')}>Save</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => alert('Download clicked')}>Download</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
}
```

- [ ] **Step 6: 提交代码**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
git add src/components/v2/DropdownMenu/
git commit -m "feat(v2): add DropdownMenu component"
```

---

### Task 9: 更新导出文件

**Files:**
- Modify: `frontend/src/components/v2/index.ts`

- [ ] **Step 1: 更新 index.ts**

```typescript
export * from './Button/Button'
export * from './Card/Card'
export * from './Input/Input'
export * from './Badge/Badge'
export * from './Modal/Modal'
export * from './Tooltip/Tooltip'
export * from './Checkbox/Checkbox'
export * from './Radio/Radio'
export * from './Skeleton/Skeleton'
export * from './Progress/Progress'

// New components
export * from './Switch/Switch'
export * from './Alert/Alert'
export * from './Tabs/Tabs'
export * from './Avatar/Avatar'
export * from './Divider/Divider'
export * from './Select/Select'
export * from './Popover/Popover'
export * from './DropdownMenu/DropdownMenu'
export * from './hooks/useClickOutside'
export * from './hooks/useId'
```

- [ ] **Step 2: 运行全部测试**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run
```

Expected: All tests pass

- [ ] **Step 3: 提交代码**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
git add src/components/v2/index.ts
git commit -m "feat(v2): export all new components"
```

---

## 计划完成总结

 **新增 8 个组件：**
- Switch - 开关组件
- Alert - 警告提示
- Tabs - 标签页
- Avatar - 头像
- Divider - 分割线
- Select - 下拉选择（带搜索）
- Popover - 弹出框
- DropdownMenu - 下拉菜单

 **共享 Hooks：**
- useClickOutside
- useId

 **共计：** 8 个新组件 + 2 个 Hooks，约 2000 行代码

**设计原则：**
-  极简而高级
-  无冗余装饰
-  细腻的动效
-  完整的可访问性支持
-  遵循现有 v2 组件库风格
-  完整的测试覆盖
