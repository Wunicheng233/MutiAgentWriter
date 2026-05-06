import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLayoutStore } from '../store/useLayoutStore'

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    toggleNavCollapsed,
    toggleRightPanel,
    toggleFocusMode,
    toggleHeader,
    setRightPanelOpen,
    toggleTypewriterMode,
    toggleFadeMode,
    setCommandPaletteOpen,
  } = useLayoutStore()

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

      // Command/Ctrl + T: Toggle header
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        toggleHeader()
        return
      }

      // Command/Ctrl + I: Toggle AI assistant panel (open)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        setRightPanelOpen(true)
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

      // Command/Ctrl + Shift + T: Toggle Typewriter mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        e.stopPropagation()
        toggleTypewriterMode()
        return
      }

      // Command/Ctrl + Shift + G: Toggle Fade mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        e.stopPropagation()
        toggleFadeMode()
        return
      }

      // Command/Ctrl + K: Open command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        setCommandPaletteOpen(true)
        return
      }

      // Command/Ctrl + 1-4: Navigate to pages
      if ((e.metaKey || e.ctrlKey) && /^[1-4]$/.test(e.key) && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        const routeProjectId = location.pathname.match(/^\/projects\/(?!new(?:\/|$))([^/]+)/)?.[1]
        const paths = routeProjectId
          ? [
              `/projects/${routeProjectId}/overview`,
              `/projects/${routeProjectId}/chapters`,
              `/projects/${routeProjectId}/read/1`,
              `/projects/${routeProjectId}/editor/1`,
            ]
          : ['/dashboard', '/projects/new', '/settings']
        const index = parseInt(e.key) - 1
        if (paths[index]) {
          navigate(paths[index])
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [location.pathname, navigate, toggleNavCollapsed, toggleHeader, setRightPanelOpen, toggleRightPanel, toggleFocusMode, toggleTypewriterMode, toggleFadeMode, setCommandPaletteOpen])
}

export default useKeyboardShortcuts
