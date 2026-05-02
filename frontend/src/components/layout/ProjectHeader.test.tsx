import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectHeader } from './ProjectHeader'

// Mock the stores
vi.mock('../../store/useProjectStore', () => ({
  useProjectStore: vi.fn(),
}))

const mockToggleHeader = vi.fn()

vi.mock('../../store/useLayoutStore', () => ({
  useLayoutStore: vi.fn(() => ({
    headerCollapsed: false,
    toggleHeader: mockToggleHeader,
  })),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

describe('ProjectHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders project name and status correctly', async () => {
    const { useProjectStore } = await import('../../store/useProjectStore')
    vi.mocked(useProjectStore).mockReturnValue({
      currentProjectName: '星际迷航',
      projectStatus: 'generating',
      progressPercent: 57,
      clearCurrentProject: vi.fn(),
    })

    render(<ProjectHeader />)
    expect(screen.getByText('星际迷航')).toBeInTheDocument()
    expect(screen.getByText('生成中')).toBeInTheDocument()
  })

  it('生成进度只显示整数百分比', async () => {
    const { useProjectStore } = await import('../../store/useProjectStore')
    vi.mocked(useProjectStore).mockReturnValue({
      currentProjectName: '测试项目',
      projectStatus: 'generating',
      progressPercent: 55.00000000000001,
      clearCurrentProject: vi.fn(),
    })

    render(<ProjectHeader />)
    expect(screen.getByText('55%')).toBeInTheDocument()
    expect(screen.queryByText(/55\.000/)).not.toBeInTheDocument()
  })

  it('shows back to shelf button', async () => {
    const { useProjectStore } = await import('../../store/useProjectStore')
    vi.mocked(useProjectStore).mockReturnValue({
      currentProjectName: '测试项目',
      projectStatus: 'draft',
      progressPercent: 0,
      clearCurrentProject: vi.fn(),
    })

    render(<ProjectHeader />)
    expect(screen.getByText('书架')).toBeInTheDocument()
  })

  it('navigates back to shelf when back button is clicked', async () => {
    const mockNavigate = vi.fn()
    vi.doMock('react-router-dom', async () => ({
      ...await vi.importActual('react-router-dom'),
      useNavigate: () => mockNavigate,
    }))

    const { useProjectStore } = await import('../../store/useProjectStore')
    const mockClear = vi.fn()
    vi.mocked(useProjectStore).mockReturnValue({
      currentProjectName: '测试项目',
      projectStatus: 'draft',
      progressPercent: 0,
      clearCurrentProject: mockClear,
    })

    render(<ProjectHeader />)
    await fireEvent.click(screen.getByText('书架'))
    expect(mockClear).toHaveBeenCalled()
  })

  describe('折叠功能', () => {
    beforeEach(async () => {
      const { useProjectStore } = await import('../../store/useProjectStore')
      vi.mocked(useProjectStore).mockReturnValue({
        currentProjectName: '测试项目',
        projectStatus: 'draft',
        progressPercent: 0,
        clearCurrentProject: vi.fn(),
      })
    })

    it('收起时内容不可见', async () => {
      const { useLayoutStore } = await import('../../store/useLayoutStore')
      vi.mocked(useLayoutStore).mockReturnValue({
        headerCollapsed: true,
        toggleHeader: mockToggleHeader,
      })

      render(<ProjectHeader />)
      const header = screen.getByTestId('project-header')
      expect(header).toHaveClass('header-collapsed')
    })

    it('展开时内容可见', async () => {
      const { useLayoutStore } = await import('../../store/useLayoutStore')
      vi.mocked(useLayoutStore).mockReturnValue({
        headerCollapsed: false,
        toggleHeader: mockToggleHeader,
      })

      render(<ProjectHeader />)
      const header = screen.getByTestId('project-header')
      expect(header).toHaveClass('header-expanded')
    })

    it('点击明确的收起按钮调用 toggleHeader', async () => {
      const { useLayoutStore } = await import('../../store/useLayoutStore')
      vi.mocked(useLayoutStore).mockReturnValue({
        headerCollapsed: false,
        toggleHeader: mockToggleHeader,
      })

      render(<ProjectHeader />)
      await fireEvent.click(screen.getByRole('button', { name: '收起顶栏' }))
      expect(mockToggleHeader).toHaveBeenCalledTimes(1)
    })

    it('点击收起状态的顶栏调用 toggleHeader', async () => {
      const { useLayoutStore } = await import('../../store/useLayoutStore')
      vi.mocked(useLayoutStore).mockReturnValue({
        headerCollapsed: true,
        toggleHeader: mockToggleHeader,
      })

      render(<ProjectHeader />)
      const header = screen.getByTestId('project-header')
      await fireEvent.click(header)
      expect(mockToggleHeader).toHaveBeenCalledTimes(1)
    })
  })
})
