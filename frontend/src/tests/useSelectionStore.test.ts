import { act, renderHook } from '@testing-library/react'
import { useSelectionStore } from '../store/useSelectionStore'

describe('useSelectionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useSelectionStore.getState().reset()
    })
  })

  it('should start with no active selection', () => {
    const { result } = renderHook(() => useSelectionStore())
    expect(result.current.selectedText).toBe('')
    expect(result.current.isToolbarVisible).toBe(false)
  })

  it('should set selection text and show toolbar', () => {
    const { result } = renderHook(() => useSelectionStore())

    act(() => {
      result.current.setSelection('测试文本', 100, 200)
    })

    expect(result.current.selectedText).toBe('测试文本')
    expect(result.current.selectionStart).toBe(100)
    expect(result.current.selectionEnd).toBe(200)
    expect(result.current.isToolbarVisible).toBe(true)
  })

  it('should hide toolbar but keep selection text for AI panel', () => {
    const { result } = renderHook(() => useSelectionStore())

    act(() => {
      result.current.setSelection('测试文本', 100, 200)
      result.current.hideToolbar()
    })

    expect(result.current.isToolbarVisible).toBe(false)
    expect(result.current.selectedText).toBe('测试文本')
  })

  it('should reset all state including selection text', () => {
    const { result } = renderHook(() => useSelectionStore())

    act(() => {
      result.current.setSelection('测试文本', 100, 200)
      result.current.setInitialRewriteMode('polish')
      result.current.reset()
    })

    expect(result.current.isToolbarVisible).toBe(false)
    expect(result.current.selectedText).toBe('')
    expect(result.current.initialRewriteMode).toBe(null)
  })
})
