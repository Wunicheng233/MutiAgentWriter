import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { expect, describe, test, vi, beforeEach } from 'vitest'
import React from 'react'
import { ToastContext } from '../components/toastContext'

// Mock useAuthStore
vi.mock('../store/useAuthStore', () => ({
  useAuthStore: () => ({ user: { id: 1, username: 'test' } }),
}))

// Mock useLayoutStore with setters we can spy on
const mockSetHeaderCollapsed = vi.fn()
const mockAutoExpandHeaderInProject = { current: true }

vi.mock('../store/useLayoutStore', () => ({
  useLayoutStore: <T,>(selector?: (state: Record<string, unknown>) => T) => {
    const state = {
      autoExpandHeaderInProject: mockAutoExpandHeaderInProject.current,
      setHeaderCollapsed: mockSetHeaderCollapsed,
    }
    return selector ? selector(state) : state
  },
}))

// Mock useProjectStore with setters we can spy on
const mockSetCurrentProject = vi.fn()
const mockSetProjectStatus = vi.fn()

vi.mock('../store/useProjectStore', () => ({
  useProjectStore: <T,>(selector?: (state: Record<string, unknown>) => T) => {
    const state = {
      setCurrentProject: mockSetCurrentProject,
      setProjectStatus: mockSetProjectStatus,
    }
    return selector ? selector(state) : state
  },
}))

// Mock Layout
vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../utils/endpoints', () => ({
  getProject: vi.fn().mockResolvedValue({
    id: 1,
    user_id: 1,
    name: 'Test Project',
    description: 'Test',
    content_type: 'full_novel',
    status: 'draft',
    overall_quality_score: 0,
    created_at: '2026-04-25T00:00:00',
    updated_at: '2026-04-25T00:00:00',
    config: {},
  }),
  getProjectWorkflowRuns: vi.fn().mockResolvedValue({ total: 0, items: [] }),
  getProjectArtifacts: vi.fn().mockResolvedValue({ total: 0, items: [] }),
  listCollaborators: vi.fn().mockResolvedValue({ collaborators: [] }),
  getChapter: vi.fn().mockResolvedValue({
    id: 1,
    project_id: 1,
    chapter_index: 1,
    title: '第一章',
    content: '章节正文预览',
    word_count: 6,
    quality_score: 0,
    status: 'draft',
    created_at: '2026-04-25T00:00:00',
    updated_at: '2026-04-25T00:00:00',
  }),
  getProjectTokenStats: vi.fn().mockResolvedValue({ total_tokens: 0, prompt_tokens: 0, completion_tokens: 0, total_cost: 0 }),
  triggerGenerate: vi.fn().mockResolvedValue({}),
  confirmTask: vi.fn().mockResolvedValue({ success: true, new_task_id: 'continue-1' }),
}))

// Mock SkillSelector since it has its own test
vi.mock('../components/SkillSelector', () => ({
  default: () => <div data-testid="skill-selector" />,
}))

import ProjectOverview from './ProjectOverview'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ToastContext.Provider value={{ showToast: vi.fn() }}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/1/overview']}>
          <Routes>
            <Route path="/projects/:id/overview" element={ui} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastContext.Provider>
  )
}

describe('ProjectOverview - UI 优化', () => {
  test('应该有导航到大纲和导出的按钮', async () => {
    renderWithProviders(<ProjectOverview />)
    // 等待导航按钮渲染完成
    const outlineButton = await screen.findByText('大纲')
    const exportButton = await screen.findByText('导出')

    expect(outlineButton.closest('a')).toHaveAttribute('href', '/projects/1/outline')
    expect(exportButton.closest('a')).toHaveAttribute('href', '/projects/1/export')
  })

  test('策划确认状态应该留在概览页弹窗处理，而不是跳转到空的第1章编辑器', async () => {
    const getProject = (await import('../utils/endpoints')).getProject as vi.Mock
    getProject.mockResolvedValueOnce({
      id: 1,
      user_id: 1,
      name: 'Plan Confirm Project',
      description: 'Test',
      content_type: 'full_novel',
      status: 'generating',
      overall_quality_score: 0,
      created_at: '2026-04-25T00:00:00',
      updated_at: '2026-04-25T00:00:00',
      config: { start_chapter: 1, end_chapter: 4 },
      current_generation_task: {
        id: 11,
        project_id: 1,
        celery_task_id: 'task-plan-confirm',
        status: 'waiting_confirm',
        progress: 0.15,
        current_chapter: 0,
        started_at: '2026-04-25T00:00:00',
      },
      chapters: [],
    })

    const queryClient2 = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ToastContext.Provider value={{ showToast: vi.fn() }}>
        <QueryClientProvider client={queryClient2}>
          <MemoryRouter initialEntries={['/projects/1/overview']}>
            <Routes>
              <Route path="/projects/:id/overview" element={<ProjectOverview />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastContext.Provider>
    )

    const confirmButtons = await screen.findAllByRole('button', { name: /处理策划确认|立即确认/ })
    expect(confirmButtons.length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: '处理策划确认' })).not.toBeInTheDocument()
  })

  test('章节确认状态应该留在概览页弹窗处理，而不是跳转到 editor', async () => {
    const endpoints = await import('../utils/endpoints')
    const getProject = endpoints.getProject as vi.Mock
    const getChapter = endpoints.getChapter as vi.Mock

    getProject.mockResolvedValueOnce({
      id: 1,
      user_id: 1,
      name: 'Chapter Confirm Project',
      description: 'Test',
      content_type: 'full_novel',
      status: 'generating',
      overall_quality_score: 0,
      created_at: '2026-04-25T00:00:00',
      updated_at: '2026-04-25T00:00:00',
      config: { start_chapter: 1, end_chapter: 4 },
      current_generation_task: {
        id: 12,
        project_id: 1,
        celery_task_id: 'task-chapter-confirm',
        status: 'waiting_confirm',
        progress: 0.35,
        current_chapter: 2,
        started_at: '2026-04-25T00:00:00',
      },
      chapters: [],
    })
    getChapter.mockResolvedValueOnce({
      id: 2,
      project_id: 1,
      chapter_index: 2,
      title: '第二章',
      content: '<p>第二章正文预览</p>',
      word_count: 8,
      quality_score: 0,
      status: 'draft',
      created_at: '2026-04-25T00:00:00',
      updated_at: '2026-04-25T00:00:00',
    })

    const queryClient2 = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ToastContext.Provider value={{ showToast: vi.fn() }}>
        <QueryClientProvider client={queryClient2}>
          <MemoryRouter initialEntries={['/projects/1/overview']}>
            <Routes>
              <Route path="/projects/:id/overview" element={<ProjectOverview />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastContext.Provider>
    )

    const confirmButtons = await screen.findAllByRole('button', { name: /处理当前章节|立即确认/ })
    expect(confirmButtons.length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: '处理当前章节' })).not.toBeInTheDocument()

    fireEvent.click(confirmButtons[0])

    expect(await screen.findByText('章节内容预览')).toBeInTheDocument()
    expect(await screen.findByText('第二章正文预览')).toBeInTheDocument()
  })

})

describe('ProjectOverview - 自动展开顶栏', () => {
  beforeEach(() => {
    mockSetHeaderCollapsed.mockClear()
    mockAutoExpandHeaderInProject.current = true
  })

  test('当 autoExpandHeaderInProject 为 true 时，进入项目应调用 setHeaderCollapsed(false)', async () => {
    mockAutoExpandHeaderInProject.current = true
    renderWithProviders(<ProjectOverview />)

    await waitFor(() => {
      expect(mockSetHeaderCollapsed).toHaveBeenCalledWith(false)
    })
  })

  test('当 autoExpandHeaderInProject 为 false 时，不修改 headerCollapsed 状态', async () => {
    mockAutoExpandHeaderInProject.current = false
    renderWithProviders(<ProjectOverview />)

    // 等待一小段时间确保 useEffect 已经执行
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(mockSetHeaderCollapsed).not.toHaveBeenCalled()
  })

  test('id 变化时 useEffect 依赖应正确触发', async () => {
    // 验证 useLayoutStore 的正确调用方式
    mockAutoExpandHeaderInProject.current = true

    // 用不同的 id 初始化路由
    const queryClient2 = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <ToastContext.Provider value={{ showToast: vi.fn() }}>
        <QueryClientProvider client={queryClient2}>
          <MemoryRouter initialEntries={['/projects/5/overview']}>
            <Routes>
              <Route path="/projects/:id/overview" element={<ProjectOverview />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastContext.Provider>
    )

    await waitFor(() => {
      expect(mockSetHeaderCollapsed).toHaveBeenCalledWith(false)
    })
  })
})

describe('ProjectOverview - ProjectStore 初始化', () => {
  beforeEach(() => {
    mockSetCurrentProject.mockClear()
    mockSetProjectStatus.mockClear()
    vi.clearAllMocks()
  })

  test('当项目数据加载完成后，应该调用 setCurrentProject 传入正确的 id 和 name', async () => {
    renderWithProviders(<ProjectOverview />)

    await waitFor(() => {
      expect(mockSetCurrentProject).toHaveBeenCalledWith('1', 'Test Project')
    })
  })

  test('当项目数据加载完成后，应该调用 setProjectStatus 传入正确的状态', async () => {
    renderWithProviders(<ProjectOverview />)

    await waitFor(() => {
      expect(mockSetProjectStatus).toHaveBeenCalledWith('draft', 0)
    })
  })

  test('对于 generating 状态的项目，应该传入正确的进度', async () => {
    const getProject = (await import('../utils/endpoints')).getProject as vi.Mock
    getProject.mockResolvedValueOnce({
      id: 1,
      user_id: 1,
      name: 'Generating Project',
      description: 'Test',
      content_type: 'full_novel',
      status: 'generating',
      overall_quality_score: 0,
      created_at: '2026-04-25T00:00:00',
      updated_at: '2026-04-25T00:00:00',
      config: {},
      current_generation_task: {
        progress: 0.5,
      },
    })

    const queryClient2 = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ToastContext.Provider value={{ showToast: vi.fn() }}>
        <QueryClientProvider client={queryClient2}>
          <MemoryRouter initialEntries={['/projects/1/overview']}>
            <Routes>
              <Route path="/projects/:id/overview" element={<ProjectOverview />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastContext.Provider>
    )

    await waitFor(() => {
      expect(mockSetProjectStatus).toHaveBeenCalledWith('generating', 50)
    })
  })

  test('id 变化时应该重新初始化项目状态', async () => {
    const getProject = (await import('../utils/endpoints')).getProject as vi.Mock
    getProject.mockClear()
    getProject.mockResolvedValue({
      id: 2,
      user_id: 1,
      name: 'Another Project',
      description: 'Test',
      content_type: 'full_novel',
      status: 'completed',
      overall_quality_score: 8.5,
      created_at: '2026-04-25T00:00:00',
      updated_at: '2026-04-25T00:00:00',
      config: {},
      chapters: [],
    })

    const queryClient2 = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ToastContext.Provider value={{ showToast: vi.fn() }}>
        <QueryClientProvider client={queryClient2}>
          <MemoryRouter initialEntries={['/projects/2/overview']}>
            <Routes>
              <Route path="/projects/:id/overview" element={<ProjectOverview />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastContext.Provider>
    )

    await waitFor(() => {
      expect(mockSetCurrentProject).toHaveBeenCalledWith('2', 'Another Project')
      expect(mockSetProjectStatus).toHaveBeenCalledWith('completed', 100)
    })
  })
})
