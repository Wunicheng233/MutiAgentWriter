import React, { createContext, useContext, useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useClickOutside } from '../hooks/useClickOutside'
import { useId } from '../hooks/useId'
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation'

interface SelectContextValue {
  value: string
  setValue: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchable: boolean
  triggerRef: React.RefObject<HTMLButtonElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
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
  children?: React.ReactNode
}

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder, children }) => {
  const context = useContext(SelectContext)
  if (!context) throw new Error('SelectValue must be used within Select')

  const { value } = context

  return (
    <span className={value ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
      {children || placeholder}
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
  const inputRef = useRef<HTMLInputElement>(null)
  const contentId = useId('select-content')

  // Focus search input when opened
  useEffect(() => {
    if (open && searchable && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open, searchable])

  const { handleKeyDown } = useKeyboardNavigation({
    isOpen: open,
    setIsOpen: setOpen,
    contentRef,
    onSelect: setValue,
  })

  if (!open) return null

  return (
    <div
      ref={contentRef}
      id={contentId}
      role="listbox"
      onKeyDown={handleKeyDown}
      className={`absolute z-50 mt-1 w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg overflow-hidden ${className}`.trim()}
    >
      {searchable && (
        <div className="p-2 border-b border-[var(--border-subtle)]">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-opacity-20"
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
