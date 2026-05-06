import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavRail } from './NavRail'

// Mock the store
vi.mock('../../store/useProjectStore', () => ({
  useProjectStore: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockNavigate = vi.fn()

describe('NavRail', () => {
  const mockToggleCollapse = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderWithRouter = (component: React.ReactElement, initialRoute = '/') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        {component}
      </MemoryRouter>
    )
  }

  describe('全局导航模式（不在项目中）', () => {
    beforeEach(async () => {
      const { useProjectStore } = await import('../../store/useProjectStore')
      vi.mocked(useProjectStore).mockReturnValue({
        isInProject: false,
        currentProjectId: null,
      })
    })

    it('显示全局导航项（书架、设置）', () => {
      renderWithRouter(<NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />)

      const navItems = screen.getAllByTestId('nav-item')
      expect(navItems).toHaveLength(2)
    })

    it('点击"书架"导航项跳转到 /dashboard', async () => {
      renderWithRouter(<NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />, '/settings')

      const navItems = screen.getAllByTestId('nav-item')
      await fireEvent.click(navItems[0])

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })

    it('书架项在 /dashboard 路径下显示为激活状态', () => {
      renderWithRouter(
        <NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />,
        '/dashboard'
      )

      const navItems = screen.getAllByTestId('nav-item')
      expect(navItems[0]).toHaveAttribute('aria-current', 'page')
    })

    it('直接打开项目 URL 时，即使项目 store 尚未初始化，也应显示项目内导航', async () => {
      renderWithRouter(
        <NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />,
        '/projects/42/overview'
      )

      const navItems = screen.getAllByTestId('nav-item')
      expect(navItems).toHaveLength(9)

      await fireEvent.click(navItems[3])
      expect(mockNavigate).toHaveBeenCalledWith('/projects/42/read/1')
    })
  })

  describe('项目内导航模式（在项目中）', () => {
    const testProjectId = 'test-project-123'

    beforeEach(async () => {
      const { useProjectStore } = await import('../../store/useProjectStore')
      vi.mocked(useProjectStore).mockReturnValue({
        isInProject: true,
        currentProjectId: testProjectId,
      })
    })

    it('显示项目内导航项（概览、大纲、章节等）', () => {
      renderWithRouter(
        <NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />,
        `/projects/${testProjectId}/overview`
      )

      const navItems = screen.getAllByTestId('nav-item')
      expect(navItems).toHaveLength(9)
    })

    it('点击"概览"导航项跳转到 /projects/${id}/overview', async () => {
      renderWithRouter(
        <NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />,
        `/projects/${testProjectId}/chapters`
      )

      const navItems = screen.getAllByTestId('nav-item')
      await fireEvent.click(navItems[0])

      expect(mockNavigate).toHaveBeenCalledWith(`/projects/${testProjectId}/overview`)
    })

    it('点击"阅读器"导航项跳转到默认第 1 章阅读页', async () => {
      renderWithRouter(
        <NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />,
        `/projects/${testProjectId}/overview`
      )

      const navItems = screen.getAllByTestId('nav-item')
      await fireEvent.click(navItems[3])

      expect(mockNavigate).toHaveBeenCalledWith(`/projects/${testProjectId}/read/1`)
    })

    it('点击"编辑器"导航项跳转到默认第 1 章编辑页，而不是无章节号的空路由', async () => {
      renderWithRouter(
        <NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />,
        `/projects/${testProjectId}/overview`
      )

      const navItems = screen.getAllByTestId('nav-item')
      await fireEvent.click(navItems[4])

      expect(mockNavigate).toHaveBeenCalledWith(`/projects/${testProjectId}/editor/1`)
    })

    it('项目内各个导航项在对应路径下显示为激活状态', () => {
      const testCases = [
        { path: 'overview', index: 0 },
        { path: 'outline', index: 1 },
        { path: 'chapters', index: 2 },
        { path: 'read/1', index: 3 },
        { path: 'editor/1', index: 4 },
        { path: 'bible', index: 5 },
        { path: 'analytics', index: 6 },
        { path: 'versions', index: 7 },
        { path: 'export', index: 8 },
      ]

      testCases.forEach(({ path, index }) => {
        const { rerender } = renderWithRouter(
          <NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />,
          `/projects/${testProjectId}/${path}`
        )

        const navItems = screen.getAllByTestId('nav-item')
        expect(navItems[index]).toHaveAttribute('aria-current', 'page')

        rerender(<></>)
      })
    })
  })

  describe('折叠/展开功能', () => {
    beforeEach(async () => {
      const { useProjectStore } = await import('../../store/useProjectStore')
      vi.mocked(useProjectStore).mockReturnValue({
        isInProject: false,
        currentProjectId: null,
      })
    })

    it('点击折叠按钮时调用 onToggleCollapse 回调', async () => {
      renderWithRouter(<NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />)

      const collapseButton = screen.getByTestId('collapse-button')
      await fireEvent.click(collapseButton)

      expect(mockToggleCollapse).toHaveBeenCalledTimes(1)
    })

    it('收起时显示所有导航项图标和展开按钮', () => {
      renderWithRouter(<NavRail collapsed={true} onToggleCollapse={mockToggleCollapse} />)

      const collapseButton = screen.getByTestId('collapse-button')
      expect(collapseButton).toBeInTheDocument()

      const navItems = screen.getAllByTestId('nav-item')
      expect(navItems).toHaveLength(2)
    })

    it('收起时宽度为 56px，只显示图标', () => {
      renderWithRouter(<NavRail collapsed={true} onToggleCollapse={mockToggleCollapse} />)

      const navRail = screen.getByTestId('nav-rail')
      expect(navRail).toHaveStyle({ width: '56px' })
    })

    it('展开时显示所有导航项和折叠按钮', () => {
      renderWithRouter(<NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />)

      const navItems = screen.getAllByTestId('nav-item')
      const collapseButton = screen.getByTestId('collapse-button')

      expect(navItems).toHaveLength(2)
      expect(collapseButton).toBeInTheDocument()
    })

    it('底部有折叠按钮', () => {
      renderWithRouter(<NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />)

      const collapseButton = screen.getByTestId('collapse-button')
      expect(collapseButton).toBeInTheDocument()
    })

    it('点击折叠按钮调用 onToggleCollapse', async () => {
      renderWithRouter(<NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />)

      const collapseButton = screen.getByTestId('collapse-button')
      await fireEvent.click(collapseButton)

      expect(mockToggleCollapse).toHaveBeenCalledTimes(1)
    })
  })

  describe('可访问性', () => {
    beforeEach(async () => {
      const { useProjectStore } = await import('../../store/useProjectStore')
      vi.mocked(useProjectStore).mockReturnValue({
        isInProject: false,
        currentProjectId: null,
      })
    })

    it('导航容器有正确的 aria-label', () => {
      renderWithRouter(<NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />)

      const navRail = screen.getByTestId('nav-rail')
      expect(navRail).toHaveAttribute('aria-label', 'Main navigation')
    })

    it('导航项有正确的 aria-label', () => {
      renderWithRouter(<NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />)

      const navItems = screen.getAllByTestId('nav-item')
      navItems.forEach(item => {
        expect(item).toHaveAttribute('aria-label')
      })
    })

    it('激活的导航项有 aria-current="page" 属性', () => {
      renderWithRouter(
        <NavRail collapsed={false} onToggleCollapse={mockToggleCollapse} />,
        '/dashboard'
      )

      const activeItem = screen.getByRole('button', { current: 'page' })
      expect(activeItem).toBeInTheDocument()
    })
  })
})
