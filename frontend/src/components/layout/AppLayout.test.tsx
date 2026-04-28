import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'

// Mock all dependencies
vi.mock('../../store/useProjectStore', () => ({
  useProjectStore: vi.fn(),
}))

vi.mock('../../store/useLayoutStore', () => ({
  useLayoutStore: vi.fn(),
}))

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}))

vi.mock('../toastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
    }),
  }
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Outlet Content</div>,
    useLocation: () => ({ pathname: '/' }),
  }
})

vi.mock('./NavRail', () => ({
  NavRail: () => <nav data-testid="nav-rail">NavRail</nav>,
}))

vi.mock('./CanvasContainer', () => ({
  CanvasContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas-container">{children}</div>
  ),
}))

vi.mock('./RightPanel', () => ({
  RightPanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="right-panel">{children}</div>
  ),
}))

vi.mock('../ai/AIChatPanel', () => ({
  AIChatPanel: () => <div data-testid="ai-chat-panel">AIChatPanel</div>,
}))

vi.mock('../FloatingToggleButton', () => ({
  FloatingToggleButton: () => <button data-testid="floating-toggle">Toggle</button>,
}))

vi.mock('../NavBar', () => ({
  NavBar: () => <nav data-testid="navbar">NavBar</nav>,
}))

vi.mock('./ProjectHeader', () => ({
  ProjectHeader: () => <header data-testid="project-header">ProjectHeader</header>,
}))

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<MemoryRouter>{component}</MemoryRouter>)
  }

  const mockLayoutStore = async (overrides = {}) => {
    const { useLayoutStore } = await import('../../store/useLayoutStore')
    vi.mocked(useLayoutStore).mockReturnValue({
      navCollapsed: false,
      rightPanelOpen: false,
      rightPanelWidth: 400,
      focusMode: false,
      setRightPanelWidth: vi.fn(),
      toggleNavCollapsed: vi.fn(),
      ...overrides,
    })
  }

  const mockProjectStore = async (isInProject: boolean) => {
    const { useProjectStore } = await import('../../store/useProjectStore')
    vi.mocked(useProjectStore).mockReturnValue({
      isInProject,
      currentProjectId: isInProject ? 'test-id' : null,
      currentProjectName: isInProject ? 'Test Project' : null,
      projectStatus: 'draft',
      progressPercent: 0,
      setCurrentProject: vi.fn(),
      clearCurrentProject: vi.fn(),
      setProjectStatus: vi.fn(),
    })
  }

  it('renders NavBar when isInProject is false', async () => {
    await mockLayoutStore()
    await mockProjectStore(false)

    renderWithRouter(<AppLayout />)

    expect(screen.getByTestId('navbar')).toBeInTheDocument()
    expect(screen.queryByTestId('project-header')).not.toBeInTheDocument()
  })

  it('renders ProjectHeader when isInProject is true', async () => {
    await mockLayoutStore()
    await mockProjectStore(true)

    renderWithRouter(<AppLayout />)

    expect(screen.getByTestId('project-header')).toBeInTheDocument()
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument()
  })

  it('always renders NavRail', async () => {
    await mockLayoutStore()
    await mockProjectStore(false)

    renderWithRouter(<AppLayout />)

    expect(screen.getByTestId('nav-rail')).toBeInTheDocument()
  })

  it('always renders Outlet', async () => {
    await mockLayoutStore()
    await mockProjectStore(false)

    renderWithRouter(<AppLayout />)

    expect(screen.getByTestId('outlet')).toBeInTheDocument()
  })

  it('renders right AI panel when rightPanelOpen is true', async () => {
    await mockLayoutStore({ rightPanelOpen: true })
    await mockProjectStore(false)

    renderWithRouter(<AppLayout />)

    expect(screen.getByTestId('right-panel')).toBeInTheDocument()
    expect(screen.getByTestId('ai-chat-panel')).toBeInTheDocument()
  })

  it('does not render right AI panel when rightPanelOpen is false', async () => {
    await mockLayoutStore({ rightPanelOpen: false })
    await mockProjectStore(false)

    renderWithRouter(<AppLayout />)

    expect(screen.queryByTestId('right-panel')).not.toBeInTheDocument()
  })
})
