import { renderHook, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useLayoutStore } from '../store/useLayoutStore'

// Mock the store
vi.mock('../store/useLayoutStore', () => ({
  useLayoutStore: vi.fn(),
}))

const mockToggleNavCollapsed = vi.fn()
const mockToggleHeader = vi.fn()
const mockSetRightPanelOpen = vi.fn()
const mockToggleRightPanel = vi.fn()
const mockToggleFocusMode = vi.fn()
const mockToggleTypewriterMode = vi.fn()
const mockToggleFadeMode = vi.fn()
const mockSetCommandPaletteOpen = vi.fn()

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useLayoutStore).mockReturnValue({
      toggleNavCollapsed: mockToggleNavCollapsed,
      toggleHeader: mockToggleHeader,
      setRightPanelOpen: mockSetRightPanelOpen,
      toggleRightPanel: mockToggleRightPanel,
      toggleFocusMode: mockToggleFocusMode,
      toggleTypewriterMode: mockToggleTypewriterMode,
      toggleFadeMode: mockToggleFadeMode,
      setCommandPaletteOpen: mockSetCommandPaletteOpen,
    })
  })

  const renderWithRouter = () => {
    return renderHook(() => useKeyboardShortcuts(), {
      wrapper: BrowserRouter,
    })
  }

  it('calls toggleNavCollapsed when Ctrl+B is pressed', () => {
    renderWithRouter()

    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'b',
    })
    window.dispatchEvent(event)

    expect(mockToggleNavCollapsed).toHaveBeenCalledTimes(1)
  })

  it('calls toggleNavCollapsed when Cmd+B is pressed', () => {
    renderWithRouter()

    const event = new KeyboardEvent('keydown', {
      metaKey: true,
      key: 'b',
    })
    window.dispatchEvent(event)

    expect(mockToggleNavCollapsed).toHaveBeenCalledTimes(1)
  })

  it('calls toggleHeader when Ctrl+T is pressed', () => {
    renderWithRouter()

    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 't',
    })
    window.dispatchEvent(event)

    expect(mockToggleHeader).toHaveBeenCalledTimes(1)
  })

  it('calls toggleHeader when Cmd+T is pressed', () => {
    renderWithRouter()

    const event = new KeyboardEvent('keydown', {
      metaKey: true,
      key: 't',
    })
    window.dispatchEvent(event)

    expect(mockToggleHeader).toHaveBeenCalledTimes(1)
  })

  it('calls setRightPanelOpen with true when Ctrl+I is pressed', () => {
    renderWithRouter()

    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'i',
    })
    window.dispatchEvent(event)

    expect(mockSetRightPanelOpen).toHaveBeenCalledTimes(1)
    expect(mockSetRightPanelOpen).toHaveBeenCalledWith(true)
  })

  it('calls setRightPanelOpen with true when Cmd+I is pressed', () => {
    renderWithRouter()

    const event = new KeyboardEvent('keydown', {
      metaKey: true,
      key: 'i',
    })
    window.dispatchEvent(event)

    expect(mockSetRightPanelOpen).toHaveBeenCalledTimes(1)
    expect(mockSetRightPanelOpen).toHaveBeenCalledWith(true)
  })

  it('does not call these methods when other keys are pressed', () => {
    renderWithRouter()

    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'x',
    })
    window.dispatchEvent(event)

    expect(mockToggleNavCollapsed).not.toHaveBeenCalled()
    expect(mockToggleHeader).not.toHaveBeenCalled()
    expect(mockSetRightPanelOpen).not.toHaveBeenCalled()
  })

  it('does not trigger shortcuts when typing in an input element', () => {
    renderWithRouter()

    const input = document.createElement('input')
    document.body.appendChild(input)

    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'b',
    })
    input.dispatchEvent(event)

    expect(mockToggleNavCollapsed).not.toHaveBeenCalled()

    document.body.removeChild(input)
  })
})

describe('useKeyboardShortcuts - new mode shortcuts', () => {
  it('should toggle typewriter mode on Cmd+Shift+T', () => {
    renderHook(() => useKeyboardShortcuts(), {
      wrapper: BrowserRouter,
    })

    fireEvent.keyDown(window, { key: 'T', metaKey: true, shiftKey: true })

    expect(mockToggleTypewriterMode).toHaveBeenCalled()
  })

  it('should toggle fade mode on Cmd+Shift+G', () => {
    renderHook(() => useKeyboardShortcuts(), {
      wrapper: BrowserRouter,
    })

    fireEvent.keyDown(window, { key: 'G', metaKey: true, shiftKey: true })

    expect(mockToggleFadeMode).toHaveBeenCalled()
  })

  it('should open command palette on Cmd+K', () => {
    renderHook(() => useKeyboardShortcuts(), {
      wrapper: BrowserRouter,
    })

    fireEvent.keyDown(window, { key: 'K', metaKey: true })

    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(true)
  })
})
