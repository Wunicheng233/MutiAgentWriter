import { useCallback } from 'react'

export interface UseKeyboardNavigationOptions {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  contentRef: React.RefObject<HTMLElement | null>
  onSelect?: (value: string) => void
}

/**
 * 键盘导航 Hook - 处理 Select 组件的键盘交互
 */
export function useKeyboardNavigation({
  isOpen,
  setIsOpen,
  contentRef,
  onSelect,
}: UseKeyboardNavigationOptions) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
        if (currentIndex >= 0 && onSelect) {
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
    [isOpen, setIsOpen, contentRef, onSelect]
  )

  return { handleKeyDown }
}
