import { act, renderHook } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { useTypewriterMode } from '../hooks/useTypewriterMode'

describe('useTypewriterMode', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('should be a function that accepts editor', () => {
    expect(typeof useTypewriterMode).toBe('function')
  })

  it('should not throw when editor is null', () => {
    expect(() => {
      renderHook(() => useTypewriterMode(null, true))
    }).not.toThrow()
  })

  it('scrolls the editor container instead of the window', () => {
    const listeners = new Map<string, () => void>()
    const scrollContainer = document.createElement('div')
    scrollContainer.className = 'editor-container'
    const editorRoot = document.createElement('div')
    editorRoot.className = 'ProseMirror'
    scrollContainer.appendChild(editorRoot)
    document.body.appendChild(scrollContainer)

    Object.defineProperty(scrollContainer, 'clientHeight', { value: 600, configurable: true })
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 100, writable: true, configurable: true })
    scrollContainer.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      bottom: 700,
      left: 0,
      right: 600,
      width: 600,
      height: 600,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    }))
    const containerScrollTo = vi.fn()
    scrollContainer.scrollTo = containerScrollTo
    const windowScrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)

    const editor = {
      view: {
        dom: editorRoot,
        coordsAtPos: vi.fn(() => ({
          top: 520,
          bottom: 540,
          left: 0,
          right: 0,
          width: 0,
          height: 20,
          x: 0,
          y: 520,
          toJSON: () => ({}),
        })),
      },
      state: {
        selection: { from: 1 },
      },
      on: vi.fn((event: string, callback: () => void) => {
        listeners.set(event, callback)
      }),
      off: vi.fn(),
    } as unknown as Editor

    renderHook(() => useTypewriterMode(editor, true))

    act(() => {
      listeners.get('selectionUpdate')?.()
    })

    expect(containerScrollTo).toHaveBeenCalled()
    expect(windowScrollTo).not.toHaveBeenCalled()
    const scrollOptions = containerScrollTo.mock.calls[0][0] as ScrollToOptions
    expect(scrollOptions.top).toBeGreaterThan(100)
  })
})
