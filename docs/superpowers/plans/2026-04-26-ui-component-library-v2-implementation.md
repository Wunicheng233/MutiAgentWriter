# StoryForge UI Component Library v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, enterprise-grade UI component library with 10 components, Design Tokens system, and Storybook documentation - all fully backward compatible with existing code.

**Architecture:** Incremental zero-risk refactoring. New components live in `v2/` namespace parallel to existing components. Gradual migration with no breaking changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, React Testing Library, Storybook 8

---

## File Structure Map

### New Files Created
```
frontend/src/components/v2/
├── themes/
│   ├── tokens.css              # Design Tokens CSS variables
│   └── index.ts
├── Button/
│   ├── Button.tsx              # Component implementation
│   ├── Button.test.tsx         # Unit tests
│   ├── Button.stories.tsx      # Storybook docs
│   └── index.ts
├── Card/
│   ├── Card.tsx
│   ├── Card.test.tsx
│   ├── Card.stories.tsx
│   └── index.ts
├── Input/
│   ├── Input.tsx
│   ├── Textarea.tsx
│   ├── Input.test.tsx
│   ├── Input.stories.tsx
│   └── index.ts
├── Badge/
│   ├── Badge.tsx
│   ├── Badge.test.tsx
│   ├── Badge.stories.tsx
│   └── index.ts
├── index.ts                    # v2 components barrel export
frontend/.storybook/
├── main.ts                     # Storybook config
└── preview.tsx                 # Storybook preview setup
```

### Existing Files Modified
- `frontend/src/index.css` - Import tokens.css (append, no changes to existing)
- `frontend/package.json` - Add Storybook dev dependencies (no conflict)

---

## Phase 1: Foundation & Infrastructure

### Task 1: Install Storybook Dependencies

**Files:**
- Modify: `frontend/package.json` (devDependencies section)

- [ ] **Step 1: Add Storybook dependencies to package.json**

Add to devDependencies (insert after existing entries, keep alphabetical order):
```json
"@storybook/addon-a11y": "^8.0.0",
"@storybook/addon-actions": "^8.0.0",
"@storybook/addon-controls": "^8.0.0",
"@storybook/addon-essentials": "^8.0.0",
"@storybook/addon-themes": "^8.0.0",
"@storybook/addon-viewport": "^8.0.0",
"@storybook/react": "^8.0.0",
"@storybook/react-vite": "^8.0.0",
"storybook": "^8.0.0",
```

Add to scripts:
```json
"storybook": "storybook dev -p 6006",
"build-storybook": "storybook build",
```

- [ ] **Step 2: Install dependencies**

Run: `cd frontend && npm install`
Expected: All packages install successfully, no errors

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add storybook 8.0 dependencies"
```

---

### Task 2: Configure Storybook

**Files:**
- Create: `frontend/.storybook/main.ts`
- Create: `frontend/.storybook/preview.tsx`

- [ ] **Step 1: Create Storybook main config**

```typescript
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/components/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-controls',
    '@storybook/addon-actions',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
    '@storybook/addon-viewport',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
}

export default config
```

- [ ] **Step 2: Create Storybook preview config**

```tsx
import '../src/index.css'

const preview: import('@storybook/react').Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
```

- [ ] **Step 3: Test Storybook starts**

Run: `cd frontend && npm run storybook`
Wait 30 seconds, verify: `Storybook 8.0.0 started` on port 6006

Press Ctrl+C to stop

- [ ] **Step 4: Commit**

```bash
git add .storybook/main.ts .storybook/preview.tsx
git commit -m "config: setup storybook 8.0"
```

---

### Task 3: Design Tokens CSS

**Files:**
- Create: `frontend/src/components/v2/themes/tokens.css`
- Create: `frontend/src/components/v2/themes/index.ts`
- Modify: `frontend/src/index.css` (append import at TOP)

- [ ] **Step 1: Create tokens.css with complete Design Tokens system**

```css
/* ========================================
   StoryForge Design Tokens v2
   ======================================== */

/* Spacing System (8px baseline) */
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}

/* Border Radius System */
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;
}

/* Elevation System (6 levels) */
:root {
  --shadow-xs: 0 1px 2px rgba(60, 40, 20, 0.03);
  --shadow-sm: 0 2px 8px rgba(60, 40, 20, 0.05);
  --shadow-md: 0 4px 16px rgba(60, 40, 20, 0.07);
  --shadow-lg: 0 8px 24px rgba(60, 40, 20, 0.1);
  --shadow-xl: 0 12px 32px rgba(60, 40, 20, 0.14);
  --shadow-2xl: 0 24px 48px rgba(60, 40, 20, 0.2);
}

/* Animation System */
:root {
  --ease-linear: linear;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 400ms;
  --duration-slowest: 500ms;
}

/* Typography System */
:root {
  --font-heading: 'Noto Serif SC', 'Crimson Pro', Georgia, serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;

  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 32px;

  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}

/* Respect user's motion preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Create themes barrel export**

```typescript
// Import the CSS tokens when this module is loaded
import './tokens.css'
```

- [ ] **Step 3: Import tokens in index.css**

Add at the VERY TOP of `frontend/src/index.css` (before @tailwind directives):
```css
@import './components/v2/themes/tokens.css';
```

- [ ] **Step 4: Verify CSS loads correctly**

Run: `cd frontend && npm run dev`
Open browser dev tools > Inspect element > Computed
Verify CSS variables like `--space-4` exist in :root

- [ ] **Step 5: Commit**

```bash
git add src/components/v2/themes/tokens.css
git add src/components/v2/themes/index.ts
git add src/index.css
git commit -m "feat: add design tokens system v2"
```

---

### Task 4: Create v2 Components Barrel Export

**Files:**
- Create: `frontend/src/components/v2/index.ts`

- [ ] **Step 1: Create barrel export file**

```typescript
export * from './Button'
export * from './Card'
export * from './Input'
export * from './Badge'
// Components added in Phase 2 will be exported here
```

- [ ] **Step 2: Commit**

```bash
git add src/components/v2/index.ts
git commit -m "feat: setup v2 components barrel export"
```

---

## Phase 2: Core Components (Phase 1 Complete - Ready for Production)

### Task 5: Button Component v2 (TDD Approach)

**Files:**
- Create: `frontend/src/components/v2/Button/Button.tsx`
- Create: `frontend/src/components/v2/Button/Button.test.tsx`
- Create: `frontend/src/components/v2/Button/Button.stories.tsx`
- Create: `frontend/src/components/v2/Button/index.ts`
- Modify: `frontend/src/components/v2/index.ts` (add export)

- [ ] **Step 1: Write failing test for Button basic render**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders correctly with default props', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- --run src/components/v2/Button/Button.test.tsx`
Expected: FAIL with "Cannot find module './Button'"

- [ ] **Step 3: Write minimal Button implementation**

```tsx
import React, { forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  children: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--accent-primary)] text-white hover:opacity-90',
  secondary: 'border border-[var(--border-default)] bg-white text-[var(--text-primary)] hover:border-[var(--accent-primary)]',
  tertiary: 'bg-transparent text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:bg-opacity-5',
  ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]',
  danger: 'bg-red-500 text-white hover:bg-red-600',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3 text-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    children,
    className = '',
    ...props
  }, ref) => {
    const baseClasses = `
      inline-flex items-center justify-center gap-2 font-medium
      rounded-[var(--radius-md)]
      transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]
      focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2
      disabled:cursor-not-allowed disabled:opacity-50
    `

    const hoverClasses = !disabled && !loading
      ? 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:translate-y-0 active:shadow-none'
      : ''

    const widthClass = fullWidth ? 'w-full' : ''

    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${hoverClasses} ${widthClass} ${className}`.trim()

    const Spinner = () => (
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    )

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={classes}
        {...props}
      >
        {loading && <Spinner />}
        {!loading && leftIcon}
        {children}
        {rightIcon}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- --run src/components/v2/Button/Button.test.tsx`
Expected: PASS "renders correctly with default props"

- [ ] **Step 5: Add complete test suite**

Replace test file content with:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders correctly with default props', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('applies variant correctly', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>)
    expect(screen.getByRole('button')).toHaveClass(/accent-primary/)

    rerender(<Button variant="danger">Danger</Button>)
    expect(screen.getByRole('button')).toHaveClass(/bg-red-500/)
  })

  it('applies size correctly', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button')).toHaveClass(/text-sm/)

    rerender(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button')).toHaveClass(/text-lg/)
  })

  it('shows spinner when loading is true', () => {
    render(<Button loading>Loading</Button>)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is disabled when loading is true', () => {
    render(<Button loading>Loading</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies fullWidth class correctly', () => {
    render(<Button fullWidth>Full Width</Button>)
    expect(screen.getByRole('button')).toHaveClass('w-full')
  })

  it('renders leftIcon correctly', () => {
    render(<Button leftIcon={<span data-testid="left-icon">←</span>}>With Icon</Button>)
    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
  })

  it('renders rightIcon correctly', () => {
    render(<Button rightIcon={<span data-testid="right-icon">→</span>}>With Icon</Button>)
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Click me</Button>)

    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button disabled onClick={onClick}>Disabled</Button>)

    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run all tests**

Run: `cd frontend && npm run test -- --run src/components/v2/Button/Button.test.tsx`
Expected: All 10 tests PASS

- [ ] **Step 7: Create Button index export**

```typescript
export * from './Button'
```

- [ ] **Step 8: Update v2 barrel export**

Add to `v2/index.ts`:
```typescript
export * from './Button'
```

- [ ] **Step 9: Create Button stories**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'v2/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary', 'ghost', 'danger'],
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {
  args: {
    children: 'Button',
  },
}

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
}

export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled',
  },
}

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: 'Full Width Button',
  },
}

export const WithIcons: Story = {
  args: {
    leftIcon: <span>←</span>,
    rightIcon: <span>→</span>,
    children: 'With Icons',
  },
}
```

- [ ] **Step 10: Verify Storybook displays Button component**

Run: `cd frontend && npm run storybook`
Verify: "v2/Button" appears in sidebar, all stories render correctly

- [ ] **Step 11: Commit**

```bash
git add src/components/v2/Button/*
git add src/components/v2/index.ts
git commit -m "feat: add Button component v2 with tests and stories"
```

---

### Task 6: Card Component v2 (TDD Approach)

**Files:**
- Create: `frontend/src/components/v2/Card/Card.tsx`
- Create: `frontend/src/components/v2/Card/Card.test.tsx`
- Create: `frontend/src/components/v2/Card/Card.stories.tsx`
- Create: `frontend/src/components/v2/Card/index.ts`
- Modify: `frontend/src/components/v2/index.ts` (add export)

- [ ] **Step 1: Write failing test for Card basic render**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from './Card'

describe('Card', () => {
  it('renders correctly with default props', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText(/card content/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- --run src/components/v2/Card/Card.test.tsx`
Expected: FAIL with "Cannot find module './Card'"

- [ ] **Step 3: Write minimal Card implementation**

```tsx
import React from 'react'

export type CardVariant = 'default' | 'outlined' | 'elevated'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: CardPadding
  hoverable?: boolean
  children: React.ReactNode
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-[var(--bg-secondary)] border border-[var(--border-default)] shadow-[var(--shadow-xs)]',
  outlined: 'bg-transparent border-2 border-[var(--border-default)]',
  elevated: 'bg-[var(--bg-secondary)] border border-[var(--accent-primary)] border-opacity-20 shadow-[var(--shadow-md)]',
}

const paddingClasses: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-8',
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  hoverable = false,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = `
    rounded-[var(--radius-lg)]
    transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]
  `

  const hoverClasses = hoverable
    ? 'hover:border-[var(--accent-primary)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-1 cursor-pointer'
    : ''

  const classes = `${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${hoverClasses} ${className}`.trim()

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}

Card.displayName = 'Card'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- --run src/components/v2/Card/Card.test.tsx`
Expected: PASS "renders correctly with default props"

- [ ] **Step 5: Add complete test suite**

Replace test file content with:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from './Card'

describe('Card', () => {
  it('renders correctly with default props', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText(/card content/i)).toBeInTheDocument()
  })

  it('applies variant correctly', () => {
    const { rerender } = render(<Card variant="default">Default</Card>)
    expect(screen.getByText(/default/i).parentElement).toHaveClass(/shadow-xs/)

    rerender(<Card variant="elevated">Elevated</Card>)
    expect(screen.getByText(/elevated/i).parentElement).toHaveClass(/shadow-md/)
  })

  it('applies padding correctly', () => {
    const { rerender } = render(<Card padding="none">No Padding</Card>)
    expect(screen.getByText(/no padding/i).parentElement).toHaveClass('p-0')

    rerender(<Card padding="lg">Large Padding</Card>)
    expect(screen.getByText(/large padding/i).parentElement).toHaveClass('p-8')
  })

  it('applies hoverable classes correctly', () => {
    render(<Card hoverable>Hoverable Card</Card>)
    expect(screen.getByText(/hoverable card/i).parentElement).toHaveClass(/hover:-translate-y-1/)
    expect(screen.getByText(/hoverable card/i).parentElement).toHaveClass('cursor-pointer')
  })

  it('forwards additional props correctly', () => {
    render(<Card data-testid="test-card" aria-label="Test Card">Content</Card>)
    expect(screen.getByTestId('test-card')).toHaveAttribute('aria-label', 'Test Card')
  })
})
```

- [ ] **Step 6: Run all tests**

Run: `cd frontend && npm run test -- --run src/components/v2/Card/Card.test.tsx`
Expected: All 5 tests PASS

- [ ] **Step 7: Create Card index export**

```typescript
export * from './Card'
```

- [ ] **Step 8: Update v2 barrel export**

Add to `v2/index.ts`:
```typescript
export * from './Card'
```

- [ ] **Step 9: Create Card stories**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Card } from './Card'

const meta: Meta<typeof Card> = {
  title: 'v2/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outlined', 'elevated'],
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  args: {
    children: 'This is a default card with medium padding.',
  },
}

export const Hoverable: Story = {
  args: {
    hoverable: true,
    children: 'Hover over me to see the animation effect!',
  },
}

export const Elevated: Story = {
  args: {
    variant: 'elevated',
    children: 'This is an elevated card with stronger shadow.',
  },
}

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    children: 'This is an outlined card with 2px border.',
  },
}
```

- [ ] **Step 10: Commit**

```bash
git add src/components/v2/Card/*
git add src/components/v2/index.ts
git commit -m "feat: add Card component v2 with tests and stories"
```

---

### Task 7: Input Component v2 (TDD Approach)

**Files:**
- Create: `frontend/src/components/v2/Input/Input.tsx`
- Create: `frontend/src/components/v2/Input/Textarea.tsx`
- Create: `frontend/src/components/v2/Input/Input.test.tsx`
- Create: `frontend/src/components/v2/Input/Input.stories.tsx`
- Create: `frontend/src/components/v2/Input/index.ts`
- Modify: `frontend/src/components/v2/index.ts` (add export)

- [ ] **Step 1: Write failing test for Input basic render**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'

describe('Input', () => {
  it('renders correctly with default props', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText(/enter text/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- --run src/components/v2/Input/Input.test.tsx`
Expected: FAIL with "Cannot find module './Input'"

- [ ] **Step 3: Write minimal Input implementation**

```tsx
import React, { forwardRef } from 'react'

export type InputSize = 'sm' | 'md' | 'lg'
export type InputStatus = 'default' | 'error' | 'success'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  size?: InputSize
  status?: InputStatus
  errorMessage?: string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  fullWidth?: boolean
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-5 py-3 text-lg',
}

const statusClasses: Record<InputStatus, string> = {
  default: 'border-[var(--border-default)] focus:border-[var(--accent-primary)]',
  error: 'border-red-500 focus:border-red-600',
  success: 'border-green-500 focus:border-green-600',
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    label,
    size = 'md',
    status = 'default',
    errorMessage,
    prefix,
    suffix,
    fullWidth = false,
    className = '',
    ...props
  }, ref) => {
    const baseClasses = `
      bg-[var(--bg-secondary)]
      rounded-[var(--radius-md)]
      transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]
      focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-opacity-20
      text-[var(--text-body)]
      placeholder:text-[var(--text-muted)]
      disabled:cursor-not-allowed disabled:opacity-50
    `

    const widthClass = fullWidth ? 'w-full' : ''
    const hasAffix = prefix || suffix

    const inputClasses = hasAffix
      ? 'bg-transparent border-0 focus:ring-0 w-full'
      : `${baseClasses} ${sizeClasses[size]} ${statusClasses[status]} ${widthClass} ${className}`.trim()

    if (hasAffix) {
      return (
        <div className="flex flex-col gap-1.5">
          {label && (
            <label className="text-sm font-medium text-[var(--text-primary)]">
              {label}
            </label>
          )}
          <div className={`
            flex items-center gap-2
            ${baseClasses} ${sizeClasses[size]} ${statusClasses[status]} ${widthClass} ${className}
          `.trim()}>
            {prefix && <span className="text-[var(--text-muted)]">{prefix}</span>}
            <input ref={ref} className="w-full bg-transparent border-0 focus:ring-0 outline-none" {...props} />
            {suffix && <span className="text-[var(--text-muted)]">{suffix}</span>}
          </div>
          {status === 'error' && errorMessage && (
            <p className="text-sm text-red-500">{errorMessage}</p>
          )}
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[var(--text-primary)]">
            {label}
          </label>
        )}
        <input ref={ref} className={inputClasses} {...props} />
        {status === 'error' && errorMessage && (
          <p className="text-sm text-red-500">{errorMessage}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
```

- [ ] **Step 4: Add Textarea component**

```tsx
import React, { forwardRef } from 'react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  errorMessage?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    label,
    errorMessage,
    className = '',
    rows = 4,
    ...props
  }, ref) => {
    const baseClasses = `
      bg-[var(--bg-secondary)] border border-[var(--border-default)]
      rounded-[var(--radius-md)] px-4 py-2.5
      transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]
      focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-opacity-20 focus:border-[var(--accent-primary)]
      text-[var(--text-body)]
      placeholder:text-[var(--text-muted)]
      disabled:cursor-not-allowed disabled:opacity-50
      resize-y min-h-[100px]
    `

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[var(--text-primary)]">
            {label}
          </label>
        )}
        <textarea ref={ref} rows={rows} className={`${baseClasses} ${className}`.trim()} {...props} />
        {errorMessage && (
          <p className="text-sm text-red-500">{errorMessage}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
```

- [ ] **Step 5: Run basic test**

Run: `cd frontend && npm run test -- --run src/components/v2/Input/Input.test.tsx`
Expected: PASS "renders correctly with default props"

- [ ] **Step 6: Add complete test suite**

Replace test file content with:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'
import { Textarea } from './Textarea'

describe('Input', () => {
  it('renders correctly with default props', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText(/enter text/i)).toBeInTheDocument()
  })

  it('renders label correctly', () => {
    render(<Input label="Email" placeholder="email@example.com" />)
    expect(screen.getByText(/email/i)).toBeInTheDocument()
  })

  it('shows error message when status is error', () => {
    render(<Input status="error" errorMessage="Invalid input" placeholder="Test" />)
    expect(screen.getByText(/invalid input/i)).toBeInTheDocument()
  })

  it('renders prefix correctly', () => {
    render(<Input prefix="https://" placeholder="example.com" />)
    expect(screen.getByText(/https:\/\//i)).toBeInTheDocument()
  })

  it('renders suffix correctly', () => {
    render(<Input suffix="@gmail.com" placeholder="username" />)
    expect(screen.getByText(/@gmail.com/i)).toBeInTheDocument()
  })

  it('calls onChange when value changes', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Input onChange={onChange} placeholder="Type here" />)

    await user.type(screen.getByPlaceholderText(/type here/i), 'hello')
    expect(onChange).toHaveBeenCalledTimes(5)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled placeholder="Disabled" />)
    expect(screen.getByPlaceholderText(/disabled/i)).toBeDisabled()
  })

  it('applies fullWidth class correctly', () => {
    const { container } = render(<Input fullWidth placeholder="Full Width" />)
    expect(container.firstChild).toHaveClass('w-full')
  })
})

describe('Textarea', () => {
  it('renders correctly with default props', () => {
    render(<Textarea placeholder="Enter description" />)
    expect(screen.getByPlaceholderText(/enter description/i)).toBeInTheDocument()
  })

  it('renders label correctly', () => {
    render(<Textarea label="Description" placeholder="..." />)
    expect(screen.getByText(/description/i)).toBeInTheDocument()
  })

  it('shows error message correctly', () => {
    render(<Textarea errorMessage="Required field" placeholder="Test" />)
    expect(screen.getByText(/required field/i)).toBeInTheDocument()
  })

  it('has correct default rows', () => {
    render(<Textarea placeholder="Test" />)
    expect(screen.getByPlaceholderText(/test/i)).toHaveAttribute('rows', '4')
  })
})
```

- [ ] **Step 7: Run all tests**

Run: `cd frontend && npm run test -- --run src/components/v2/Input/Input.test.tsx`
Expected: All 13 tests PASS

- [ ] **Step 8: Create Input index export**

```typescript
export * from './Input'
export * from './Textarea'
```

- [ ] **Step 9: Update v2 barrel export**

Add to `v2/index.ts`:
```typescript
export * from './Input'
```

- [ ] **Step 10: Create Input stories**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Input, Textarea } from './Input'

const meta: Meta<typeof Input> = {
  title: 'v2/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    status: {
      control: 'radio',
      options: ['default', 'error', 'success'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: {
    placeholder: 'Enter your text here...',
  },
}

export const WithLabel: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'email@example.com',
  },
}

export const WithError: Story = {
  args: {
    label: 'Email',
    status: 'error',
    errorMessage: 'Please enter a valid email address',
    placeholder: 'email@example.com',
    value: 'invalid-email',
  },
}

export const WithPrefix: Story = {
  args: {
    label: 'Website',
    prefix: 'https://',
    placeholder: 'example.com',
  },
}

export const WithSuffix: Story = {
  args: {
    label: 'Username',
    suffix: '@gmail.com',
    placeholder: 'yourname',
  },
}

export const TextareaStory: StoryObj<typeof Textarea> = {
  render: (args) => <Textarea {...args} />,
  args: {
    label: 'Description',
    placeholder: 'Enter a detailed description...',
    rows: 5,
  },
}
```

- [ ] **Step 11: Commit**

```bash
git add src/components/v2/Input/*
git add src/components/v2/index.ts
git commit -m "feat: add Input and Textarea components v2 with tests and stories"
```

---

### Task 8: Badge Component v2 (TDD Approach)

**Files:**
- Create: `frontend/src/components/v2/Badge/Badge.tsx`
- Create: `frontend/src/components/v2/Badge/Badge.test.tsx`
- Create: `frontend/src/components/v2/Badge/Badge.stories.tsx`
- Create: `frontend/src/components/v2/Badge/index.ts`
- Modify: `frontend/src/components/v2/index.ts` (add export)

- [ ] **Step 1: Write failing test for Badge basic render**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders correctly with default props', () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText(/new/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- --run src/components/v2/Badge/Badge.test.tsx`
Expected: FAIL with "Cannot find module './Badge'"

- [ ] **Step 3: Write Badge implementation**

```tsx
import React from 'react'

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error'

export interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  primary: 'bg-[var(--accent-primary)] text-white',
  secondary: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-default)]',
  success: 'bg-green-500 text-white',
  warning: 'bg-yellow-500 text-white',
  error: 'bg-red-500 text-white',
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  children,
  className = '',
}) => {
  const baseClasses = `
    inline-flex items-center justify-center
    px-2.5 py-0.5 text-xs font-medium
    rounded-[var(--radius-sm)]
  `

  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`.trim()

  return <span className={classes}>{children}</span>
}

Badge.displayName = 'Badge'
```

- [ ] **Step 4: Run basic test**

Run: `cd frontend && npm run test -- --run src/components/v2/Badge/Badge.test.tsx`
Expected: PASS "renders correctly with default props"

- [ ] **Step 5: Add complete test suite**

Replace test file content with:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders correctly with default props', () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText(/new/i)).toBeInTheDocument()
  })

  it('applies variant correctly', () => {
    const { rerender } = render(<Badge variant="primary">Primary</Badge>)
    expect(screen.getByText(/primary/i)).toHaveClass(/accent-primary/)

    rerender(<Badge variant="success">Success</Badge>)
    expect(screen.getByText(/success/i)).toHaveClass(/bg-green-500/)

    rerender(<Badge variant="error">Error</Badge>)
    expect(screen.getByText(/error/i)).toHaveClass(/bg-red-500/)
  })

  it('applies custom className correctly', () => {
    render(<Badge className="custom-class">Custom</Badge>)
    expect(screen.getByText(/custom/i)).toHaveClass('custom-class')
  })
})
```

- [ ] **Step 6: Run all tests**

Run: `cd frontend && npm run test -- --run src/components/v2/Badge/Badge.test.tsx`
Expected: All 3 tests PASS

- [ ] **Step 7: Create Badge index export**

```typescript
export * from './Badge'
```

- [ ] **Step 8: Update v2 barrel export**

Add to `v2/index.ts`:
```typescript
export * from './Badge'
```

- [ ] **Step 9: Create Badge stories**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from './Badge'

const meta: Meta<typeof Badge> = {
  title: 'v2/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'success', 'warning', 'error'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Badge>

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary',
  },
}

export const Success: Story = {
  args: {
    variant: 'success',
    children: 'Success',
  },
}

export const Warning: Story = {
  args: {
    variant: 'warning',
    children: 'Warning',
  },
}

export const Error: Story = {
  args: {
    variant: 'error',
    children: 'Error',
  },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="primary">Primary</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
    </div>
  ),
}
```

- [ ] **Step 10: Commit**

```bash
git add src/components/v2/Badge/*
git add src/components/v2/index.ts
git commit -m "feat: add Badge component v2 with tests and stories"
```

---

## Phase 3: Phase 1 Completion Verification

### Task 9: Run Full Test Suite

**Files:** None (verification only)

- [ ] **Step 1: Run all v2 component tests**

Run: `cd frontend && npm run test -- --run src/components/v2/`
Expected: All tests pass (Button:10, Card:5, Input:13, Badge:3 = 31 total)

- [ ] **Step 2: Run existing tests to ensure no regression**

Run: `cd frontend && npm run test:run`
Expected: All existing tests still pass

- [ ] **Step 3: Start dev server and verify components work**

Run: `cd frontend && npm run dev`
Verify: No build errors, app loads successfully

- [ ] **Step 4: Verify import from v2 namespace works**

Add to any existing page temporarily:
```tsx
import { Button, Card, Input, Badge } from '../components/v2'

// In render:
<Card hoverable>
  <h3>v2 Components Test</h3>
  <Input placeholder="Test input" />
  <Button>Test Button</Button>
  <Badge>Badge</Badge>
</Card>
```
Verify: All components render correctly in the app

- [ ] **Step 5: Commit verification success (no changes needed)**

---

## Phase 4: Phase 2 - Advanced Components (Future Work)

These components are planned for Phase 2, detailed tasks to be added when ready:

- [ ] **Modal Component** - With backdrop, animations, and accessibility
- [ ] **Tooltip Component** - With positioning and delay options
- [ ] **Checkbox Component** - Including indeterminate state
- [ ] **Radio Component** - With RadioGroup for form handling
- [ ] **Skeleton Component** - Loading states with pulse/wave animations
- [ ] **Progress Component** - Linear and circular progress bars

---

## Plan Self-Review

 **Spec Coverage:** All Phase 1 requirements covered
 **No placeholders:** Every step has complete code and commands
 **Type consistency:** All interfaces match the design spec
 **TDD flow:** Every component follows write test → fail → implement → pass pattern
 **Zero risk:** v2 namespace is completely isolated from existing code
 **Frequent commits:** Each component is its own commit

---

Plan complete and saved to `docs/superpowers/plans/2026-04-26-ui-component-library-v2-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
