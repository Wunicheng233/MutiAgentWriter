import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { expect, describe, test, vi, beforeEach } from 'vitest'
import React from 'react'
import { ToastContext } from '../components/toastContext'

// Mock echarts
vi.mock('echarts-for-react', () => ({
  default: () => <div data-testid="echarts" />,
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

vi.mock('../utils/endpoints', () => ({
  getProject: vi.fn().mockResolvedValue({
    id: 1,
    name: 'Test Project',
    status: 'completed',
    config: {},
  }),
  getProjectAnalytics: vi.fn().mockResolvedValue({
    overall_quality_score: 8.5,
    dimension_average_scores: {},
    chapter_scores: [],
    total_chapters: 5,
    passed_chapters: 4,
  }),
}))

import QualityDashboard from './QualityDashboard'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ToastContext.Provider value={{ showToast: vi.fn() }}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/1/analytics']}>
          <Routes>
            <Route path="/projects/:id/analytics" element={ui} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastContext.Provider>
  )
}

describe('QualityDashboard - ProjectStore 初始化', () => {
  beforeEach(() => {
    mockSetCurrentProject.mockClear()
    mockSetProjectStatus.mockClear()
    vi.clearAllMocks()
  })

  test('当项目数据加载完成后，应该调用 setCurrentProject 传入正确的 id 和 name', async () => {
    renderWithProviders(<QualityDashboard />)

    await waitFor(() => {
      expect(mockSetCurrentProject).toHaveBeenCalledWith('1', 'Test Project')
    })
  })

  test('当项目数据加载完成后，应该调用 setProjectStatus 传入正确的状态', async () => {
    renderWithProviders(<QualityDashboard />)

    await waitFor(() => {
      expect(mockSetProjectStatus).toHaveBeenCalledWith('completed', 100)
    })
  })

  test('对于 generating 状态的项目，进度应该从任务中获取', async () => {
    const getProject = (await import('../utils/endpoints')).getProject as vi.Mock
    getProject.mockResolvedValueOnce({
      id: 1,
      name: 'Generating Project',
      status: 'generating',
      config: {},
      current_generation_task: {
        progress: 0.45,
      },
    })

    const queryClient2 = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ToastContext.Provider value={{ showToast: vi.fn() }}>
        <QueryClientProvider client={queryClient2}>
          <MemoryRouter initialEntries={['/projects/1/analytics']}>
            <Routes>
              <Route path="/projects/:id/analytics" element={<QualityDashboard />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastContext.Provider>
    )

    await waitFor(() => {
      expect(mockSetProjectStatus).toHaveBeenCalledWith('generating', 45)
    })
  })

  test('id 变化时应该重新初始化项目状态', async () => {
    const getProject = (await import('../utils/endpoints')).getProject as vi.Mock
    getProject.mockClear()
    getProject.mockResolvedValue({
      id: 99,
      name: 'Project 99',
      status: 'draft',
      config: {},
    })

    const queryClient2 = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ToastContext.Provider value={{ showToast: vi.fn() }}>
        <QueryClientProvider client={queryClient2}>
          <MemoryRouter initialEntries={['/projects/99/analytics']}>
            <Routes>
              <Route path="/projects/:id/analytics" element={<QualityDashboard />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastContext.Provider>
    )

    await waitFor(() => {
      expect(mockSetCurrentProject).toHaveBeenCalledWith('99', 'Project 99')
      expect(mockSetProjectStatus).toHaveBeenCalledWith('draft', 0)
    })
  })
})
