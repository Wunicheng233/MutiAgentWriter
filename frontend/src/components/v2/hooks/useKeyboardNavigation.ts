import { useCallback } from 'react'

export type NavigationRole = 'option' | 'menuitem'

export interface UseKeyboardNavigationOptions {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  contentRef: React.RefObject<HTMLElement | null>
  role?: NavigationRole
  onSelect?: (value: string) => void
}

/**
 * 键盘导航 Hook - 处理下拉类组件的键盘交互
 * 支持 option (Select) 和 menuitem (DropdownMenu) 两种角色
 */
export function useKeyboardNavigation({
  isOpen,
  setIsOpen,
  contentRef,
  role = 'option',
  onSelect,
}: UseKeyboardNavigationOptions) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const items = Array.from(
        contentRef.current?.querySelectorAll(`[role="${role}"]:not([data-disabled="true"])`) || []
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
      } else if (e.key === 'Enter' && onSelect) {
        e.preventDefault()
        if (currentIndex >= 0) {
          const value = items[currentIndex].getAttribute('data-value')
          if (value) {
            onSelect(value)
            setIsOpen(false)
          }
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    },
    [isOpen, setIsOpen, contentRef, role, onSelect]
  )

  return { handleKeyDown }
}
