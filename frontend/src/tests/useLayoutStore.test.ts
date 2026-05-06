import { useLayoutStore } from '../store/useLayoutStore'
import { RewriteMode } from '../utils/selectionAI'

describe('useLayoutStore - new focus modes', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      typewriterMode: false,
      fadeMode: false,
      commandPaletteOpen: false,
      defaultRewriteMode: RewriteMode.POLISH,
    })
  })

  it('should have typewriterMode default to false', () => {
    expect(useLayoutStore.getState().typewriterMode).toBe(false)
  })

  it('should toggle typewriterMode', () => {
    useLayoutStore.getState().toggleTypewriterMode()
    expect(useLayoutStore.getState().typewriterMode).toBe(true)
    useLayoutStore.getState().toggleTypewriterMode()
    expect(useLayoutStore.getState().typewriterMode).toBe(false)
  })

  it('should have fadeMode default to false', () => {
    expect(useLayoutStore.getState().fadeMode).toBe(false)
  })

  it('should toggle fadeMode', () => {
    useLayoutStore.getState().toggleFadeMode()
    expect(useLayoutStore.getState().fadeMode).toBe(true)
  })

  it('should set commandPaletteOpen', () => {
    useLayoutStore.getState().setCommandPaletteOpen(true)
    expect(useLayoutStore.getState().commandPaletteOpen).toBe(true)
    useLayoutStore.getState().setCommandPaletteOpen(false)
    expect(useLayoutStore.getState().commandPaletteOpen).toBe(false)
  })

  it('should have defaultRewriteMode default to POLISH', () => {
    expect(useLayoutStore.getState().defaultRewriteMode).toBe(RewriteMode.POLISH)
  })

  it('should set defaultRewriteMode', () => {
    useLayoutStore.getState().setDefaultRewriteMode(RewriteMode.EXPAND)
    expect(useLayoutStore.getState().defaultRewriteMode).toBe(RewriteMode.EXPAND)
  })

  it('should clear all local state', () => {
    // Set some state first
    useLayoutStore.setState({
      focusMode: true,
      typewriterMode: true,
      fadeMode: true,
      defaultRewriteMode: RewriteMode.EXPAND,
    })

    useLayoutStore.getState().clearAllLocalState()

    // Verify reset to defaults
    expect(useLayoutStore.getState().focusMode).toBe(false)
    expect(useLayoutStore.getState().typewriterMode).toBe(false)
    expect(useLayoutStore.getState().fadeMode).toBe(false)
    expect(useLayoutStore.getState().defaultRewriteMode).toBe(RewriteMode.POLISH)
  })
})
