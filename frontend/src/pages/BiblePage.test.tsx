import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BiblePage from './BiblePage'

// Mock stores
vi.mock('../store/useBibleStore', () => ({
  useBibleStore: vi.fn(() => ({
    bible: {
      version: 1,
      characters: [],
      world: {},
      plot: {},
      todos: [],
    },
    loadFromProject: vi.fn().mockResolvedValue(undefined),
    saveToProject: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
    error: null,
  })),
}))

vi.mock('../store/useLayoutStore', () => ({
  useLayoutStore: vi.fn(() => ({
    setRightPanelContent: vi.fn(),
    setRightPanelOpen: vi.fn(),
  })),
}))

vi.mock('../store/useProjectStore', () => ({
  useProjectStore: vi.fn(() => ({
    currentProjectId: '1',
  })),
}))

vi.mock('../utils/endpoints', () => ({
  getProject: vi.fn().mockResolvedValue({
    id: 1,
    name: 'Test Project',
    bible: null,
  }),
}))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const renderWithRouter = (initialRoute = '/projects/1/bible') => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/projects/:id/bible" element={<BiblePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BiblePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染页面标题和四个标签页', () => {
    renderWithRouter()

    expect(screen.getByText('设定库')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '角色设定' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '世界观设定' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '情节设定' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '待办事项' })).toBeInTheDocument()
  })

  it('默认显示角色设定标签页', () => {
    renderWithRouter()

    const characterTab = screen.getByRole('tab', { name: '角色设定' })
    expect(characterTab).toHaveAttribute('aria-selected', 'true')
  })

  it('点击标签页可以切换内容', async () => {
    renderWithRouter()

    const worldTab = screen.getByRole('tab', { name: '世界观设定' })
    await fireEvent.click(worldTab)

    expect(worldTab).toHaveAttribute('aria-selected', 'true')
  })

  it('显示"从策划文档导入"按钮', () => {
    renderWithRouter()

    expect(screen.getByText('从策划文档导入')).toBeInTheDocument()
  })
})
