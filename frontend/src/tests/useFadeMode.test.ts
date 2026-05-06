import { renderHook } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { useFadeMode } from '../hooks/useFadeMode'

describe('useFadeMode', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.body.classList.remove('fade-mode-active')
  })

  it('should be a function that accepts editor', () => {
    expect(typeof useFadeMode).toBe('function')
  })

  it('should not throw when editor is null', () => {
    expect(() => {
      renderHook(() => useFadeMode(null, true))
    }).not.toThrow()
  })

  it('marks the active and adjacent paragraphs immediately within the editor root', () => {
    const editorRoot = document.createElement('div')
    editorRoot.className = 'ProseMirror'
    editorRoot.innerHTML = '<p>第一段</p><p>第二段</p><p>第三段</p>'
    document.body.appendChild(editorRoot)

    const outsideEditor = document.createElement('div')
    outsideEditor.className = 'ProseMirror'
    outsideEditor.innerHTML = '<p>其他编辑器段落</p>'
    document.body.appendChild(outsideEditor)

    const editor = {
      view: {
        dom: editorRoot,
        state: {
          selection: { from: 6 },
          doc: {
            resolve: vi.fn(() => ({
              index: vi.fn(() => 1),
            })),
          },
        },
      },
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as Editor

    renderHook(() => useFadeMode(editor, true))

    const paragraphs = editorRoot.querySelectorAll('p')
    expect(document.body).toHaveClass('fade-mode-active')
    expect(paragraphs[0]).toHaveClass('is-adjacent-paragraph')
    expect(paragraphs[1]).toHaveClass('is-active-paragraph')
    expect(paragraphs[2]).toHaveClass('is-adjacent-paragraph')
    expect(outsideEditor.querySelector('p')).not.toHaveClass('is-active-paragraph')
  })
})
