import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'

const TYPEWRITER_TARGET_RATIO = 0.38

const findScrollContainer = (editorRoot: HTMLElement): HTMLElement | Window => {
  const explicitContainer = editorRoot.closest<HTMLElement>('[data-editor-scroll-container="true"], .editor-container')
  if (explicitContainer) return explicitContainer

  let current = editorRoot.parentElement
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current)
    const canScroll = ['auto', 'scroll'].includes(style.overflowY)
    if (canScroll) {
      return current
    }
    current = current.parentElement
  }

  return window
}

const isElementContainer = (container: HTMLElement | Window): container is HTMLElement => (
  typeof HTMLElement !== 'undefined' && container instanceof HTMLElement
)

const getContainerMetrics = (container: HTMLElement | Window) => {
  if (!isElementContainer(container)) {
    return {
      top: 0,
      height: window.innerHeight,
      scrollTop: window.scrollY,
      scrollTo: (top: number) => window.scrollTo({ top, behavior: 'smooth' }),
    }
  }

  const rect = container.getBoundingClientRect()
  return {
    top: rect.top,
    height: container.clientHeight || rect.height,
    scrollTop: container.scrollTop,
    scrollTo: (top: number) => {
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top, behavior: 'smooth' })
      } else {
        container.scrollTop = top
      }
    },
  }
}

export const useTypewriterMode = (editor: Editor | null, enabled: boolean) => {
  useEffect(() => {
    if (!editor || !enabled) return

    const scrollToTypewriterPosition = () => {
      const { view } = editor
      const { from } = editor.state.selection

      const coords = view.coordsAtPos(from)
      if (!coords) return

      const scrollContainer = findScrollContainer(view.dom)
      const metrics = getContainerMetrics(scrollContainer)
      const targetY = metrics.top + metrics.height * TYPEWRITER_TARGET_RATIO
      const scrollDelta = coords.top - targetY

      if (Math.abs(scrollDelta) > 10) {
        metrics.scrollTo(metrics.scrollTop + scrollDelta)
      }
    }

    scrollToTypewriterPosition()
    editor.on('selectionUpdate', scrollToTypewriterPosition)
    editor.on('update', scrollToTypewriterPosition)

    return () => {
      editor.off('selectionUpdate', scrollToTypewriterPosition)
      editor.off('update', scrollToTypewriterPosition)
    }
  }, [editor, enabled])
}

export default useTypewriterMode
