# StoryForge UI Component Library v2 - Phase 2: Advanced Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 6 advanced v2 components with complete accessibility, animations, testing, and documentation - following the exact same pattern as Phase 1 components.

**Architecture:** v2 namespace - completely backward compatible, no breaking changes. All components use CSS Design Tokens from `tokens.css` and theme variables from `index.css`.

---

## File Structure Map

### New Files Created
```
frontend/src/components/v2/
├── Modal/
│   ├── Modal.tsx              # Component implementation
│   ├── Modal.test.tsx         # Unit tests
│   ├── Modal.stories.tsx      # Storybook docs
│   └── index.ts
├── Tooltip/
│   ├── Tooltip.tsx
│   ├── Tooltip.test.tsx
│   ├── Tooltip.stories.tsx
│   └── index.ts
├── Checkbox/
│   ├── Checkbox.tsx
│   ├── CheckboxGroup.tsx
│   ├── Checkbox.test.tsx
│   ├── Checkbox.stories.tsx
│   └── index.ts
├── Radio/
│   ├── Radio.tsx
│   ├── RadioGroup.tsx
│   ├── Radio.test.tsx
│   ├── Radio.stories.tsx
│   └── index.ts
├── Skeleton/
│   ├── Skeleton.tsx
│   ├── Skeleton.test.tsx
│   ├── Skeleton.stories.tsx
│   └── index.ts
└── Progress/
    ├── Progress.tsx
    ├── Progress.test.tsx
    ├── Progress.stories.tsx
    └── index.ts
```

### Existing Files Modified
- `frontend/src/components/v2/index.ts` - Add exports for all 6 components

---

## Phase 2: Advanced Components Implementation

---

### Task 1: Modal Component
**Requirements:** Backdrop, enter/exit animations, focus trap, keyboard navigation, close on backdrop click, header/content/footer slots, different sizes

**Files:**
- Create: `frontend/src/components/v2/Modal/Modal.tsx`
- Create: `frontend/src/components/v2/Modal/Modal.test.tsx`
- Create: `frontend/src/components/v2/Modal/Modal.stories.tsx`
- Create: `frontend/src/components/v2/Modal/index.ts`
- Modify: `frontend/src/components/v2/index.ts` (add export)

---

#### Step 1.1: Component API Design

```typescript
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  size?: ModalSize
  title?: React.ReactNode
  footer?: React.ReactNode
  closeOnBackdropClick?: boolean
  closeOnEsc?: boolean
  showCloseButton?: boolean
  children: React.ReactNode
  className?: string
}
```

---

#### Step 1.2: Write failing test for Modal basic render

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders correctly when isOpen is true', () => {
    render(<Modal isOpen onClose={vi.fn()}>Modal content</Modal>)
    expect(screen.getByText(/modal content/i)).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(<Modal isOpen={false} onClose={vi.fn()}>Modal content</Modal>)
    expect(screen.queryByText(/modal content/i)).not.toBeInTheDocument()
  })
})
```

**Run test:** `cd frontend && npm run test -- --run src/components/v2/Modal/Modal.test.tsx`
**Expected:** FAIL with "Cannot find module './Modal'"

---

#### Step 1.3: Write full Modal implementation

```tsx
import React, { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  size?: ModalSize
  title?: React.ReactNode
  footer?: React.ReactNode
  closeOnBackdropClick?: boolean
  closeOnEsc?: boolean
  showCloseButton?: boolean
  children: React.ReactNode
  className?: string
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-[90vw] max-h-[90vh]',
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  size = 'md',
  title,
  footer,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  children,
  className = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // Focus trap implementation
  const focusableElementsQuery =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return []
    return Array.from(modalRef.current.querySelectorAll(focusableElementsQuery)) as HTMLElement[]
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key === 'Tab') {
        const focusableElements = getFocusableElements()
        if (focusableElements.length === 0) {
          e.preventDefault()
          return
        }

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    },
    [closeOnEsc, onClose, getFocusableElements]
  )

  // Manage body scroll and focus
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)

      setTimeout(() => {
        const focusableElements = getFocusableElements()
        if (focusableElements.length > 0) {
          focusableElements[0].focus()
        }
      }, 0)
    } else {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
      previousActiveElement.current?.focus()
    }

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown, getFocusableElements])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="presentation"
    >
      {/* Backdrop with animation */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-[var(--duration-normal)] ease-[var(--ease-out)] ${isOpen ? 'opacity-50' : 'opacity-0'}`}
        aria-hidden="true"
      />

      {/* Modal panel with animation */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={`
          relative w-full ${sizeClasses[size]}
          bg-[var(--bg-secondary)] rounded-[var(--radius-lg)]
          shadow-[var(--shadow-2xl)]
          flex flex-col overflow-hidden
          transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]
          ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}
          ${className}
        `.trim()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
            {title && (
              <h2 id="modal-title" className="text-xl font-semibold text-[var(--text-primary)]">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 -mr-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-[var(--radius-sm)] transition-colors duration-[var(--duration-fast)]"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 px-6 py-4 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[var(--border-default)] flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

Modal.displayName = 'Modal'
```

---

#### Step 1.4: Run basic test to verify it passes

**Run:** `cd frontend && npm run test -- --run src/components/v2/Modal/Modal.test.tsx`
**Expected:** PASS "renders correctly when isOpen is true", "does not render when isOpen is false"

---

#### Step 1.5: Add complete test suite

Replace test file content with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

describe('Modal', () => {
  beforeEach(() => {
    // Reset body overflow before each test
    document.body.style.overflow = ''
  })

  it('renders correctly when isOpen is true', () => {
    render(<Modal isOpen onClose={vi.fn()}>Modal content</Modal>)
    expect(screen.getByText(/modal content/i)).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(<Modal isOpen={false} onClose={vi.fn()}>Modal content</Modal>)
    expect(screen.queryByText(/modal content/i)).not.toBeInTheDocument()
  })

  it('renders title correctly', () => {
    render(<Modal isOpen onClose={vi.fn()} title="Modal Title">Content</Modal>)
    expect(screen.getByRole('heading', { name: /modal title/i })).toBeInTheDocument()
  })

  it('renders footer correctly', () => {
    render(<Modal isOpen onClose={vi.fn()} footer={<button>Confirm</button>}>Content</Modal>)
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Modal isOpen onClose={onClose} showCloseButton>Content</Modal>)

    await user.click(screen.getByLabelText(/close modal/i))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Esc key is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Modal isOpen onClose={onClose}>Content</Modal>)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when Esc is pressed and closeOnEsc is false', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Modal isOpen onClose={onClose} closeOnEsc={false}>Content</Modal>)

    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('applies size class correctly', () => {
    const { rerender } = render(<Modal isOpen onClose={vi.fn()} size="sm">Small</Modal>)
    expect(screen.getByRole('dialog')).toHaveClass('max-w-sm')

    rerender(<Modal isOpen onClose={vi.fn()} size="lg">Large</Modal>)
    expect(screen.getByRole('dialog')).toHaveClass('max-w-lg')
  })

  it('has correct accessibility attributes', () => {
    render(<Modal isOpen onClose={vi.fn()} title="Test Title">Content</Modal>)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
  })

  it('does not show close button when showCloseButton is false', () => {
    render(<Modal isOpen onClose={vi.fn()} showCloseButton={false}>Content</Modal>)
    expect(screen.queryByLabelText(/close modal/i)).not.toBeInTheDocument()
  })

  it('focuses first focusable element when opened', async () => {
    render(
      <Modal isOpen onClose={vi.fn()}>
        <input type="text" data-testid="input" />
      </Modal>
    )
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.getByTestId('input')).toHaveFocus()
  })
})
```

---

#### Step 1.6: Run all tests

**Run:** `cd frontend && npm run test -- --run src/components/v2/Modal/Modal.test.tsx`
**Expected:** All 11 tests PASS

---

#### Step 1.7: Create Modal index export

```typescript
export * from './Modal'
```

---

#### Step 1.8: Create Modal stories

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from '../Button'

const meta: Meta<typeof Modal> = {
  title: 'v2/Modal',
  component: Modal,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg', 'xl', 'full'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Modal>

const ModalDemo = (args: any) => {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  )
}

export const Default: Story = {
  render: (args) => <ModalDemo {...args} />,
  args: {
    title: 'Modal Title',
    children: 'This is the modal content. You can put any React components here.',
    footer: (
      <>
        <Button variant="secondary">Cancel</Button>
        <Button>Confirm</Button>
      </>
    ),
  },
}

export const Small: Story = {
  render: (args) => <ModalDemo {...args} />,
  args: {
    size: 'sm',
    title: 'Small Modal',
    children: 'This is a small modal.',
  },
}

export const Large: Story = {
  render: (args) => <ModalDemo {...args} />,
  args: {
    size: 'lg',
    title: 'Large Modal',
    children: 'This is a large modal with more content space.',
  },
}

export const WithoutHeader: Story = {
  render: (args) => <ModalDemo {...args} />,
  args: {
    title: undefined,
    showCloseButton: false,
    children: 'This modal has no header. Click outside to close.',
  },
}

export const WithLongContent: Story = {
  render: (args) => <ModalDemo {...args} />,
  args: {
    title: 'Long Content Modal',
    children: (
      <div>
        {Array.from({ length: 20 }).map((_, i) => (
          <p key={i} className="mb-4">
            This is paragraph {i + 1} of long content. The modal will scroll when content exceeds its height.
          </p>
        ))}
      </div>
    ),
  },
}
```

---

#### Step 1.9: Update v2 barrel export

Add to `v2/index.ts`:

```typescript
export * from './Modal'
```

---

#### Step 1.10: Commit Modal component

```bash
git add src/components/v2/Modal/*
git add src/components/v2/index.ts
git commit -m "feat: add Modal component v2 with focus trap and animations"
```

---

### Task 2: Tooltip Component
**Requirements:** Positioning (top, right, bottom, left), show/hide delay, accessibility attributes, support for hover and focus triggers

**Files:**
- Create: `frontend/src/components/v2/Tooltip/Tooltip.tsx`
- Create: `frontend/src/components/v2/Tooltip/Tooltip.test.tsx`
- Create: `frontend/src/components/v2/Tooltip/Tooltip.stories.tsx`
- Create: `frontend/src/components/v2/Tooltip/index.ts`
- Modify: `frontend/src/components/v2/index.ts` (add export)

---

#### Step 2.1: Component API Design

```typescript
export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left'

export interface TooltipProps {
  content: React.ReactNode
  placement?: TooltipPlacement
  delay?: number
  showDelay?: number
  hideDelay?: number
  disabled?: boolean
  children: React.ReactElement
  className?: string
}
```

---

#### Step 2.2: Write failing test for Tooltip basic render

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('renders children correctly', () => {
    render(<Tooltip content="Tooltip text"><button>Hover me</button></Tooltip>)
    expect(screen.getByRole('button', { name: /hover me/i })).toBeInTheDocument()
  })
})
```

**Run test:** `cd frontend && npm run test -- --run src/components/v2/Tooltip/Tooltip.test.tsx`
**Expected:** FAIL with "Cannot find module './Tooltip'"

---

#### Step 2.3: Write full Tooltip implementation

```tsx
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left'

export interface TooltipProps {
  content: React.ReactNode
  placement?: TooltipPlacement
  delay?: number
  showDelay?: number
  hideDelay?: number
  disabled?: boolean
  children: React.ReactElement
  className?: string
}

const placementStyles: Record<TooltipPlacement, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
}

const arrowPlacementStyles: Record<TooltipPlacement, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-[var(--bg-tertiary)]',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-[var(--bg-tertiary)]',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[var(--bg-tertiary)]',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-[var(--bg-tertiary)]',
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  placement = 'top',
  delay = 0,
  showDelay,
  hideDelay,
  disabled = false,
  children,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const childRef = useRef<HTMLElement>(null)
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const actualShowDelay = showDelay ?? delay
  const actualHideDelay = hideDelay ?? delay

  const updatePosition = useCallback(() => {
    if (childRef.current) {
      const rect = childRef.current.getBoundingClientRect()
      setTooltipPosition({
        top: rect.top + rect.height / 2,
        left: rect.left + rect.width / 2,
      })
    }
  }, [])

  const clearTimeouts = useCallback(() => {
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current)
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
  }, [])

  const handleShow = useCallback(() => {
    clearTimeouts()
    updatePosition()
    showTimeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, actualShowDelay)
  }, [actualShowDelay, clearTimeouts, updatePosition])

  const handleHide = useCallback(() => {
    clearTimeouts()
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false)
    }, actualHideDelay)
  }, [actualHideDelay, clearTimeouts])

  useEffect(() => {
    return () => clearTimeouts()
  }, [clearTimeouts])

  if (disabled) {
    return children
  }

  const child = React.Children.only(children)
  const clonedChild = React.cloneElement(child as React.ReactElement, {
    ref: childRef,
    onMouseEnter: handleShow,
    onMouseLeave: handleHide,
    onFocus: handleShow,
    onBlur: handleHide,
    'aria-describedby': isVisible ? 'tooltip' : undefined,
  })

  const tooltip = isVisible && (
    <div
      id="tooltip"
      role="tooltip"
      className={`
        fixed z-50 px-3 py-2 text-sm
        bg-[var(--bg-tertiary)] text-[var(--text-primary)]
        rounded-[var(--radius-sm)] shadow-[var(--shadow-md)]
        pointer-events-none
        transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out)]
        ${placementStyles[placement]}
        ${className}
      `.trim()}
      style={{
        top: tooltipPosition.top,
        left: tooltipPosition.left,
      }}
    >
      {content}
      {/* Arrow */}
      <div
        className={`absolute w-0 h-0 border-4 border-transparent ${arrowPlacementStyles[placement]}`}
      />
    </div>
  )

  return (
    <>
      {clonedChild}
      {tooltip && createPortal(tooltip, document.body)}
    </>
  )
}

Tooltip.displayName = 'Tooltip'
```

---

#### Step 2.4: Run basic test to verify it passes

**Run:** `cd frontend && npm run test -- --run src/components/v2/Tooltip/Tooltip.test.tsx`
**Expected:** PASS "renders children correctly"

---

#### Step 2.5: Add complete test suite

Replace test file content with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('renders children correctly', () => {
    render(<Tooltip content="Tooltip text"><button>Hover me</button></Tooltip>)
    expect(screen.getByRole('button', { name: /hover me/i })).toBeInTheDocument()
  })

  it('shows tooltip on hover', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Tooltip content="Tooltip text"><button>Hover me</button></Tooltip>)

    await user.hover(screen.getByRole('button'))
    vi.runAllTimers()

    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Tooltip text')
  })

  it('hides tooltip on mouse leave', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Tooltip content="Tooltip text"><button>Hover me</button></Tooltip>)

    await user.hover(screen.getByRole('button'))
    vi.runAllTimers()
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    await user.unhover(screen.getByRole('button'))
    vi.runAllTimers()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('does not show tooltip when disabled', async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <Tooltip content="Tooltip text" disabled>
        <button>Hover me</button>
      </Tooltip>
    )

    await user.hover(screen.getByRole('button'))
    vi.runAllTimers()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('applies delay correctly', async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <Tooltip content="Tooltip text" showDelay={500}>
        <button>Hover me</button>
      </Tooltip>
    )

    await user.hover(screen.getByRole('button'))
    vi.advanceTimersByTime(100)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    vi.advanceTimersByTime(400)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('shows tooltip on focus', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Tooltip content="Tooltip text"><button>Hover me</button></Tooltip>)

    await user.tab()
    vi.runAllTimers()

    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('has correct accessibility attributes', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Tooltip content="Tooltip text"><button>Hover me</button></Tooltip>)

    const button = screen.getByRole('button')
    expect(button).not.toHaveAttribute('aria-describedby')

    await user.hover(button)
    vi.runAllTimers()

    expect(button).toHaveAttribute('aria-describedby', 'tooltip')
  })
})
```

---

#### Step 2.6: Run all tests

**Run:** `cd frontend && npm run test -- --run src/components/v2/Tooltip/Tooltip.test.tsx`
**Expected:** All 7 tests PASS

---

#### Step 2.7: Create Tooltip index export

```typescript
export * from './Tooltip'
```

---

#### Step 2.8: Create Tooltip stories

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Tooltip } from './Tooltip'
import { Button } from '../Button'

const meta: Meta<typeof Tooltip> = {
  title: 'v2/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  argTypes: {
    placement: {
      control: 'radio',
      options: ['top', 'right', 'bottom', 'left'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Tooltip>

export const Default: Story = {
  args: {
    content: 'This is a tooltip',
    children: <Button>Hover me</Button>,
  },
}

export const Top: Story = {
  args: {
    placement: 'top',
    content: 'Tooltip on top',
    children: <Button>Top Placement</Button>,
  },
}

export const Bottom: Story = {
  args: {
    placement: 'bottom',
    content: 'Tooltip on bottom',
    children: <Button>Bottom Placement</Button>,
  },
}

export const Right: Story = {
  args: {
    placement: 'right',
    content: 'Tooltip on right',
    children: <Button>Right Placement</Button>,
  },
}

export const Left: Story = {
  args: {
    placement: 'left',
    content: 'Tooltip on left',
    children: <Button>Left Placement</Button>,
  },
}

export const WithDelay: Story = {
  args: {
    showDelay: 500,
    hideDelay: 200,
    content: 'Tooltip with 500ms show delay',
    children: <Button>Hover (delayed)</Button>,
  },
}

export const AllPlacements: Story = {
  render: () => (
    <div className="flex flex-wrap gap-8 p-12 justify-center items-center">
      <Tooltip placement="top" content="Top tooltip">
        <Button variant="secondary">Top</Button>
      </Tooltip>
      <Tooltip placement="right" content="Right tooltip">
        <Button variant="secondary">Right</Button>
      </Tooltip>
      <Tooltip placement="bottom" content="Bottom tooltip">
        <Button variant="secondary">Bottom</Button>
      </Tooltip>
      <Tooltip placement="left" content="Left tooltip">
        <Button variant="secondary">Left</Button>
      </Tooltip>
    </div>
  ),
}
```

---

#### Step 2.9: Update v2 barrel export

Add to `v2/index.ts`:

```typescript
export * from './Tooltip'
```

---

#### Step 2.10: Commit Tooltip component

```bash
git add src/components/v2/Tooltip/*
git add src/components/v2/index.ts
git commit -m "feat: add Tooltip component v2 with positioning and delays"
```

---

### Task 3: Checkbox + CheckboxGroup Component
**Requirements:** Indeterminate state support, disabled state, CheckboxGroup for form handling, label alignment options

**Files:**
- Create: `frontend/src/components/v2/Checkbox/Checkbox.tsx`
- Create: `frontend/src/components/v2/Checkbox/CheckboxGroup.tsx`
- Create: `frontend/src/components/v2/Checkbox/Checkbox.test.tsx`
- Create: `frontend/src/components/v2/Checkbox/Checkbox.stories.tsx`
- Create: `frontend/src/components/v2/Checkbox/index.ts`
- Modify: `frontend/src/components/v2/index.ts` (add export)

---

#### Step 3.1: Component API Design

```typescript
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
  indeterminate?: boolean
  labelPosition?: 'left' | 'right'
  error?: boolean
  errorMessage?: string
}

export interface CheckboxGroupProps {
  value?: string[]
  onChange?: (value: string[]) => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}
```

---

#### Step 3.2: Write failing test for Checkbox basic render

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('renders correctly with label', () => {
    render(<Checkbox label="Accept terms" />)
    expect(screen.getByLabelText(/accept terms/i)).toBeInTheDocument()
  })
})
```

**Run test:** `cd frontend && npm run test -- --run src/components/v2/Checkbox/Checkbox.test.tsx`
**Expected:** FAIL with "Cannot find module './Checkbox'"

---

#### Step 3.3: Write full Checkbox implementation

```tsx
import React, { forwardRef, useEffect, useRef, createContext, useContext, useCallback } from 'react'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
  indeterminate?: boolean
  labelPosition?: 'left' | 'right'
  error?: boolean
  errorMessage?: string
}

interface CheckboxGroupContextValue {
  value: string[]
  onChange: (value: string) => void
  disabled: boolean
}

const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null)

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      indeterminate = false,
      labelPosition = 'right',
      error = false,
      errorMessage,
      disabled = false,
      checked,
      onChange,
      value,
      className = '',
      ...props
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const groupContext = useContext(CheckboxGroupContext)

    // Handle indeterminate state
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate
      }
    }, [indeterminate])

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (groupContext && value && typeof value === 'string') {
          groupContext.onChange(value)
        } else if (onChange) {
          onChange(e)
        }
      },
      [groupContext, value, onChange]
    )

    const isChecked = groupContext && value ? groupContext.value.includes(value as string) : checked
    const isDisabled = disabled || groupContext?.disabled

    const checkboxClasses = `
      relative w-5 h-5 flex-shrink-0
      appearance-none rounded-[var(--radius-sm)]
      border-2 transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)]
      focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2
      ${error ? 'border-red-500' : 'border-[var(--border-strong)]'}
      ${isChecked ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]' : 'bg-[var(--bg-secondary)]'}
      ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
      ${!isDisabled && !isChecked ? 'hover:border-[var(--accent-primary)]' : ''}
    `.trim()

    const checkIcon = isChecked && (
      <svg className="absolute inset-0 w-full h-full text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    )

    const indeterminateIcon = indeterminate && (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-0.5 bg-white rounded-sm" />
    )

    const checkbox = (
      <div className="relative inline-block">
        <input
          ref={(el) => {
            ;(inputRef.current as any) = el
            if (typeof ref === 'function') ref(el)
            else if (ref) (ref as any).current = el
          }}
          type="checkbox"
          checked={isChecked}
          disabled={isDisabled}
          onChange={handleChange}
          value={value}
          className={`${checkboxClasses} ${className}`}
          {...props}
        />
        {checkIcon}
        {indeterminateIcon}
      </div>
    )

    const labelElement = label && (
      <span
        className={`
          text-[var(--text-body)]
          ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          select-none
        `.trim()}
      >
        {label}
      </span>
    )

    return (
      <div className="flex flex-col gap-1">
        <label
          className={`inline-flex items-center gap-2.5 ${labelPosition === 'left' ? 'flex-row-reverse justify-end' : ''}`}
        >
          {checkbox}
          {labelElement}
        </label>
        {error && errorMessage && <p className="text-sm text-red-500 ml-7">{errorMessage}</p>}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'
```

---

#### Step 3.4: Write CheckboxGroup implementation

```tsx
import React, { useState, useCallback } from 'react'
import { Checkbox } from './Checkbox'

interface CheckboxGroupContextValue {
  value: string[]
  onChange: (value: string) => void
  disabled: boolean
}

const CheckboxGroupContext = React.createContext<CheckboxGroupContextValue | null>(null)

export interface CheckboxGroupProps {
  value?: string[]
  onChange?: (value: string[]) => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  value: controlledValue,
  onChange,
  disabled = false,
  children,
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState<string[]>([])
  const value = controlledValue ?? internalValue

  const handleChange = useCallback(
    (itemValue: string) => {
      const newValue = value.includes(itemValue)
        ? value.filter((v) => v !== itemValue)
        : [...value, itemValue]

      if (onChange) {
        onChange(newValue)
      } else {
        setInternalValue(newValue)
      }
    },
    [value, onChange]
  )

  return (
    <CheckboxGroupContext.Provider value={{ value, onChange: handleChange, disabled }}>
      <div className={`flex flex-col gap-3 ${className}`}>{children}</div>
    </CheckboxGroupContext.Provider>
  )
}

CheckboxGroup.displayName = 'CheckboxGroup'
```

---

#### Step 3.5: Run basic test to verify it passes

**Run:** `cd frontend && npm run test -- --run src/components/v2/Checkbox/Checkbox.test.tsx`
**Expected:** PASS "renders correctly with label"

---

#### Step 3.6: Add complete test suite

Replace test file content with:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox } from './Checkbox'
import { CheckboxGroup } from './CheckboxGroup'

describe('Checkbox', () => {
  it('renders correctly with label', () => {
    render(<Checkbox label="Accept terms" />)
    expect(screen.getByLabelText(/accept terms/i)).toBeInTheDocument()
  })

  it('renders without label', () => {
    render(<Checkbox aria-label="checkbox" />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('calls onChange when clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Checkbox label="Click me" onChange={onChange} />)

    await user.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Checkbox label="Disabled" disabled />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('shows error message when error is true', () => {
    render(<Checkbox label="Accept terms" error errorMessage="This field is required" />)
    expect(screen.getByText(/this field is required/i)).toBeInTheDocument()
  })

  it('renders label on left when labelPosition is left', () => {
    const { container } = render(<Checkbox label="Left Label" labelPosition="left" />)
    expect(container.firstChild?.firstChild).toHaveClass('flex-row-reverse')
  })

  it('renders as checked when checked prop is true', () => {
    render(<Checkbox label="Checked" checked />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })
})

describe('CheckboxGroup', () => {
  it('renders children correctly', () => {
    render(
      <CheckboxGroup>
        <Checkbox label="Option 1" value="1" />
        <Checkbox label="Option 2" value="2" />
      </CheckboxGroup>
    )
    expect(screen.getByLabelText(/option 1/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/option 2/i)).toBeInTheDocument()
  })

  it('handles multiple selections', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <CheckboxGroup onChange={onChange}>
        <Checkbox label="Option 1" value="1" />
        <Checkbox label="Option 2" value="2" />
        <Checkbox label="Option 3" value="3" />
      </CheckboxGroup>
    )

    await user.click(screen.getByLabelText(/option 1/i))
    expect(onChange).toHaveBeenCalledWith(['1'])

    await user.click(screen.getByLabelText(/option 2/i))
    expect(onChange).toHaveBeenCalledWith(['1', '2'])

    await user.click(screen.getByLabelText(/option 1/i))
    expect(onChange).toHaveBeenCalledWith(['2'])
  })

  it('supports controlled value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CheckboxGroup value={['1', '2']} onChange={onChange}>
        <Checkbox label="Option 1" value="1" />
        <Checkbox label="Option 2" value="2" />
        <Checkbox label="Option 3" value="3" />
      </CheckboxGroup>
    )

    expect(screen.getByLabelText(/option 1/i)).toBeChecked()
    expect(screen.getByLabelText(/option 2/i)).toBeChecked()
    expect(screen.getByLabelText(/option 3/i)).not.toBeChecked()

    await user.click(screen.getByLabelText(/option 3/i))
    expect(onChange).toHaveBeenCalledWith(['1', '2', '3'])
  })

  it('disables all checkboxes when group is disabled', () => {
    render(
      <CheckboxGroup disabled>
        <Checkbox label="Option 1" value="1" />
        <Checkbox label="Option 2" value="2" />
      </CheckboxGroup>
    )
    expect(screen.getByLabelText(/option 1/i)).toBeDisabled()
    expect(screen.getByLabelText(/option 2/i)).toBeDisabled()
  })
})
```

---

#### Step 3.7: Run all tests

**Run:** `cd frontend && npm run test -- --run src/components/v2/Checkbox/Checkbox.test.tsx`
**Expected:** All 12 tests PASS

---

#### Step 3.8: Create Checkbox index export

```typescript
export * from './Checkbox'
export * from './CheckboxGroup'
```

---

#### Step 3.9: Create Checkbox stories

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Checkbox } from './Checkbox'
import { CheckboxGroup } from './CheckboxGroup'

const meta: Meta<typeof Checkbox> = {
  title: 'v2/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    labelPosition: {
      control: 'radio',
      options: ['left', 'right'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Checkbox>

export const Default: Story = {
  args: {
    label: 'Accept terms and conditions',
  },
}

export const Checked: Story = {
  args: {
    label: 'Checked checkbox',
    checked: true,
  },
}

export const Indeterminate: Story = {
  args: {
    label: 'Indeterminate state',
    indeterminate: true,
  },
}

export const Disabled: Story = {
  args: {
    label: 'Disabled checkbox',
    disabled: true,
  },
}

export const DisabledChecked: Story = {
  args: {
    label: 'Disabled and checked',
    disabled: true,
    checked: true,
  },
}

export const WithError: Story = {
  args: {
    label: 'Accept terms',
    error: true,
    errorMessage: 'You must accept the terms to continue',
  },
}

export const LabelLeft: Story = {
  args: {
    label: 'Label on left',
    labelPosition: 'left',
  },
}

const GroupDemo = () => {
  const [value, setValue] = useState<string[]>(['apple'])
  return (
    <div>
      <p className="mb-4 text-[var(--text-secondary)]">Selected: {value.join(', ') || 'none'}</p>
      <CheckboxGroup value={value} onChange={setValue}>
        <Checkbox label="Apple" value="apple" />
        <Checkbox label="Banana" value="banana" />
        <Checkbox label="Cherry" value="cherry" />
        <Checkbox label="Disabled Option" value="disabled" disabled />
      </CheckboxGroup>
    </div>
  )
}

export const CheckboxGroupDemo: Story = {
  render: () => <GroupDemo />,
}

const SelectAllDemo = () => {
  const [items, setItems] = useState(['a', 'b'])
  const allItems = ['a', 'b', 'c']
  const isAllSelected = items.length === allItems.length
  const isIndeterminate = items.length > 0 && items.length < allItems.length

  const handleSelectAll = () => {
    setItems(isAllSelected ? [] : allItems)
  }

  const handleItemChange = (item: string) => {
    setItems(items.includes(item) ? items.filter((i) => i !== item) : [...items, item])
  }

  return (
    <div className="space-y-4">
      <Checkbox
        label="Select All"
        checked={isAllSelected}
        indeterminate={isIndeterminate}
        onChange={handleSelectAll}
      />
      <div className="ml-6 space-y-3">
        {allItems.map((item) => (
          <Checkbox
            key={item}
            label={`Option ${item.toUpperCase()}`}
            value={item}
            checked={items.includes(item)}
            onChange={() => handleItemChange(item)}
          />
        ))}
      </div>
    </div>
  )
}

export const SelectAllWithIndeterminate: Story = {
  render: () => <SelectAllDemo />,
}
```

---

#### Step 3.10: Update v2 barrel export

Add to `v2/index.ts`:

```typescript
export * from './Checkbox'
```

---

#### Step 3.11: Commit Checkbox component

```bash
git add src/components/v2/Checkbox/*
git add src/components/v2/index.ts
git commit -m "feat: add Checkbox and CheckboxGroup components v2 with indeterminate state"
```

---

### Task 4: Radio + RadioGroup Component
**Requirements:** Disabled state, RadioGroup for form handling, horizontal/vertical layout options, different sizes

**Files:**
- Create: `frontend/src/components/v2/Radio/Radio.tsx`
- Create: `frontend/src/components/v2/Radio/RadioGroup.tsx`
- Create: `frontend/src/components/v2/Radio/Radio.test.tsx`
- Create: `frontend/src/components/v2/Radio/Radio.stories.tsx`
- Create: `frontend/src/components/v2/Radio/index.ts`
- Modify: `frontend/src/components/v2/index.ts` (add export)

---

#### Step 4.1: Component API Design

```typescript
export type RadioSize = 'sm' | 'md' | 'lg'

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
  size?: RadioSize
  error?: boolean
}

export interface RadioGroupProps {
  value?: string
  onChange?: (value: string) => void
  name?: string
  direction?: 'horizontal' | 'vertical'
  disabled?: boolean
  children: React.ReactNode
  className?: string
}
```

---

#### Step 4.2: Write failing test for Radio basic render

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Radio } from './Radio'

describe('Radio', () => {
  it('renders correctly with label', () => {
    render(<Radio label="Option 1" name="test" value="1" />)
    expect(screen.getByLabelText(/option 1/i)).toBeInTheDocument()
  })
})
```

**Run test:** `cd frontend && npm run test -- --run src/components/v2/Radio/Radio.test.tsx`
**Expected:** FAIL with "Cannot find module './Radio'"

---

#### Step 4.3: Write full Radio implementation

```tsx
import React, { forwardRef, createContext, useContext, useId, useState, useCallback } from 'react'

export type RadioSize = 'sm' | 'md' | 'lg'

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
  size?: RadioSize
  error?: boolean
}

interface RadioGroupContextValue {
  value: string
  onChange: (value: string) => void
  name: string
  disabled: boolean
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null)

const sizeClasses: Record<RadioSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

const dotSizeClasses: Record<RadioSize, string> = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      label,
      size = 'md',
      error = false,
      disabled = false,
      checked,
      onChange,
      value,
      name,
      className = '',
      ...props
    },
    ref
  ) => {
    const groupContext = useContext(RadioGroupContext)
    const inputId = useId()

    const isChecked = groupContext && value ? groupContext.value === value : checked
    const isDisabled = disabled || groupContext?.disabled
    const radioName = groupContext?.name || name

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (groupContext && value && typeof value === 'string') {
          groupContext.onChange(value)
        } else if (onChange) {
          onChange(e)
        }
      },
      [groupContext, value, onChange]
    )

    const radioClasses = `
      relative ${sizeClasses[size]} flex-shrink-0
      appearance-none rounded-full
      border-2 transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)]
      focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2
      ${error ? 'border-red-500' : 'border-[var(--border-strong)]'}
      ${isChecked ? 'border-[var(--accent-primary)]' : 'bg-[var(--bg-secondary)]'}
      ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
      ${!isDisabled && !isChecked ? 'hover:border-[var(--accent-primary)]' : ''}
    `.trim()

    const checkDot = isChecked && (
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${dotSizeClasses[size]} rounded-full bg-[var(--accent-primary)]`}
      />
    )

    const radio = (
      <div className="relative inline-block">
        <input
          ref={ref}
          type="radio"
          id={inputId}
          checked={isChecked}
          disabled={isDisabled}
          onChange={handleChange}
          value={value}
          name={radioName}
          className={`${radioClasses} ${className}`}
          {...props}
        />
        {checkDot}
      </div>
    )

    const labelElement = label && (
      <span
        className={`
          text-[var(--text-body)]
          ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          select-none
        `.trim()}
      >
        {label}
      </span>
    )

    return (
      <label className="inline-flex items-center gap-2.5">
        {radio}
        {labelElement}
      </label>
    )
  }
)

Radio.displayName = 'Radio'
```

---

#### Step 4.4: Write RadioGroup implementation

```tsx
import React, { useState, useCallback, useId } from 'react'

interface RadioGroupContextValue {
  value: string
  onChange: (value: string) => void
  name: string
  disabled: boolean
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null)

export interface RadioGroupProps {
  value?: string
  onChange?: (value: string) => void
  name?: string
  direction?: 'horizontal' | 'vertical'
  disabled?: boolean
  children: React.ReactNode
  className?: string
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  value: controlledValue,
  onChange,
  name: customName,
  direction = 'vertical',
  disabled = false,
  children,
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState<string>('')
  const value = controlledValue ?? internalValue
  const generatedName = useId()
  const finalName = customName || generatedName

  const handleChange = useCallback(
    (newValue: string) => {
      if (onChange) {
        onChange(newValue)
      } else {
        setInternalValue(newValue)
      }
    },
    [onChange]
  )

  return (
    <RadioGroupContext.Provider value={{ value, onChange: handleChange, name: finalName, disabled }}>
      <div
        className={`flex ${direction === 'horizontal' ? 'flex-row gap-6' : 'flex-col gap-3'} ${className}`}
        role="radiogroup"
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

RadioGroup.displayName = 'RadioGroup'
```

---

#### Step 4.5: Run basic test to verify it passes

**Run:** `cd frontend && npm run test -- --run src/components/v2/Radio/Radio.test.tsx`
**Expected:** PASS "renders correctly with label"

---

#### Step 4.6: Add complete test suite

Replace test file content with:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Radio } from './Radio'
import { RadioGroup } from './RadioGroup'

describe('Radio', () => {
  it('renders correctly with label', () => {
    render(<Radio label="Option 1" name="test" value="1" />)
    expect(screen.getByLabelText(/option 1/i)).toBeInTheDocument()
  })

  it('calls onChange when clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Radio label="Click me" name="test" value="1" onChange={onChange} />)

    await user.click(screen.getByRole('radio'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Radio label="Disabled" name="test" value="1" disabled />)
    expect(screen.getByRole('radio')).toBeDisabled()
  })

  it('renders as checked when checked prop is true', () => {
    render(<Radio label="Checked" name="test" value="1" checked />)
    expect(screen.getByRole('radio')).toBeChecked()
  })

  it('applies size class correctly', () => {
    const { rerender } = render(<Radio label="Small" name="test" value="1" size="sm" />)
    expect(screen.getByRole('radio')).toHaveClass('w-4', 'h-4')

    rerender(<Radio label="Large" name="test" value="1" size="lg" />)
    expect(screen.getByRole('radio')).toHaveClass('w-6', 'h-6')
  })
})

describe('RadioGroup', () => {
  it('renders children correctly', () => {
    render(
      <RadioGroup name="test">
        <Radio label="Option 1" value="1" />
        <Radio label="Option 2" value="2" />
      </RadioGroup>
    )
    expect(screen.getByLabelText(/option 1/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/option 2/i)).toBeInTheDocument()
  })

  it('handles selection correctly', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <RadioGroup name="test" onChange={onChange}>
        <Radio label="Option 1" value="1" />
        <Radio label="Option 2" value="2" />
        <Radio label="Option 3" value="3" />
      </RadioGroup>
    )

    await user.click(screen.getByLabelText(/option 1/i))
    expect(onChange).toHaveBeenCalledWith('1')

    await user.click(screen.getByLabelText(/option 2/i))
    expect(onChange).toHaveBeenCalledWith('2')
  })

  it('supports controlled value', () => {
    render(
      <RadioGroup name="test" value="2">
        <Radio label="Option 1" value="1" />
        <Radio label="Option 2" value="2" />
        <Radio label="Option 3" value="3" />
      </RadioGroup>
    )

    expect(screen.getByLabelText(/option 1/i)).not.toBeChecked()
    expect(screen.getByLabelText(/option 2/i)).toBeChecked()
    expect(screen.getByLabelText(/option 3/i)).not.toBeChecked()
  })

  it('disables all radios when group is disabled', () => {
    render(
      <RadioGroup name="test" disabled>
        <Radio label="Option 1" value="1" />
        <Radio label="Option 2" value="2" />
      </RadioGroup>
    )
    expect(screen.getByLabelText(/option 1/i)).toBeDisabled()
    expect(screen.getByLabelText(/option 2/i)).toBeDisabled()
  })

  it('renders in horizontal direction', () => {
    const { container } = render(
      <RadioGroup name="test" direction="horizontal">
        <Radio label="Option 1" value="1" />
        <Radio label="Option 2" value="2" />
      </RadioGroup>
    )
    expect(container.firstChild).toHaveClass('flex-row')
  })

  it('has correct accessibility role', () => {
    render(
      <RadioGroup name="test">
        <Radio label="Option 1" value="1" />
      </RadioGroup>
    )
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })

  it('applies same name to all radios in group', () => {
    render(
      <RadioGroup name="group-name">
        <Radio label="Option 1" value="1" />
        <Radio label="Option 2" value="2" />
      </RadioGroup>
    )
    const radios = screen.getAllByRole('radio')
    expect(radios[0]).toHaveAttribute('name', 'group-name')
    expect(radios[1]).toHaveAttribute('name', 'group-name')
  })
})
```

---

#### Step 4.7: Run all tests

**Run:** `cd frontend && npm run test -- --run src/components/v2/Radio/Radio.test.tsx`
**Expected:** All 13 tests PASS

---

#### Step 4.8: Create Radio index export

```typescript
export * from './Radio'
export * from './RadioGroup'
```

---

#### Step 4.9: Create Radio stories

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Radio } from './Radio'
import { RadioGroup } from './RadioGroup'

const meta: Meta<typeof Radio> = {
  title: 'v2/Radio',
  component: Radio,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Radio>

export const Default: Story = {
  args: {
    label: 'Radio Option',
    name: 'demo',
    value: '1',
  },
}

export const Checked: Story = {
  args: {
    label: 'Checked Radio',
    name: 'demo',
    value: '1',
    checked: true,
  },
}

export const Disabled: Story = {
  args: {
    label: 'Disabled Radio',
    name: 'demo',
    value: '1',
    disabled: true,
  },
}

export const DisabledChecked: Story = {
  args: {
    label: 'Disabled and Checked',
    name: 'demo',
    value: '1',
    disabled: true,
    checked: true,
  },
}

export const Small: Story = {
  args: {
    label: 'Small Radio',
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    label: 'Large Radio',
    size: 'lg',
  },
}

const VerticalGroupDemo = () => {
  const [value, setValue] = useState('apple')
  return (
    <div>
      <p className="mb-4 text-[var(--text-secondary)]">Selected: {value}</p>
      <RadioGroup value={value} onChange={setValue} name="fruit">
        <Radio label="Apple" value="apple" />
        <Radio label="Banana" value="banana" />
        <Radio label="Cherry" value="cherry" />
        <Radio label="Disabled Option" value="disabled" disabled />
      </RadioGroup>
    </div>
  )
}

export const RadioGroupVertical: Story = {
  render: () => <VerticalGroupDemo />,
}

const HorizontalGroupDemo = () => {
  const [value, setValue] = useState('month')
  return (
    <div>
      <p className="mb-4 text-[var(--text-secondary)]">Selected: {value}</p>
      <RadioGroup value={value} onChange={setValue} name="period" direction="horizontal">
        <Radio label="Week" value="week" />
        <Radio label="Month" value="month" />
        <Radio label="Year" value="year" />
      </RadioGroup>
    </div>
  )
}

export const RadioGroupHorizontal: Story = {
  render: () => <HorizontalGroupDemo />,
}
```

---

#### Step 4.10: Update v2 barrel export

Add to `v2/index.ts`:

```typescript
export * from './Radio'
```

---

#### Step 4.11: Commit Radio component

```bash
git add src/components/v2/Radio/*
git add src/components/v2/index.ts
git commit -m "feat: add Radio and RadioGroup components v2 with size variants"
```

---

### Task 5: Skeleton Component
**Requirements:** Multiple variants (text, circle, rect), pulse animation, loading states, number of lines for text variant

**Files:**
- Create: `frontend/src/components/v2/Skeleton/Skeleton.tsx`
- Create: `frontend/src/components/v2/Skeleton/Skeleton.test.tsx`
- Create: `frontend/src/components/v2/Skeleton/Skeleton.stories.tsx`
- Create: `frontend/src/components/v2/Skeleton/index.ts`
- Modify: `frontend/src/components/v2/index.ts` (add export)

---

#### Step 5.1: Component API Design

```typescript
export type SkeletonVariant = 'text' | 'circle' | 'rect'

export interface SkeletonProps {
  variant?: SkeletonVariant
  width?: string | number
  height?: string | number
  lines?: number
  animate?: boolean
  className?: string
}
```

---

#### Step 5.2: Write failing test for Skeleton basic render

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renders correctly with default props', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })
})
```

**Run test:** `cd frontend && npm run test -- --run src/components/v2/Skeleton/Skeleton.test.tsx`
**Expected:** FAIL with "Cannot find module './Skeleton'"

---

#### Step 5.3: Write full Skeleton implementation

```tsx
import React from 'react'

export type SkeletonVariant = 'text' | 'circle' | 'rect'

export interface SkeletonProps {
  variant?: SkeletonVariant
  width?: string | number
  height?: string | number
  lines?: number
  animate?: boolean
  className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  lines = 1,
  animate = true,
  className = '',
}) => {
  const baseClasses = `
    bg-[var(--border-default)]
    ${animate ? 'animate-pulse' : ''}
  `.trim()

  const getDimensions = () => {
    const w = typeof width === 'number' ? `${width}px` : width
    const h = typeof height === 'number' ? `${height}px` : height

    switch (variant) {
      case 'circle':
        return {
          width: w || '40px',
          height: h || '40px',
          borderRadius: '50%',
        }
      case 'rect':
        return {
          width: w || '100%',
          height: h || '100px',
          borderRadius: 'var(--radius-md)',
        }
      case 'text':
      default:
        return {
          width: w || '100%',
          height: h || '16px',
          borderRadius: 'var(--radius-sm)',
        }
    }
  }

  const dimensions = getDimensions()

  const renderSkeleton = (index?: number) => {
    const isLastLine = variant === 'text' && lines > 1 && index === lines - 1
    const adjustedWidth = isLastLine
      ? typeof dimensions.width === 'number'
        ? dimensions.width * 0.6
        : '60%'
      : dimensions.width

    return (
      <div
        key={index}
        className={`${baseClasses} ${className}`.trim()}
        style={{
          width: adjustedWidth,
          height: dimensions.height,
          borderRadius: dimensions.borderRadius,
        }}
      />
    )
  }

  if (variant === 'text' && lines > 1) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => renderSkeleton(i))}
      </div>
    )
  }

  return renderSkeleton()
}

Skeleton.displayName = 'Skeleton'
```

---

#### Step 5.4: Run basic test to verify it passes

**Run:** `cd frontend && npm run test -- --run src/components/v2/Skeleton/Skeleton.test.tsx`
**Expected:** PASS "renders correctly with default props"

---

#### Step 5.5: Add complete test suite

Replace test file content with:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renders correctly with default props', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders text variant correctly', () => {
    const { container } = render(<Skeleton variant="text" />)
    expect(container.firstChild).toHaveStyle({ borderRadius: 'var(--radius-sm)' })
  })

  it('renders circle variant correctly', () => {
    const { container } = render(<Skeleton variant="circle" />)
    expect(container.firstChild).toHaveStyle({ borderRadius: '50%' })
  })

  it('renders rect variant correctly', () => {
    const { container } = render(<Skeleton variant="rect" />)
    expect(container.firstChild).toHaveStyle({ borderRadius: 'var(--radius-md)' })
  })

  it('applies custom width correctly', () => {
    const { container } = render(<Skeleton width={200} />)
    expect(container.firstChild).toHaveStyle({ width: '200px' })
  })

  it('applies custom height correctly', () => {
    const { container } = render(<Skeleton height={50} />)
    expect(container.firstChild).toHaveStyle({ height: '50px' })
  })

  it('renders multiple lines for text variant', () => {
    const { container } = render(<Skeleton variant="text" lines={3} />)
    expect(container.firstChild?.childNodes).toHaveLength(3)
  })

  it('applies animate-pulse class when animate is true', () => {
    const { container } = render(<Skeleton animate />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('does not apply animate-pulse class when animate is false', () => {
    const { container } = render(<Skeleton animate={false} />)
    expect(container.firstChild).not.toHaveClass('animate-pulse')
  })

  it('last line of multi-line text has shorter width', () => {
    const { container } = render(<Skeleton variant="text" lines={3} />)
    const lines = container.firstChild?.childNodes as NodeListOf<HTMLElement>
    expect(lines[2]).toHaveStyle({ width: '60%' })
  })

  it('applies custom className correctly', () => {
    const { container } = render(<Skeleton className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
```

---

#### Step 5.6: Run all tests

**Run:** `cd frontend && npm run test -- --run src/components/v2/Skeleton/Skeleton.test.tsx`
**Expected:** All 11 tests PASS

---

#### Step 5.7: Create Skeleton index export

```typescript
export * from './Skeleton'
```

---

#### Step 5.8: Create Skeleton stories

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Skeleton } from './Skeleton'

const meta: Meta<typeof Skeleton> = {
  title: 'v2/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'radio',
      options: ['text', 'circle', 'rect'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Skeleton>

export const Text: Story = {
  args: {
    variant: 'text',
    width: 300,
  },
}

export const TextMultipleLines: Story = {
  args: {
    variant: 'text',
    lines: 4,
    width: 400,
  },
}

export const Circle: Story = {
  args: {
    variant: 'circle',
    width: 80,
    height: 80,
  },
}

export const Rectangle: Story = {
  args: {
    variant: 'rect',
    width: 400,
    height: 200,
  },
}

export const WithoutAnimation: Story = {
  args: {
    variant: 'text',
    lines: 3,
    animate: false,
    width: 300,
  },
}

export const CardSkeleton: Story = {
  render: () => (
    <div className="w-80 p-6 bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] border border-[var(--border-default)]">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton variant="circle" width={48} height={48} />
        <div className="flex-1">
          <Skeleton variant="text" width="80%" height={16} />
          <div className="mt-1">
            <Skeleton variant="text" width="60%" height={14} />
          </div>
        </div>
      </div>
      <Skeleton variant="rect" height={120} className="mb-4" />
      <Skeleton variant="text" lines={3} />
    </div>
  ),
}

export const ListSkeleton: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton variant="circle" width={40} height={40} />
          <div className="flex-1">
            <Skeleton variant="text" width="70%" height={16} />
            <div className="mt-1">
              <Skeleton variant="text" width="50%" height={14} />
            </div>
          </div>
        </div>
      ))}
    </div>
  ),
}
```

---

#### Step 5.9: Update v2 barrel export

Add to `v2/index.ts`:

```typescript
export * from './Skeleton'
```

---

#### Step 5.10: Commit Skeleton component

```bash
git add src/components/v2/Skeleton/*
git add src/components/v2/index.ts
git commit -m "feat: add Skeleton component v2 with text, circle, and rect variants"
```

---

### Task 6: Progress Component
**Requirements:** Linear progress bar, circular progress indicator, different colors, support for indeterminate state

**Files:**
- Create: `frontend/src/components/v2/Progress/Progress.tsx`
- Create: `frontend/src/components/v2/Progress/Progress.test.tsx`
- Create: `frontend/src/components/v2/Progress/Progress.stories.tsx`
- Create: `frontend/src/components/v2/Progress/index.ts`
- Modify: `frontend/src/components/v2/index.ts` (add export)

---

#### Step 6.1: Component API Design

```typescript
export type ProgressVariant = 'linear' | 'circular'
export type ProgressColor = 'primary' | 'success' | 'warning' | 'error'

export interface ProgressProps {
  variant?: ProgressVariant
  value?: number
  color?: ProgressColor
  indeterminate?: boolean
  showLabel?: boolean
  size?: number
  thickness?: number
  className?: string
}
```

---

#### Step 6.2: Write failing test for Progress basic render

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Progress } from './Progress'

describe('Progress', () => {
  it('renders correctly with default props', () => {
    const { container } = render(<Progress value={50} />)
    expect(container.firstChild).toBeInTheDocument()
  })
})
```

**Run test:** `cd frontend && npm run test -- --run src/components/v2/Progress/Progress.test.tsx`
**Expected:** FAIL with "Cannot find module './Progress'"

---

#### Step 6.3: Write full Progress implementation

```tsx
import React from 'react'

export type ProgressVariant = 'linear' | 'circular'
export type ProgressColor = 'primary' | 'success' | 'warning' | 'error'

export interface ProgressProps {
  variant?: ProgressVariant
  value?: number
  color?: ProgressColor
  indeterminate?: boolean
  showLabel?: boolean
  size?: number
  thickness?: number
  className?: string
}

const colorClasses: Record<ProgressColor, string> = {
  primary: 'bg-[var(--accent-primary)]',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
}

const strokeColors: Record<ProgressColor, string> = {
  primary: '#5b7f6e',
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
}

export const Progress: React.FC<ProgressProps> = ({
  variant = 'linear',
  value = 0,
  color = 'primary',
  indeterminate = false,
  showLabel = false,
  size = 48,
  thickness = 4,
  className = '',
}) => {
  const clampedValue = Math.min(Math.max(value, 0), 100)

  if (variant === 'circular') {
    const radius = (size - thickness) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (clampedValue / 100) * circumference

    return (
      <div
        className={`relative inline-flex items-center justify-center ${className}`.trim()}
        style={{ width: size, height: size }}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <svg
          className={`${indeterminate ? 'animate-spin' : ''}`}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-default)"
            strokeWidth={thickness}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColors[color]}
            strokeWidth={thickness}
            strokeDasharray={circumference}
            strokeDashoffset={indeterminate ? 0 : offset}
            strokeLinecap="round"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              transition: 'stroke-dashoffset 0.3s ease',
            }}
          />
        </svg>
        {showLabel && !indeterminate && (
          <span className="absolute text-sm font-medium text-[var(--text-primary)]">
            {Math.round(clampedValue)}%
          </span>
        )}
      </div>
    )
  }

  // Linear variant
  return (
    <div
      className={`w-full relative ${className}`.trim()}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="w-full h-2 bg-[var(--border-default)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClasses[color]} ${indeterminate ? 'animate-indeterminate' : ''}`}
          style={{
            width: indeterminate ? '30%' : `${clampedValue}%`,
            marginLeft: indeterminate ? undefined : 0,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      {showLabel && !indeterminate && (
        <span className="absolute right-0 -top-5 text-xs text-[var(--text-secondary)]">
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  )
}

Progress.displayName = 'Progress'
```

---

#### Step 6.4: Run basic test to verify it passes

**Run:** `cd frontend && npm run test -- --run src/components/v2/Progress/Progress.test.tsx`
**Expected:** PASS "renders correctly with default props"

---

#### Step 6.5: Add complete test suite

Replace test file content with:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Progress } from './Progress'

describe('Progress', () => {
  it('renders correctly with default props', () => {
    const { container } = render(<Progress value={50} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders linear variant correctly', () => {
    const { container } = render(<Progress variant="linear" value={50} />)
    expect(container.firstChild).toHaveClass('w-full')
  })

  it('renders circular variant correctly', () => {
    const { container } = render(<Progress variant="circular" value={50} />)
    expect(container.firstChild?.firstChild?.nodeName).toBe('svg')
  })

  it('clamps value between 0 and 100', () => {
    const { rerender } = render(<Progress value={150} />)
    let bar = screen.getByRole('progressbar').querySelector('div > div')
    expect(bar).toHaveStyle({ width: '100%' })

    rerender(<Progress value={-50} />)
    bar = screen.getByRole('progressbar').querySelector('div > div')
    expect(bar).toHaveStyle({ width: '0%' })
  })

  it('applies color class correctly for linear', () => {
    const { rerender } = render(<Progress variant="linear" value={50} color="success" />)
    let bar = screen.getByRole('progressbar').querySelector('div > div')
    expect(bar).toHaveClass('bg-green-500')

    rerender(<Progress variant="linear" value={50} color="error" />)
    bar = screen.getByRole('progressbar').querySelector('div > div')
    expect(bar).toHaveClass('bg-red-500')
  })

  it('shows label when showLabel is true', () => {
    render(<Progress value={75} showLabel />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('does not show label when showLabel is false', () => {
    render(<Progress value={75} />)
    expect(screen.queryByText('75%')).not.toBeInTheDocument()
  })

  it('has correct accessibility attributes', () => {
    render(<Progress value={75} />)
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '75')
    expect(progressbar).toHaveAttribute('aria-valuemin', '0')
    expect(progressbar).toHaveAttribute('aria-valuemax', '100')
  })

  it('applies custom size to circular variant', () => {
    const { container } = render(<Progress variant="circular" value={50} size={80} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveStyle({ width: '80px', height: '80px' })
  })

  it('applies custom className correctly', () => {
    const { container } = render(<Progress value={50} className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('rounds label value to integer', () => {
    render(<Progress value={75.6} showLabel />)
    expect(screen.getByText('76%')).toBeInTheDocument()
  })
})
```

---

#### Step 6.6: Run all tests

**Run:** `cd frontend && npm run test -- --run src/components/v2/Progress/Progress.test.tsx`
**Expected:** All 11 tests PASS

---

#### Step 6.7: Create Progress index export

```typescript
export * from './Progress'
```

---

#### Step 6.8: Create Progress stories

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { useState, useEffect } from 'react'
import { Progress } from './Progress'

const meta: Meta<typeof Progress> = {
  title: 'v2/Progress',
  component: Progress,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'radio',
      options: ['linear', 'circular'],
    },
    color: {
      control: 'radio',
      options: ['primary', 'success', 'warning', 'error'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Progress>

export const Linear: Story = {
  args: {
    variant: 'linear',
    value: 60,
    className: 'w-80',
  },
}

export const LinearWithLabel: Story = {
  args: {
    variant: 'linear',
    value: 75,
    showLabel: true,
    className: 'w-80',
  },
}

export const LinearColors: Story = {
  render: () => (
    <div className="space-y-6 w-80">
      <div>
        <p className="mb-2 text-sm text-[var(--text-secondary)]">Primary</p>
        <Progress variant="linear" value={80} color="primary" />
      </div>
      <div>
        <p className="mb-2 text-sm text-[var(--text-secondary)]">Success</p>
        <Progress variant="linear" value={100} color="success" />
      </div>
      <div>
        <p className="mb-2 text-sm text-[var(--text-secondary)]">Warning</p>
        <Progress variant="linear" value={40} color="warning" />
      </div>
      <div>
        <p className="mb-2 text-sm text-[var(--text-secondary)]">Error</p>
        <Progress variant="linear" value={25} color="error" />
      </div>
    </div>
  ),
}

export const Circular: Story = {
  args: {
    variant: 'circular',
    value: 70,
    size: 80,
  },
}

export const CircularWithLabel: Story = {
  args: {
    variant: 'circular',
    value: 75,
    showLabel: true,
    size: 80,
  },
}

export const CircularSizes: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <Progress variant="circular" value={60} size={32} />
      <Progress variant="circular" value={70} size={48} />
      <Progress variant="circular" value={80} size={64} />
      <Progress variant="circular" value={90} size={96} />
    </div>
  ),
}

export const CircularColors: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <Progress variant="circular" value={75} color="primary" size={64} />
      <Progress variant="circular" value={100} color="success" size={64} />
      <Progress variant="circular" value={50} color="warning" size={64} />
      <Progress variant="circular" value={30} color="error" size={64} />
    </div>
  ),
}

const AnimatedDemo = () => {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 1))
    }, 100)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="space-y-8 w-80">
      <div>
        <p className="mb-4 text-[var(--text-secondary)]">Animated Progress</p>
        <Progress variant="linear" value={progress} showLabel />
      </div>
      <div className="flex gap-8 items-center">
        <Progress variant="circular" value={progress} showLabel size={80} />
        <Progress variant="circular" value={progress} showLabel size={80} color="success" />
      </div>
    </div>
  )
}

export const AnimatedProgress: Story = {
  render: () => <AnimatedDemo />,
}

export const FileUploadDemo: Story = {
  render: () => (
    <div className="w-96 p-6 bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] border border-[var(--border-default)]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-[var(--text-primary)]">document.pdf</span>
        <span className="text-sm text-[var(--text-secondary)]">75%</span>
      </div>
      <Progress variant="linear" value={75} color="primary" />
      <p className="mt-2 text-sm text-[var(--text-secondary)]">1.2 MB of 1.6 MB</p>
    </div>
  ),
}
```

---

#### Step 6.9: Update v2 barrel export

Add to `v2/index.ts`:

```typescript
export * from './Progress'
```

---

#### Step 6.10: Commit Progress component

```bash
git add src/components/v2/Progress/*
git add src/components/v2/index.ts
git commit -m "feat: add Progress component v2 with linear and circular variants"
```

---

## Phase 2 Completion Verification

### Task 7: Run All Component Tests

**Files:** None (verification only)

- [ ] **Step 1: Run all v2 component tests**

```bash
cd frontend && npm run test -- --run src/components/v2/
```

**Expected:** All tests pass (Modal:11, Tooltip:7, Checkbox:12, Radio:13, Skeleton:11, Progress:11 = 65 total)

- [ ] **Step 2: Verify v2/index.ts exports all components**

Final v2/index.ts should contain:

```typescript
export * from './Button'
export * from './Card'
export * from './Input'
export * from './Badge'
export * from './Modal'
export * from './Tooltip'
export * from './Checkbox'
export * from './Radio'
export * from './Skeleton'
export * from './Progress'
```

- [ ] **Step 3: Verify Storybook loads all components**

```bash
cd frontend && npm run storybook
```

Verify: All 10 component stories load in sidebar (Button, Card, Input, Badge, Modal, Tooltip, Checkbox, Radio, Skeleton, Progress)

---

## Phase 2 Complete!

This completes the implementation plan for **6 advanced v2 components**:
1.  **Modal** - With backdrop, animations, focus trap, and keyboard navigation
2.  **Tooltip** - With positioning, delays, and accessibility attributes
3.  **Checkbox + CheckboxGroup** - With indeterminate state and form handling
4.  **Radio + RadioGroup** - With horizontal/vertical layout and size variants
5.  **Skeleton** - With text, circle, and rect variants with pulse animation
6.  **Progress** - With linear and circular progress indicators

All components follow the same patterns as Phase 1:
- Design Tokens CSS variables for theming
- ForwardRef pattern for form elements
- TDD approach with full test coverage
- Storybook stories with autodocs
- Accessibility attributes
- Smooth animations and transitions
```

---
