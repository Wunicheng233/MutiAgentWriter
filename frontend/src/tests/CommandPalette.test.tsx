import { render, screen, fireEvent } from '@testing-library/react'
import { CommandPalette } from '../components/CommandPalette/CommandPalette'
import { useLayoutStore } from '../store/useLayoutStore'

describe('CommandPalette', () => {
  beforeEach(() => {
    useLayoutStore.setState({ commandPaletteOpen: true })
  })

  it('should render when open', () => {
    render(<CommandPalette />)
    expect(screen.getByPlaceholderText(/搜索命令/i)).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    useLayoutStore.setState({ commandPaletteOpen: false })
    render(<CommandPalette />)
    expect(screen.queryByPlaceholderText(/搜索命令/i)).not.toBeInTheDocument()
  })

  it('should close on Escape key', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useLayoutStore.getState().commandPaletteOpen).toBe(false)
  })

  it('should display mode toggle commands', () => {
    render(<CommandPalette />)
    expect(screen.getByText(/Typewriter/i)).toBeInTheDocument()
    expect(screen.getByText(/Fade/i)).toBeInTheDocument()
    expect(screen.getByText(/Focus/i)).toBeInTheDocument()
    expect(screen.getByText(/Vim/i)).toBeInTheDocument()
  })
})
