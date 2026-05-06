import { renderHook } from '@testing-library/react'
import { useTypewriterMode } from '../hooks/useTypewriterMode'

describe('useTypewriterMode', () => {
  it('should be a function that accepts editor', () => {
    expect(typeof useTypewriterMode).toBe('function')
  })

  it('should not throw when editor is null', () => {
    expect(() => {
      renderHook(() => useTypewriterMode(null, true))
    }).not.toThrow()
  })
})
