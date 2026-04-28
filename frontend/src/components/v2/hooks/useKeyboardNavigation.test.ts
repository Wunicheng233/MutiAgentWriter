import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup, fireEvent } from '@testing-library/react'
import { useKeyboardNavigation } from './useKeyboardNavigation'

describe('useKeyboardNavigation', () => {
  afterEach(() => {
    cleanup()
  })

  it('应该返回 handleKeyDown 函数', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen: vi.fn(),
        contentRef: { current: null },
        role: 'option',
      })
    )

    expect(typeof result.current.handleKeyDown).toBe('function')
  })

  it('按 Escape 应该调用 setIsOpen(false)', () => {
    const setIsOpen = vi.fn()
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        setIsOpen,
        contentRef: { current: null },
        role: 'option',
      })
    )

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
      result.current.handleKeyDown({ key: 'Escape', preventDefault: vi.fn() } as any)
    })

    expect(setIsOpen).toHaveBeenCalledWith(false)
  })

  it('按 Enter 且有 onSelect 时应该调用 onSelect 并关闭菜单', () => {
    const setIsOpen = vi.fn()
    const onSelect = vi.fn()
    const preventDefault = vi.fn()

    // 创建模拟 DOM 元素
    const container = document.createElement('div')
    const item = document.createElement('div')
    item.setAttribute('role', 'option')
    item.setAttribute('data-value', 'test-value')
    container.appendChild(item)
    document.body.appendChild(container)

    // 模拟 document.activeElement
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

    // 清理
    document.body.removeChild(container)
  })

  it('没有 onSelect 时按 Enter 不应该调用 setIsOpen', () => {
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

  it('按 ArrowDown 应该调用 preventDefault', () => {
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

  it('按 ArrowUp 应该调用 preventDefault', () => {
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

  it('支持 menuitem role', () => {
    const setIsOpen = vi.fn()
    const onSelect = vi.fn()
    const preventDefault = vi.fn()

    const container = document.createElement('div')
    const item = document.createElement('div')
    item.setAttribute('role', 'menuitem')
    item.setAttribute('data-value', 'menu-value')
    container.appendChild(item)
    document.body.appendChild(container)

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

    document.body.removeChild(container)
  })
})
