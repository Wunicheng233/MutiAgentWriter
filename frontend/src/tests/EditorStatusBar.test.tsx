import { render, screen, fireEvent } from '@testing-library/react'
import { EditorStatusBar } from '../components/editor/EditorStatusBar'
import { useLayoutStore } from '../store/useLayoutStore'

describe('EditorStatusBar', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      typewriterMode: false,
      fadeMode: false,
      focusMode: false,
      vimMode: false,
    })
  })

  it('should render all mode toggles', () => {
    render(<EditorStatusBar />)
    expect(screen.getByText(/Typewriter/i)).toBeInTheDocument()
    expect(screen.getByText(/Fade/i)).toBeInTheDocument()
    expect(screen.getByText(/Focus/i)).toBeInTheDocument()
    expect(screen.getByText(/Vim/i)).toBeInTheDocument()
  })

  it('should toggle typewriter mode on click', () => {
    render(<EditorStatusBar />)
    fireEvent.click(screen.getByText(/Typewriter/i))
    expect(useLayoutStore.getState().typewriterMode).toBe(true)
  })

  it('should show Cmd+K button', () => {
    render(<EditorStatusBar />)
    expect(screen.getByText(/⌘K/i)).toBeInTheDocument()
  })

  it('should open command palette when Cmd+K clicked', () => {
    render(<EditorStatusBar />)
    fireEvent.click(screen.getByText(/⌘K/i))
    expect(useLayoutStore.getState().commandPaletteOpen).toBe(true)
  })
})
