import React from 'react'
import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ChapterTable } from './ChapterTable'
import type { Chapter } from '../types/api'

const baseChapter: Chapter = {
  id: 1,
  project_id: 1,
  chapter_index: 2,
  title: '测试章节',
  content: '正文',
  word_count: 1234,
  quality_score: 8,
  status: 'generated',
  created_at: '2026-04-25T00:00:00',
  updated_at: '2026-04-25T00:00:00',
}

describe('ChapterTable', () => {
  test('generated/edited chapters should expose the registered editor route', () => {
    render(
      <MemoryRouter>
        <ChapterTable
          projectId={9}
          chapters={[
            baseChapter,
            { ...baseChapter, id: 2, chapter_index: 3, status: 'edited' },
          ]}
          status="completed"
          overallQualityScore={8}
        />
      </MemoryRouter>
    )

    const editLinks = screen.getAllByRole('link', { name: /编辑/i })
    expect(editLinks[0]).toHaveAttribute('href', '/projects/9/editor/2')
    expect(editLinks[1]).toHaveAttribute('href', '/projects/9/editor/3')
  })
})
