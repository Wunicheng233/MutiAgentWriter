import React from 'react'
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReaderCore } from './ReaderCore'
import { useReaderStore } from './stores/readerStore'

const mocks = vi.hoisted(() => ({
  usePagination: vi.fn(),
  useReadingProgress: vi.fn(),
}))

vi.mock('./hooks/usePagination', () => ({
  usePagination: mocks.usePagination,
}))

vi.mock('./hooks/useReadingProgress', () => ({
  useReadingProgress: mocks.useReadingProgress,
}))

describe('ReaderCore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useReaderStore.setState({
      settings: {
        theme: 'parchment',
        font: 'song',
        fontSize: 3,
        lineHeight: 2,
        margin: 2,
        displayMode: 'pagination',
      },
      currentPage: 1,
    })
    mocks.usePagination.mockReturnValue({
      pages: [
        {
          content: '第一行\n第二行',
          startOffset: 0,
          endOffset: 6,
        },
      ],
      totalPages: 1,
      loading: false,
    })
  })

  test('把字体设置应用到阅读正文容器', () => {
    render(<ReaderCore content="第一行\n第二行" projectId={1} chapterIndex={1} />)

    expect(screen.getByTestId('reader-core-root')).toHaveStyle({
      fontFamily: 'SimSun, "Songti SC", serif',
    })
  })

  test('分页模式按无外边距且不自动换行的行块渲染，避免默认段落 margin 撑爆可视区域', () => {
    render(<ReaderCore content="第一行\n第二行" projectId={1} chapterIndex={1} />)

    const lines = screen.getAllByTestId('reader-page-line')
    expect(lines).toHaveLength(2)
    expect(lines[0].tagName).toBe('DIV')
    expect(lines[0]).toHaveClass('m-0')
    expect(lines[0]).toHaveClass('whitespace-pre')
  })

  test('把编辑器保存的多个 HTML 段落传给分页器时保留换行', () => {
    render(<ReaderCore content="<p>第一段。</p><p>第二段。</p>" projectId={1} chapterIndex={1} />)

    expect(mocks.usePagination.mock.calls[0][0]).toBe('第一段。\n第二段。')
  })
})
