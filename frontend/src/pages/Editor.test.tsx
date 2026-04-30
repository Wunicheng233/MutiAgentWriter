import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { expect, describe, test, vi, beforeEach } from 'vitest'
import React from 'react'
import { ToastContext } from '../components/toastContext'

// Mock tiptap
vi.mock('@tiptap/react', () => ({
  useEditor: () => ({
    getHTML: () => '<p></p>',
    commands: { setContent: vi.fn() },
  }),
  EditorContent: () => <div data-testid="editor-content" />,
}))

vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: vi.fn().mockReturnValue({}),
  },
}))
vi.mock('@tiptap/extension-placeholder', () => ({
  default: {
    configure: vi.fn().mockReturnValue({}),
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

// Mock useLayoutStore
vi.mock('../store/useLayoutStore', () => ({
  useLayoutStore: <T,>(selector?: (state: Record<string, unknown>) => T) => {
    const state = {
      focusMode: false,
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
  getChapter: vi.fn().mockResolvedValue({
    id: 1,
    project_id: 1,
    chapter_index: 1,
    title: 'Chapter 1',
    content: '<p>Test content</p>',
    word_count: 12,
    quality_score: 0,
    status: 'draft',
    created_at: '2026-04-25T00:00:00',
    updated_at: '2026-04-25T00:00:00',
  }),
  listChapters: vi.fn().mockResolvedValue([
    {
      id: 1,
      project_id: 1,
      chapter_index: 1,
      title: 'Chapter 1',
      content: '<p>Test content</p>',
      word_count: 12,
      quality_score: 0,
      status: 'draft',
      created_at: '2026-04-25T00:00:00',
      updated_at: '2026-04-25T00:00:00',
    },
    {
      id: 2,
      project_id: 1,
      chapter_index: 2,
      title: 'Chapter 2',
      content: '<p>More content</p>',
      word_count: 12,
      quality_score: 0,
      status: 'draft',
      created_at: '2026-04-25T00:00:00',
      updated_at: '2026-04-25T00:00:00',
    },
  ]),
  updateChapter: vi.fn().mockResolvedValue({}),
  getTaskStatus: vi.fn().mockResolvedValue({}),
  confirmTask: vi.fn().mockResolvedValue({}),
  regenerateChapter: vi.fn().mockResolvedValue({}),
  listChapterVersions: vi.fn().mockResolvedValue({ versions: [] }),
  restoreChapterVersion: vi.fn().mockResolvedValue({}),
}))

vi.mock('../components/AgentCard', () => ({ default: () => <div data-testid="agent-card" /> }))

import Editor from './Editor'
import { getChapter, getProject, listChapters } from '../utils/endpoints'

const mockGetProject = vi.mocked(getProject)
const mockGetChapter = vi.mocked(getChapter)
const mockListChapters = vi.mocked(listChapters)

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderWithProviders(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <ToastContext.Provider value={{ showToast: vi.fn() }}>
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={['/projects/1/write/1']}>
          <LocationProbe />
          <Routes>
            <Route path="/projects/:id/write/:chapterIndex" element={ui} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastContext.Provider>
  )
}

describe('Editor - ProjectStore 初始化', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({
      id: 1,
      name: 'Test Project',
      status: 'draft',
      config: {},
    })
    mockGetChapter.mockResolvedValue({
      id: 1,
      project_id: 1,
      chapter_index: 1,
      title: 'Chapter 1',
      content: '<p>Test content</p>',
      word_count: 12,
      quality_score: 0,
      status: 'draft',
      created_at: '2026-04-25T00:00:00',
      updated_at: '2026-04-25T00:00:00',
    })
    mockListChapters.mockResolvedValue([
      {
        id: 1,
        project_id: 1,
        chapter_index: 1,
        title: 'Chapter 1',
        content: '<p>Test content</p>',
        word_count: 12,
        quality_score: 0,
        status: 'draft',
        created_at: '2026-04-25T00:00:00',
        updated_at: '2026-04-25T00:00:00',
      },
      {
        id: 2,
        project_id: 1,
        chapter_index: 2,
        title: 'Chapter 2',
        content: '<p>More content</p>',
        word_count: 12,
        quality_score: 0,
        status: 'draft',
        created_at: '2026-04-25T00:00:00',
        updated_at: '2026-04-25T00:00:00',
      },
    ])
  })

  test('当项目数据加载完成后，应该调用 setCurrentProject 传入正确的 id 和 name', async () => {
    renderWithProviders(<Editor />)

    await waitFor(() => {
      expect(mockSetCurrentProject).toHaveBeenCalledWith('1', 'Test Project')
    })
  })

  test('当项目数据加载完成后，应该调用 setProjectStatus 传入正确的状态', async () => {
    renderWithProviders(<Editor />)

    await waitFor(() => {
      expect(mockSetProjectStatus).toHaveBeenCalledWith('draft', 0)
    })
  })

  test('对于 waiting_confirm 状态的项目，应该正确设置状态', async () => {
    const getProject = (await import('../utils/endpoints')).getProject as vi.Mock
    getProject.mockResolvedValueOnce({
      id: 1,
      name: 'Waiting Confirm Project',
      status: 'waiting_confirm',
      config: {},
      current_generation_task: {
        status: 'waiting_confirm',
        progress: 0.75,
      },
    })

    const queryClient2 = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ToastContext.Provider value={{ showToast: vi.fn() }}>
        <QueryClientProvider client={queryClient2}>
          <MemoryRouter initialEntries={['/projects/1/write/1']}>
            <Routes>
              <Route path="/projects/:id/write/:chapterIndex" element={<Editor />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastContext.Provider>
    )

    await waitFor(() => {
      expect(mockSetProjectStatus).toHaveBeenCalledWith('waiting_confirm', 75)
    })
  })

  test('id 变化时应该重新初始化项目状态', async () => {
    const getProject = (await import('../utils/endpoints')).getProject as vi.Mock
    getProject.mockClear()
    getProject.mockResolvedValue({
      id: 10,
      name: 'Project 10',
      status: 'failed',
      config: {},
    })

    const queryClient2 = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ToastContext.Provider value={{ showToast: vi.fn() }}>
        <QueryClientProvider client={queryClient2}>
          <MemoryRouter initialEntries={['/projects/10/write/1']}>
            <Routes>
              <Route path="/projects/:id/write/:chapterIndex" element={<Editor />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastContext.Provider>
    )

    await waitFor(() => {
      expect(mockSetCurrentProject).toHaveBeenCalledWith('10', 'Project 10')
      expect(mockSetProjectStatus).toHaveBeenCalledWith('failed', 0)
    })
  })

  test('编辑器应该提供章节切换入口，并能跳转到所选章节', async () => {
    renderWithProviders(<Editor />)

    const chapterSelect = await screen.findByLabelText('切换章节')
    expect(chapterSelect).toHaveValue('1')
    expect(screen.getByRole('option', { name: '第 2 章 · Chapter 2' })).toBeInTheDocument()

    fireEvent.change(chapterSelect, { target: { value: '2' } })

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/projects/1/editor/2')
    })
  })

  test('第 0 章不是正文编辑目标，应重定向到第 1 章且不请求 chapter 0', async () => {
    const queryClient2 = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ToastContext.Provider value={{ showToast: vi.fn() }}>
        <QueryClientProvider client={queryClient2}>
          <MemoryRouter initialEntries={['/projects/1/editor/0']}>
            <LocationProbe />
            <Routes>
              <Route path="/projects/:id/editor/:chapterIndex" element={<Editor />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastContext.Provider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/projects/1/editor/1')
    })

    expect(mockGetChapter).not.toHaveBeenCalledWith(1, 0)
  })
})
