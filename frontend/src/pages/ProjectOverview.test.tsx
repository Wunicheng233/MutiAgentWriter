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
  getGenerationQuota: vi.fn().mockResolvedValue({
    daily_limit: 3,
    used_today: 0,
    remaining_today: 3,
    reset_at: '2026-04-26T00:00:00',
    api_source: 'system',
    platform_token_budget_applies: true,
    monthly_token_limit: 100000,
    monthly_tokens_used: 0,
    monthly_tokens_remaining: 100000,
    monthly_reset_at: '2026-05-01T00:00:00',
    allowed: true,
    reason: null,
  }),
  getGenerationPreflight: vi.fn().mockResolvedValue({
    start_chapter: 1,
    end_chapter: 10,
    chapter_count: 10,
    target_words_per_chapter: 2000,
    estimated_output_words: 20000,
    estimated_token_count: 105000,
    api_source: 'system',
    platform_token_budget_applies: true,
    monthly_token_limit: 100000,
    monthly_tokens_remaining: 100000,
    daily_remaining: 3,
    quota_allowed: true,
    risk_level: 'warning',
    messages: ['预计本次生成可能超过本月平台 Token 预算，建议减少章节范围或改用自带 Key。'],
  }),
  triggerGenerate: vi.fn().mockResolvedValue({}),
  cancelGeneration: vi.fn().mockResolvedValue({ status: 'ok', message: '生成任务已取消', cancelled_count: 1 }),
  resumeGeneration: vi.fn().mockResolvedValue({}),
  cleanStuckTasks: vi.fn().mockResolvedValue({ status: 'ok', message: '已清理 1 个卡住的任务', cleaned_count: 1 }),
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

  test('每日生成配额用尽时应在概览页禁用生成入口', async () => {
    const endpoints = await import('../utils/endpoints')
    const getGenerationQuota = endpoints.getGenerationQuota as vi.Mock

    getGenerationQuota.mockResolvedValueOnce({
      daily_limit: 3,
      used_today: 3,
      remaining_today: 0,
      reset_at: '2026-04-26T00:00:00',
      api_source: 'system',
      platform_token_budget_applies: true,
      monthly_token_limit: 100000,
      monthly_tokens_used: 0,
      monthly_tokens_remaining: 100000,
      monthly_reset_at: '2026-05-01T00:00:00',
      allowed: false,
      reason: '今日生成次数已用完，请明天再试。',
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

    expect(await screen.findByText('今日生成 0 / 3')).toBeInTheDocument()
    const button = await screen.findByRole('button', { name: '今日生成次数已用完' })
    expect(button).toBeDisabled()
  })

  test('月度 token 预算用尽时应在概览页禁用生成入口', async () => {
    const endpoints = await import('../utils/endpoints')
    const getGenerationQuota = endpoints.getGenerationQuota as vi.Mock

    getGenerationQuota.mockResolvedValueOnce({
      daily_limit: 3,
      used_today: 0,
      remaining_today: 3,
      reset_at: '2026-04-26T00:00:00',
      api_source: 'system',
      platform_token_budget_applies: true,
      monthly_token_limit: 10000,
      monthly_tokens_used: 10000,
      monthly_tokens_remaining: 0,
      monthly_reset_at: '2026-05-01T00:00:00',
      allowed: false,
      reason: '本月 Token 预算已用完，请下月再试。',
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

    expect(await screen.findByText('本月 Token 0 / 10,000')).toBeInTheDocument()
    const button = await screen.findByRole('button', { name: '本月 Token 预算已用完' })
    expect(button).toBeDisabled()
  })

  test('用户自带 API Key 时应提示不占用平台 token 预算', async () => {
    const endpoints = await import('../utils/endpoints')
    const getGenerationQuota = endpoints.getGenerationQuota as vi.Mock

    getGenerationQuota.mockResolvedValueOnce({
      daily_limit: 3,
      used_today: 1,
      remaining_today: 2,
      reset_at: '2026-04-26T00:00:00',
      api_source: 'user',
      platform_token_budget_applies: false,
      monthly_token_limit: null,
      monthly_tokens_used: 10000,
      monthly_tokens_remaining: null,
      monthly_reset_at: '2026-05-01T00:00:00',
      allowed: true,
      reason: null,
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

    expect(await screen.findByText('自带 Key，不占用平台 Token 预算')).toBeInTheDocument()
    expect(screen.queryByText(/本月 Token/)).not.toBeInTheDocument()
  })

  test('概览页应该展示生成前 token 估算和预算风险', async () => {
    const endpoints = await import('../utils/endpoints')
    const getGenerationPreflight = endpoints.getGenerationPreflight as vi.Mock

    getGenerationPreflight.mockResolvedValueOnce({
      start_chapter: 2,
      end_chapter: 3,
      chapter_count: 2,
      target_words_per_chapter: 1000,
      estimated_output_words: 2000,
      estimated_token_count: 14100,
      api_source: 'system',
      platform_token_budget_applies: true,
      monthly_token_limit: 5000,
      monthly_tokens_remaining: 4100,
      daily_remaining: 3,
      quota_allowed: true,
      risk_level: 'warning',
      messages: ['预计本次生成可能超过本月平台 Token 预算，建议减少章节范围或改用自带 Key。'],
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

    expect(await screen.findByText('生成预估：2 章 · 约 2,000 字 · 约 14,100 Token')).toBeInTheDocument()
    expect(screen.getByText(/预计本次生成可能超过本月平台 Token 预算/)).toBeInTheDocument()
  })

  test('概览页应该区分平台 API 和自带 Key 的实际 token 用量', async () => {
    const endpoints = await import('../utils/endpoints')
    const getProjectTokenStats = endpoints.getProjectTokenStats as vi.Mock

    getProjectTokenStats.mockResolvedValueOnce({
      total_prompt_tokens: 700,
      total_completion_tokens: 1300,
      total_tokens: 2000,
      system_api_tokens: 900,
      user_api_tokens: 1100,
      estimated_cost_usd: 0.0038,
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

    expect(await screen.findByText('平台 API 900 Token')).toBeInTheDocument()
    expect(screen.getByText('自带 Key 1,100 Token')).toBeInTheDocument()
  })

  test('失败项目应该显示恢复操作而不是只展示技术错误', async () => {
    const endpoints = await import('../utils/endpoints')
    const getProject = endpoints.getProject as vi.Mock

    getProject.mockResolvedValueOnce({
      id: 1,
      user_id: 1,
      name: 'Failed Project',
      description: 'Test',
      content_type: 'full_novel',
      status: 'failed',
      overall_quality_score: 0,
      created_at: '2026-04-25T00:00:00',
      updated_at: '2026-04-25T00:00:00',
      config: { start_chapter: 1, end_chapter: 4 },
      current_generation_task: {
        id: 13,
        project_id: 1,
        celery_task_id: 'task-failed',
        status: 'failure',
        progress: 0.2,
        current_chapter: 1,
        current_step: 'Writer Agent调用失败',
        error_message: '模型 API Key 为空',
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

    expect(await screen.findByText('生成失败，可以恢复')).toBeInTheDocument()
    expect(screen.getAllByText('模型 API Key 为空').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '继续生成' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新生成' })).toBeInTheDocument()
  })

  test('失败项目应该允许从最后成功章节继续生成', async () => {
    const endpoints = await import('../utils/endpoints')
    const getProject = endpoints.getProject as vi.Mock
    const resumeGeneration = endpoints.resumeGeneration as vi.Mock

    getProject.mockResolvedValueOnce({
      id: 1,
      user_id: 1,
      name: 'Failed Partial Project',
      description: 'Test',
      content_type: 'full_novel',
      status: 'failed',
      overall_quality_score: 0,
      created_at: '2026-04-25T00:00:00',
      updated_at: '2026-04-25T00:00:00',
      config: { start_chapter: 1, end_chapter: 4 },
      current_generation_task: {
        id: 14,
        project_id: 1,
        celery_task_id: 'task-failed-partial',
        status: 'failure',
        progress: 0.5,
        current_chapter: 2,
        error_message: '第 3 章生成失败',
        started_at: '2026-04-25T00:00:00',
      },
      chapters: [
        { id: 1, project_id: 1, chapter_index: 1, title: '第一章', content: '1', word_count: 1000, quality_score: 8, status: 'generated', created_at: '2026-04-25T00:00:00', updated_at: '2026-04-25T00:00:00' },
        { id: 2, project_id: 1, chapter_index: 2, title: '第二章', content: '2', word_count: 1000, quality_score: 8, status: 'generated', created_at: '2026-04-25T00:00:00', updated_at: '2026-04-25T00:00:00' },
      ],
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

    const button = await screen.findByRole('button', { name: '继续生成' })
    fireEvent.click(button)

    await waitFor(() => {
      expect(resumeGeneration).toHaveBeenCalledWith(1)
    })
  })

  test('生成中项目应该允许用户取消当前生成任务', async () => {
    const endpoints = await import('../utils/endpoints')
    const getProject = endpoints.getProject as vi.Mock
    const cancelGeneration = endpoints.cancelGeneration as vi.Mock

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
      config: { start_chapter: 1, end_chapter: 4 },
      current_generation_task: {
        id: 15,
        project_id: 1,
        celery_task_id: 'task-running',
        status: 'progress',
        progress: 0.4,
        current_chapter: 2,
        current_step: 'writer',
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

    const button = await screen.findByRole('button', { name: '取消生成' })
    fireEvent.click(button)

    await waitFor(() => {
      expect(cancelGeneration).toHaveBeenCalledWith(1)
    })
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
