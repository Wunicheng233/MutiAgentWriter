import React, { createContext, useContext, useState, useRef, useCallback } from 'react'

export type TabsVariant = 'default' | 'pills' | 'outline' | 'transparent'

interface TabsContextValue {
  value: string
  setValue: (value: string) => void
  variant: TabsVariant
  activeTriggerRef: React.RefObject<HTMLButtonElement | null>
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
    active: 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm',
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
