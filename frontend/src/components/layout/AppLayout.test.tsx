import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'

const mockRouterState = vi.hoisted(() => ({
  pathname: '/',
}))

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
    useLocation: () => ({ pathname: mockRouterState.pathname }),
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
    mockRouterState.pathname = '/'
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
      setRightPanelOpen: vi.fn(),
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
    mockRouterState.pathname = '/projects/test-id/overview'
    await mockLayoutStore()
    await mockProjectStore(true)

    renderWithRouter(<AppLayout />)

    expect(screen.getByTestId('project-header')).toBeInTheDocument()
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument()
  })

  it('renders ProjectHeader on project routes even before the project store is hydrated', async () => {
    mockRouterState.pathname = '/projects/42/overview'
    await mockLayoutStore()
    await mockProjectStore(false)

    renderWithRouter(<AppLayout />)

    expect(screen.getByTestId('project-header')).toBeInTheDocument()
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument()
  })

  it('renders NavBar on non-project routes even if stale project state remains', async () => {
    mockRouterState.pathname = '/dashboard'
    await mockLayoutStore()
    await mockProjectStore(true)

    renderWithRouter(<AppLayout />)

    expect(screen.getByTestId('navbar')).toBeInTheDocument()
    expect(screen.queryByTestId('project-header')).not.toBeInTheDocument()
  })

  it('renders NavRail when navigation is expanded', async () => {
    await mockLayoutStore()
    await mockProjectStore(false)

    renderWithRouter(<AppLayout />)

    expect(screen.getByTestId('nav-rail')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-rail-reopen')).not.toBeInTheDocument()
  })

  it('hides NavRail and shows a compact reopen button when navigation is collapsed', async () => {
    const toggleNavCollapsed = vi.fn()
    await mockLayoutStore({ navCollapsed: true, toggleNavCollapsed })
    await mockProjectStore(false)

    renderWithRouter(<AppLayout />)

    expect(screen.queryByTestId('nav-rail')).not.toBeInTheDocument()
    const reopenButton = screen.getByTestId('nav-rail-reopen')
    expect(reopenButton).toHaveAttribute('aria-label', '展开侧边栏')

    fireEvent.click(reopenButton)
    expect(toggleNavCollapsed).toHaveBeenCalledTimes(1)
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
    expect(screen.getByTestId('ai-panel')).toBeInTheDocument()
  })

  it('does not render right AI panel when rightPanelOpen is false', async () => {
    await mockLayoutStore({ rightPanelOpen: false })
    await mockProjectStore(false)

    renderWithRouter(<AppLayout />)

    expect(screen.queryByTestId('right-panel')).not.toBeInTheDocument()
  })
})
