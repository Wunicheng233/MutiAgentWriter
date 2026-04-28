import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { expect, describe, test, vi, beforeEach } from 'vitest'
import React from 'react'
import { ToastContext } from '../components/toastContext'

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
    status: 'draft',
    config: {},
  }),
  getProjectWorkflowRuns: vi.fn().mockResolvedValue({ total: 0, items: [] }),
  listChapters: vi.fn().mockResolvedValue([]),
}))

import ChapterList from './ChapterList'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ToastContext.Provider value={{ showToast: vi.fn() }}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/1/chapters']}>
          <Routes>
            <Route path="/projects/:id/chapters" element={ui} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastContext.Provider>
  )
}

describe('ChapterList - ProjectStore 初始化', () => {
  beforeEach(() => {
    mockSetCurrentProject.mockClear()
    mockSetProjectStatus.mockClear()
    vi.clearAllMocks()
  })

  test('当项目数据加载完成后，应该调用 setCurrentProject 传入正确的 id 和 name', async () => {
    renderWithProviders(<ChapterList />)

    await waitFor(() => {
      expect(mockSetCurrentProject).toHaveBeenCalledWith('1', 'Test Project')
    })
  })

  test('当项目数据加载完成后，应该调用 setProjectStatus 传入正确的状态', async () => {
    renderWithProviders(<ChapterList />)

    await waitFor(() => {
      expect(mockSetProjectStatus).toHaveBeenCalledWith('draft', 0)
    })
  })

  test('对于 completed 状态的项目，进度应该为 100', async () => {
    const getProject = (await import('../utils/endpoints')).getProject as vi.Mock
    getProject.mockResolvedValueOnce({
      id: 1,
      name: 'Completed Project',
      status: 'completed',
      config: {},
      chapters: [{ id: 1 }, { id: 2 }, { id: 3 }],
    })

    const queryClient2 = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ToastContext.Provider value={{ showToast: vi.fn() }}>
        <QueryClientProvider client={queryClient2}>
          <MemoryRouter initialEntries={['/projects/1/chapters']}>
            <Routes>
              <Route path="/projects/:id/chapters" element={<ChapterList />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastContext.Provider>
    )

    await waitFor(() => {
      expect(mockSetProjectStatus).toHaveBeenCalledWith('completed', 100)
    })
  })

  test('id 变化时应该重新初始化项目状态', async () => {
    const getProject = (await import('../utils/endpoints')).getProject as vi.Mock
    getProject.mockClear()
    getProject.mockResolvedValue({
      id: 5,
      name: 'Different Project',
      status: 'generating',
      config: {
        start_chapter: 1,
        end_chapter: 10,
      },
      current_generation_task: {
        progress: 0.3,
      },
    })

    const queryClient2 = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ToastContext.Provider value={{ showToast: vi.fn() }}>
        <QueryClientProvider client={queryClient2}>
          <MemoryRouter initialEntries={['/projects/5/chapters']}>
            <Routes>
              <Route path="/projects/:id/chapters" element={<ChapterList />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastContext.Provider>
    )

    await waitFor(() => {
      expect(mockSetCurrentProject).toHaveBeenCalledWith('5', 'Different Project')
      expect(mockSetProjectStatus).toHaveBeenCalledWith('generating', 30)
    })
  })
})
