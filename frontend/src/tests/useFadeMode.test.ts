import { renderHook } from '@testing-library/react'
import { useFadeMode } from '../hooks/useFadeMode'

describe('useFadeMode', () => {
  it('should be a function that accepts editor', () => {
    expect(typeof useFadeMode).toBe('function')
  })

  it('should not throw when editor is null', () => {
    expect(() => {
      renderHook(() => useFadeMode(null, true))
    }).not.toThrow()
  })
})
