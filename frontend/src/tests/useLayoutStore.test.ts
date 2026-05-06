import { useLayoutStore } from '../store/useLayoutStore'

describe('useLayoutStore - new focus modes', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      typewriterMode: false,
      fadeMode: false,
      vimMode: false,
      commandPaletteOpen: false,
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

  it('should have vimMode default to false', () => {
    expect(useLayoutStore.getState().vimMode).toBe(false)
  })

  it('should toggle vimMode', () => {
    expect(useLayoutStore.getState().vimMode).toBe(false)
    useLayoutStore.getState().toggleVimMode()
    expect(useLayoutStore.getState().vimMode).toBe(true)
  })

  it('should set commandPaletteOpen', () => {
    useLayoutStore.getState().setCommandPaletteOpen(true)
    expect(useLayoutStore.getState().commandPaletteOpen).toBe(true)
    useLayoutStore.getState().setCommandPaletteOpen(false)
    expect(useLayoutStore.getState().commandPaletteOpen).toBe(false)
  })
})
