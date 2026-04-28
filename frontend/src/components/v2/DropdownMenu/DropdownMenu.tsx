import React, { createContext, useContext, useState, useRef, useCallback } from 'react'
import { useClickOutside } from '../hooks/useClickOutside'
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation'

interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(!open)
  }

  return (
    <div
      ref={triggerRef}
      onClick={handleClick}
      className="inline-block"
      aria-expanded={open}
      aria-haspopup="menu"
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

  const { handleKeyDown } = useKeyboardNavigation({
    setIsOpen: setOpen,
    contentRef: contentRef as React.RefObject<HTMLElement>,
    role: 'menuitem',
  })

  return (
    <div
      ref={contentRef}
      role="menu"
      onKeyDown={handleKeyDown}
      onClick={e => e.stopPropagation()}
      className={`absolute z-50 min-w-[160px] py-1 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg top-full mt-1 transition-all duration-150 ease-out ${alignClasses[align]} ${
        open ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0 pointer-events-none'
      } ${className}`.trim()}
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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
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
