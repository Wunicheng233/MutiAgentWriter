import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectVersions } from './ProjectVersions'

// Mock endpoints
vi.mock('../utils/endpoints', () => ({
  listChapters: async () => [
    { chapter_index: 1, title: '第一章' },
    { chapter_index: 2, title: '第二章' },
  ],
  listChapterVersions: async () => ({
    versions: [
      { id: 2, version_number: 2, word_count: 2000, created_at: '2026-05-05T12:00:00Z' },
      { id: 1, version_number: 1, word_count: 1500, created_at: '2026-05-04T12:00:00Z' },
    ],
  }),
  getChapterVersion: async () => ({
    id: 1,
    version_number: 1,
    word_count: 1500,
    created_at: '2026-05-04T12:00:00Z',
    content: '测试内容',
  }),
  restoreChapterVersion: async () => ({
    chapter_index: 1,
    title: '第一章',
    content: '恢复的内容',
    word_count: 1500,
  }),
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  </BrowserRouter>
)

describe('ProjectVersions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page title correctly', () => {
    render(<ProjectVersions />, { wrapper })
    expect(screen.getByText('历史版本')).toBeInTheDocument()
  })

  it('renders page description', () => {
    render(<ProjectVersions />, { wrapper })
    expect(screen.getByText('查看和管理章节的历史版本')).toBeInTheDocument()
  })

  it('renders chapter selector', async () => {
    render(<ProjectVersions />, { wrapper })
    const selector = await screen.findByTestId('chapter-selector')
    expect(selector).toBeInTheDocument()
  })

  it('renders back to editor button', () => {
    render(<ProjectVersions />, { wrapper })
    expect(screen.getByText('返回编辑器')).toBeInTheDocument()
  })
})
