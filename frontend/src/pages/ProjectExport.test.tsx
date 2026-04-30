import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { expect, describe, test, vi, beforeEach } from 'vitest'
import React from 'react'
import { ToastContext } from '../components/toastContext'

// Mock useAuthStore with proper selector support
vi.mock('../store/useAuthStore', () => ({
  useAuthStore: <T,>(selector?: (state: Record<string, unknown>) => T) => {
    const state = { user: { id: 1, username: 'test' } }
    return selector ? selector(state) : state
  },
}))

// Mock useLayoutStore
vi.mock('../store/useLayoutStore', () => ({
  useLayoutStore: <T,>(selector?: (state: Record<string, unknown>) => T) => {
    const state = {
      autoExpandHeaderInProject: true,
      setHeaderCollapsed: vi.fn(),
    }
    return selector ? selector(state) : state
  },
}))

// Mock useProjectStore with proper selector support
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
    description: 'Test Description',
    content_type: 'full_novel',
    status: 'completed',
    overall_quality_score: 8.5,
    created_at: '2026-04-25T00:00:00',
    updated_at: '2026-04-25T00:00:00',
    config: {},
    chapters: [{ id: 1 }, { id: 2 }],
  }),
  listCollaborators: vi.fn().mockResolvedValue([
    { id: 1, username: 'collab1', email: 'collab1@test.com', role: 'editor' },
  ]),
  getProjectTokenStats: vi.fn().mockResolvedValue({ total_tokens: 0, estimated_cost_usd: 0 }),
}))

import ProjectExport from './ProjectExport'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ToastContext.Provider value={{ showToast: vi.fn() }}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/1/export']}>
          <Routes>
            <Route path="/projects/:id/export" element={ui} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastContext.Provider>
  )
}

describe('ProjectExport - 导出分享页面', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('应该渲染页面标题"导出分享"', async () => {
    renderWithProviders(<ProjectExport />)

    await waitFor(() => {
      const headings = screen.getAllByText(/导出分享/i)
      expect(headings.length).toBeGreaterThan(0)
    })
  })

  test('应该显示导出格式选项', async () => {
    renderWithProviders(<ProjectExport />)

    await waitFor(() => {
      expect(screen.getByText('EPUB')).toBeInTheDocument()
      expect(screen.getByText('DOCX')).toBeInTheDocument()
      expect(screen.getByText('HTML')).toBeInTheDocument()
    })
  })

  test('应该显示分享链接管理', async () => {
    renderWithProviders(<ProjectExport />)

    await waitFor(() => {
      expect(screen.getByText(/分享链接/i)).toBeInTheDocument()
    })
  })

  test('应该显示协作者管理', async () => {
    renderWithProviders(<ProjectExport />)

    await waitFor(() => {
      expect(screen.getAllByText(/协作者/i).length).toBeGreaterThan(0)
      expect(screen.getByText('collab1')).toBeInTheDocument()
      expect(screen.getByText('collab1@test.com')).toBeInTheDocument()
    })
  })

  test('不应该混入质量中心内容', async () => {
    renderWithProviders(<ProjectExport />)

    await waitFor(() => {
      expect(screen.queryByText(/质量与交付/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/总体评分/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/质量分析/i)).not.toBeInTheDocument()
    })
  })

  test('不应该混入关键产物列表', async () => {
    renderWithProviders(<ProjectExport />)

    await waitFor(() => {
      expect(screen.queryByText(/关键产物/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Current Artifacts/i)).not.toBeInTheDocument()
    })
  })

  test('应该有返回项目概览的链接', async () => {
    renderWithProviders(<ProjectExport />)

    await waitFor(() => {
      const backButton = screen.getByText(/返回概览/i)
      expect(backButton).toBeInTheDocument()
      expect(backButton.closest('a')).toHaveAttribute('href', '/projects/1/overview')
    })
  })

  test('应该显示交付状态而不是章节质量统计', async () => {
    renderWithProviders(<ProjectExport />)

    await waitFor(() => {
      expect(screen.getByText(/可导出/i)).toBeInTheDocument()
      expect(screen.getByText(/分享链接/i)).toBeInTheDocument()
    })
  })
})
