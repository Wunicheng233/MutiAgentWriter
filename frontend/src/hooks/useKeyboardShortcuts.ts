import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayoutStore } from '../store/useLayoutStore'

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate()
  const { toggleNavCollapsed, toggleRightPanel, toggleFocusMode } = useLayoutStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input, textarea, or contenteditable element
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return
      }

      // Command/Ctrl + B: Toggle nav rail
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        toggleNavCollapsed()
        return
      }

      // Command/Ctrl + \: Toggle right panel
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        e.stopPropagation()
        toggleRightPanel()
        return
      }

      // Command/Ctrl + Shift + F: Toggle focus mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        e.stopPropagation()
        toggleFocusMode()
        return
      }

      // Command/Ctrl + 1-4: Navigate to pages
      if ((e.metaKey || e.ctrlKey) && /^[1-4]$/.test(e.key) && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        const paths = ['/dashboard', '/projects/new', '/analytics', '/settings']
        const index = parseInt(e.key) - 1
        if (paths[index]) {
          navigate(paths[index])
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, toggleNavCollapsed, toggleRightPanel, toggleFocusMode])
}

export default useKeyboardShortcuts
