import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'

const clearParagraphClasses = (editorRoot: HTMLElement) => {
  editorRoot.querySelectorAll('.is-active-paragraph, .is-adjacent-paragraph').forEach((el) => {
    el.classList.remove('is-active-paragraph', 'is-adjacent-paragraph')
  })
}

const getActiveParagraphIndex = (editor: Editor, paragraphs: NodeListOf<HTMLParagraphElement>) => {
  const { view } = editor
  const { from } = view.state.selection
  const domAtPos = typeof view.domAtPos === 'function' ? view.domAtPos(from) : null
  const domNode = domAtPos?.node
  const element = domNode instanceof HTMLElement ? domNode : domNode?.parentElement
  const activeParagraph = element?.closest('p')

  if (activeParagraph) {
    const index = Array.from(paragraphs).indexOf(activeParagraph as HTMLParagraphElement)
    if (index >= 0) return index
  }

  return view.state.doc.resolve(from).index(0)
}

export const useFadeMode = (editor: Editor | null, enabled: boolean) => {
  useEffect(() => {
    if (!editor) return

    const editorRoot = editor.view?.dom
    if (!editorRoot) {
      if (!enabled) {
        document.body.classList.remove('fade-mode-active')
      }
      return
    }

    if (enabled) {
      document.body.classList.add('fade-mode-active')
      editorRoot.classList.add('fade-mode-editor')
    } else {
      document.body.classList.remove('fade-mode-active')
      editorRoot.classList.remove('fade-mode-editor')
      clearParagraphClasses(editorRoot)
      return
    }

    const updateParagraphClasses = () => {
      const paragraphs = editorRoot.querySelectorAll('p')
      if (paragraphs.length === 0) return

      const currentParaIndex = getActiveParagraphIndex(editor, paragraphs)

      clearParagraphClasses(editorRoot)
      paragraphs.forEach((para, index) => {
        if (index === currentParaIndex) {
          para.classList.add('is-active-paragraph')
        } else if (Math.abs(index - currentParaIndex) === 1) {
          para.classList.add('is-adjacent-paragraph')
        }
      })
    }

    updateParagraphClasses()
    editor.on('selectionUpdate', updateParagraphClasses)
    editor.on('update', updateParagraphClasses)

    return () => {
      editor.off('selectionUpdate', updateParagraphClasses)
      editor.off('update', updateParagraphClasses)
      document.body.classList.remove('fade-mode-active')
      editorRoot.classList.remove('fade-mode-editor')
      clearParagraphClasses(editorRoot)
    }
  }, [editor, enabled])
}

export default useFadeMode
