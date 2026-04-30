import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useLayoutStore } from '../store/useLayoutStore'

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

const ProjectRouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={['/projects/12/overview']}>{children}</MemoryRouter>
)

function ShortcutProbe() {
  useKeyboardShortcuts()
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

describe('Keyboard Shortcuts', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      navCollapsed: false,
      rightPanelOpen: false,
      focusMode: false,
    })
  })

  it('should toggle nav collapsed on Command+B', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: RouterWrapper })

    const event = new KeyboardEvent('keydown', { metaKey: true, key: 'b' })
    window.dispatchEvent(event)

    expect(useLayoutStore.getState().navCollapsed).toBe(true)
  })

  it('should toggle right panel on Command+\\', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: RouterWrapper })

    const event = new KeyboardEvent('keydown', { metaKey: true, key: '\\' })
    window.dispatchEvent(event)

    expect(useLayoutStore.getState().rightPanelOpen).toBe(true)
  })

  it('should toggle focus mode on Command+Shift+F', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: RouterWrapper })

    const event = new KeyboardEvent('keydown', { metaKey: true, shiftKey: true, key: 'f' })
    window.dispatchEvent(event)

    expect(useLayoutStore.getState().focusMode).toBe(true)
  })

  it('should work with Ctrl instead of Command', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: RouterWrapper })

    const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'b' })
    window.dispatchEvent(event)

    expect(useLayoutStore.getState().navCollapsed).toBe(true)
  })

  it('should clean up event listener on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useKeyboardShortcuts(), { wrapper: RouterWrapper })

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it('should navigate within the current project for Command+number shortcuts', () => {
    render(<ShortcutProbe />, { wrapper: ProjectRouterWrapper })

    act(() => {
      const event = new KeyboardEvent('keydown', { metaKey: true, key: '3' })
      window.dispatchEvent(event)
    })

    expect(screen.getByTestId('location')).toHaveTextContent('/projects/12/read/1')
  })
})
