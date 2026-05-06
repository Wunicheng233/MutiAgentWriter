import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'

export const useTypewriterMode = (editor: Editor | null, enabled: boolean) => {
  useEffect(() => {
    if (!editor || !enabled) return

    const scrollToTypewriterPosition = () => {
      const { view } = editor
      const { from } = editor.state.selection

      // Get cursor coordinates
      const coords = view.coordsAtPos(from)
      if (!coords) return

      // Target position: 1/3 from top of viewport
      const viewportHeight = window.innerHeight
      const targetY = viewportHeight * 0.33

      // Calculate scroll needed
      const currentY = coords.top + window.scrollY
      const scrollDelta = currentY - targetY

      // Only scroll if difference is meaningful (prevents jitter)
      if (Math.abs(scrollDelta) > 10) {
        window.scrollTo({
          top: window.scrollY + scrollDelta,
          behavior: 'smooth',
        })
      }
    }

    // Listen for selection updates
    editor.on('selectionUpdate', scrollToTypewriterPosition)

    return () => {
      editor.off('selectionUpdate', scrollToTypewriterPosition)
    }
  }, [editor, enabled])
}

export default useTypewriterMode
