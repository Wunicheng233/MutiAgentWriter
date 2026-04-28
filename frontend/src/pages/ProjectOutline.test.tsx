import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { expect, describe, test, vi, beforeEach } from 'vitest'
import React from 'react'
import { ToastContext } from '../components/toastContext'

// Mock useAuthStore
vi.mock('../store/useAuthStore', () => ({
  useAuthStore: () => ({ user: { id: 1, username: 'test' } }),
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
    status: 'draft',
    overall_quality_score: 0,
    created_at: '2026-04-25T00:00:00',
    updated_at: '2026-04-25T00:00:00',
    config: {
      core_requirement: '这是核心需求',
      characters: [
        { name: '角色一', role: '主角' },
        { name: '角色二', role: '配角' },
      ],
      chapter_outline: [
        { number: 1, title: '第一章' },
        { number: 2, title: '第二章' },
      ],
    },
    chapters: [],
  }),
  getProjectTokenStats: vi.fn().mockResolvedValue({ total_tokens: 0, estimated_cost_usd: 0 }),
}))

// Mock SkillSelector
vi.mock('../components/SkillSelector', () => ({
  default: () => <div data-testid="skill-selector" />,
}))

import ProjectOutline from './ProjectOutline'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ToastContext.Provider value={{ showToast: vi.fn() }}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/1/outline']}>
          <Routes>
            <Route path="/projects/:id/outline" element={ui} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastContext.Provider>
  )
}

describe('ProjectOutline - 大纲设定页面', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('应该渲染页面标题"大纲设定"', async () => {
    renderWithProviders(<ProjectOutline />)

    await waitFor(() => {
      const headings = screen.getAllByText(/大纲设定/i)
      expect(headings.length).toBeGreaterThan(0)
    })
  })

  test('应该显示创作配置部分', async () => {
    renderWithProviders(<ProjectOutline />)

    await waitFor(() => {
      expect(screen.getByText(/创作配置/i)).toBeInTheDocument()
    })
  })

  test('应该显示核心需求内容', async () => {
    renderWithProviders(<ProjectOutline />)

    await waitFor(() => {
      expect(screen.getByText('这是核心需求')).toBeInTheDocument()
    })
  })

  test('应该显示生成模式和章节范围信息', async () => {
    renderWithProviders(<ProjectOutline />)

    await waitFor(() => {
      expect(screen.getByText(/生成模式/i)).toBeInTheDocument()
      expect(screen.getByText(/章节范围/i)).toBeInTheDocument()
    })
  })

  test('应该显示 Skill 配置部分和管理按钮', async () => {
    renderWithProviders(<ProjectOutline />)

    await waitFor(() => {
      expect(screen.getByText(/创作 Skill/i)).toBeInTheDocument()
      expect(screen.getByText(/管理 Skill/i)).toBeInTheDocument()
    })
  })

  test('应该有返回项目概览的链接', async () => {
    renderWithProviders(<ProjectOutline />)

    await waitFor(() => {
      const backButton = screen.getByText(/返回概览/i)
      expect(backButton).toBeInTheDocument()
      expect(backButton.closest('a')).toHaveAttribute('href', '/projects/1/overview')
    })
  })
})
