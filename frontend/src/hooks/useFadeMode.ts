import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'

export const useFadeMode = (editor: Editor | null, enabled: boolean) => {
  useEffect(() => {
    if (!editor) return

    // Add or remove fade-mode class on body
    if (enabled) {
      document.body.classList.add('fade-mode-active')
    } else {
      document.body.classList.remove('fade-mode-active')
      // Clean up any remaining classes on paragraphs
      document.querySelectorAll('.is-active-paragraph, .is-adjacent-paragraph').forEach((el) => {
        el.classList.remove('is-active-paragraph', 'is-adjacent-paragraph')
      })
      return
    }

    const updateParagraphClasses = () => {
      const { state } = editor.view
      const { from } = state.selection
      const $pos = state.doc.resolve(from)
      const currentParaIndex = $pos.index(0)

      // Remove classes from all paragraphs
      document.querySelectorAll('.is-active-paragraph, .is-adjacent-paragraph').forEach((el) => {
        el.classList.remove('is-active-paragraph', 'is-adjacent-paragraph')
      })

      // Add classes to current and adjacent paragraphs
      const paragraphs = document.querySelectorAll('.ProseMirror p')
      paragraphs.forEach((para, index) => {
        if (index === currentParaIndex) {
          para.classList.add('is-active-paragraph')
        } else if (Math.abs(index - currentParaIndex) === 1) {
          para.classList.add('is-adjacent-paragraph')
        }
      })
    }

    // Listen for selection updates
    editor.on('selectionUpdate', updateParagraphClasses)

    return () => {
      editor.off('selectionUpdate', updateParagraphClasses)
      document.body.classList.remove('fade-mode-active')
    }
  }, [editor, enabled])
}

export default useFadeMode
