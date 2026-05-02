import React from 'react'
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastContext } from '../toastContext'

vi.mock('../../utils/endpoints', () => ({
  getProject: vi.fn().mockResolvedValue({
    id: 1,
    user_id: 1,
    name: 'Test Project',
    content_type: 'novel',
    status: 'draft',
    overall_quality_score: 0,
    created_at: '2026-04-25T00:00:00',
    updated_at: '2026-04-25T00:00:00',
    config: {},
  }),
  getChapter: vi.fn().mockResolvedValue({
    id: 1,
    project_id: 1,
    chapter_index: 2,
    title: 'Chapter 2',
    content: 'Test content',
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
      chapter_index: 2,
      title: 'Chapter 2',
      content: 'Test content',
      word_count: 12,
      quality_score: 0,
      status: 'draft',
      created_at: '2026-04-25T00:00:00',
      updated_at: '2026-04-25T00:00:00',
    },
    {
      id: 2,
      project_id: 1,
      chapter_index: 4,
      title: 'Chapter 4',
      content: 'More content',
      word_count: 12,
      quality_score: 0,
      status: 'draft',
      created_at: '2026-04-25T00:00:00',
      updated_at: '2026-04-25T00:00:00',
    },
  ]),
  updateChapter: vi.fn().mockResolvedValue({}),
}))

vi.mock('./ReaderCore', () => ({
  ReaderCore: () => <div data-testid="reader-core" />,
}))

vi.mock('./EditorCore', () => ({
  EditorCore: () => <div data-testid="editor-core" />,
}))

vi.mock('./components/ReaderMenu', () => ({
  ReaderMenu: () => null,
}))

vi.mock('./components/ReaderSettings', () => ({
  ReaderSettings: () => null,
}))

vi.mock('./components/TableOfContents', () => ({
  TableOfContents: () => null,
}))

vi.mock('./components/BookmarkPanel', () => ({
  BookmarkPanel: () => null,
}))

vi.mock('./components/SearchPanel', () => ({
  SearchPanel: () => null,
}))

vi.mock('./hooks/useReaderSettings', () => ({
  useReaderSettings: () => ({ applySettings: vi.fn(), themeClass: 'theme-parchment' }),
}))

vi.mock('./hooks/useContentSync', () => ({
  useContentSync: (content: string) => ({
    content,
    setContent: vi.fn(),
    setIsDirty: vi.fn(),
    restoreReadingPosition: vi.fn(),
  }),
}))

import Reader from './index'

function renderReader(initialPath = '/projects/1/read/2') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ToastContext.Provider value={{ showToast: vi.fn() }}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/projects/:id/read/:chapterIndex" element={<Reader />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastContext.Provider>
  )
}

describe('Reader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('上一章/下一章应该按真实章节索引跳转，而不是按数组长度推断', async () => {
    renderReader()

    await waitFor(() => {
      expect(screen.getByTestId('reader-core')).toBeInTheDocument()
    })

    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /下一章/i })).toHaveAttribute('href', '/projects/1/read/4')
    expect(screen.getByRole('button', { name: /上一章/i })).toBeDisabled()
  })
})
