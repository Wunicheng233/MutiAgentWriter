import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, fireEvent } from '@testing-library/react'
import { useKeyboardNavigation } from './useKeyboardNavigation'

describe('useKeyboardNavigation', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  it('should return handleKeyDown function', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen: vi.fn(),
        contentRef: { current: null },
        role: 'option',
      })
    )

    expect(typeof result.current.handleKeyDown).toBe('function')
  })

  it('should call setIsOpen(false) when Escape is pressed', () => {
    const setIsOpen = vi.fn()
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen,
        contentRef: { current: null },
        role: 'option',
      })
    )

    act(() => {
      result.current.handleKeyDown({ key: 'Escape', preventDefault: vi.fn() } as any)
    })

    expect(setIsOpen).toHaveBeenCalledWith(false)
  })

  it('should call onSelect and close menu when Enter is pressed on focused item', () => {
    const setIsOpen = vi.fn()
    const onSelect = vi.fn()
    const preventDefault = vi.fn()

    const item = document.createElement('div')
    item.setAttribute('role', 'option')
    item.setAttribute('data-value', 'test-value')
    container.appendChild(item)

    Object.defineProperty(document, 'activeElement', { value: item, writable: true })

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen,
        contentRef: { current: container },
        role: 'option',
        onSelect,
      })
    )

    act(() => {
      result.current.handleKeyDown({ key: 'Enter', preventDefault } as any)
    })

    expect(onSelect).toHaveBeenCalledWith('test-value')
    expect(setIsOpen).toHaveBeenCalledWith(false)
    expect(preventDefault).toHaveBeenCalled()
  })

  it('should not call setIsOpen when Enter is pressed and onSelect is not provided', () => {
    const setIsOpen = vi.fn()

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen,
        contentRef: { current: null },
        role: 'option',
      })
    )

    act(() => {
      result.current.handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as any)
    })

    expect(setIsOpen).not.toHaveBeenCalled()
  })

  it('should not call onSelect when Enter is pressed and no item is focused', () => {
    const setIsOpen = vi.fn()
    const onSelect = vi.fn()
    const preventDefault = vi.fn()

    const item = document.createElement('div')
    item.setAttribute('role', 'option')
    item.setAttribute('data-value', 'test-value')
    container.appendChild(item)

    // No item focused - activeElement is not the item
    Object.defineProperty(document, 'activeElement', { value: document.body, writable: true })

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen,
        contentRef: { current: container },
        role: 'option',
        onSelect,
      })
    )

    act(() => {
      result.current.handleKeyDown({ key: 'Enter', preventDefault } as any)
    })

    expect(onSelect).not.toHaveBeenCalled()
    expect(setIsOpen).not.toHaveBeenCalled()
  })

  it('should call preventDefault when ArrowDown is pressed', () => {
    const setIsOpen = vi.fn()
    const preventDefault = vi.fn()

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen,
        contentRef: { current: null },
        role: 'option',
      })
    )

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault } as any)
    })

    expect(preventDefault).toHaveBeenCalled()
  })

  it('should focus next item when ArrowDown is pressed', () => {
    const setIsOpen = vi.fn()
    const preventDefault = vi.fn()

    const item1 = document.createElement('div')
    item1.setAttribute('role', 'option')
    item1.setAttribute('data-value', 'item1')
    const item2 = document.createElement('div')
    item2.setAttribute('role', 'option')
    item2.setAttribute('data-value', 'item2')
    container.appendChild(item1)
    container.appendChild(item2)

    // Focus first item initially
    Object.defineProperty(document, 'activeElement', { value: item1, writable: true })
    const focusSpy = vi.spyOn(item2, 'focus')

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen,
        contentRef: { current: container },
        role: 'option',
      })
    )

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault } as any)
    })

    expect(focusSpy).toHaveBeenCalled()
  })

  it('should wrap focus from last to first item when ArrowDown is pressed on last item', () => {
    const setIsOpen = vi.fn()
    const preventDefault = vi.fn()

    const item1 = document.createElement('div')
    item1.setAttribute('role', 'option')
    item1.setAttribute('data-value', 'item1')
    const item2 = document.createElement('div')
    item2.setAttribute('role', 'option')
    item2.setAttribute('data-value', 'item2')
    container.appendChild(item1)
    container.appendChild(item2)

    // Focus last item initially
    Object.defineProperty(document, 'activeElement', { value: item2, writable: true })
    const focusSpy = vi.spyOn(item1, 'focus')

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen,
        contentRef: { current: container },
        role: 'option',
      })
    )

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault } as any)
    })

    expect(focusSpy).toHaveBeenCalled()
  })

  it('should call preventDefault when ArrowUp is pressed', () => {
    const setIsOpen = vi.fn()
    const preventDefault = vi.fn()

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen,
        contentRef: { current: null },
        role: 'option',
      })
    )

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault } as any)
    })

    expect(preventDefault).toHaveBeenCalled()
  })

  it('should focus previous item when ArrowUp is pressed', () => {
    const setIsOpen = vi.fn()
    const preventDefault = vi.fn()

    const item1 = document.createElement('div')
    item1.setAttribute('role', 'option')
    item1.setAttribute('data-value', 'item1')
    const item2 = document.createElement('div')
    item2.setAttribute('role', 'option')
    item2.setAttribute('data-value', 'item2')
    container.appendChild(item1)
    container.appendChild(item2)

    // Focus second item initially
    Object.defineProperty(document, 'activeElement', { value: item2, writable: true })
    const focusSpy = vi.spyOn(item1, 'focus')

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen,
        contentRef: { current: container },
        role: 'option',
      })
    )

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault } as any)
    })

    expect(focusSpy).toHaveBeenCalled()
  })

  it('should wrap focus from first to last item when ArrowUp is pressed on first item', () => {
    const setIsOpen = vi.fn()
    const preventDefault = vi.fn()

    const item1 = document.createElement('div')
    item1.setAttribute('role', 'option')
    item1.setAttribute('data-value', 'item1')
    const item2 = document.createElement('div')
    item2.setAttribute('role', 'option')
    item2.setAttribute('data-value', 'item2')
    container.appendChild(item1)
    container.appendChild(item2)

    // Focus first item initially
    Object.defineProperty(document, 'activeElement', { value: item1, writable: true })
    const focusSpy = vi.spyOn(item2, 'focus')

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen,
        contentRef: { current: container },
        role: 'option',
      })
    )

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault } as any)
    })

    expect(focusSpy).toHaveBeenCalled()
  })

  it('should skip items with data-disabled="true" during navigation', () => {
    const setIsOpen = vi.fn()
    const preventDefault = vi.fn()

    const item1 = document.createElement('div')
    item1.setAttribute('role', 'option')
    item1.setAttribute('data-value', 'item1')
    const disabledItem = document.createElement('div')
    disabledItem.setAttribute('role', 'option')
    disabledItem.setAttribute('data-value', 'disabled')
    disabledItem.setAttribute('data-disabled', 'true')
    const item3 = document.createElement('div')
    item3.setAttribute('role', 'option')
    item3.setAttribute('data-value', 'item3')
    container.appendChild(item1)
    container.appendChild(disabledItem)
    container.appendChild(item3)

    // Focus first item initially
    Object.defineProperty(document, 'activeElement', { value: item1, writable: true })
    const focusSpy = vi.spyOn(item3, 'focus')

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen,
        contentRef: { current: container },
        role: 'option',
      })
    )

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault } as any)
    })

    // Should focus item3 directly, skipping the disabled item
    expect(focusSpy).toHaveBeenCalled()
  })

  it('should support menuitem role', () => {
    const setIsOpen = vi.fn()
    const onSelect = vi.fn()
    const preventDefault = vi.fn()

    const item = document.createElement('div')
    item.setAttribute('role', 'menuitem')
    item.setAttribute('data-value', 'menu-value')
    container.appendChild(item)

    Object.defineProperty(document, 'activeElement', { value: item, writable: true })

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen,
        contentRef: { current: container },
        role: 'menuitem',
        onSelect,
      })
    )

    act(() => {
      result.current.handleKeyDown({ key: 'Enter', preventDefault } as any)
    })

    expect(onSelect).toHaveBeenCalledWith('menu-value')
    expect(setIsOpen).toHaveBeenCalledWith(false)
  })
})
