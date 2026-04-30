import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import React from 'react'
import SkillManagement from './SkillManagement'

const mocks = vi.hoisted(() => ({
  updateProjectSkills: vi.fn().mockResolvedValue({}),
}))

vi.mock('../utils/endpoints', () => ({
  getProject: vi.fn().mockResolvedValue({
    id: 1,
    name: '风格测试项目',
    status: 'draft',
    config: {
      skills: {
        enabled: [
          {
            skill_id: 'liu-cixin-perspective',
            applies_to_override: ['planner', 'writer', 'revise'],
            config: { strength: 0.7, mode: 'style_only' },
          },
        ],
      },
    },
  }),
  listSkills: vi.fn().mockResolvedValue({
    skills: [
      {
        id: 'liu-cixin-perspective',
        name: 'liu-cixin-perspective',
        description: '刘慈欣科幻创作系统',
        version: '1.0',
        author: 'external-skill',
        applies_to: ['planner', 'writer', 'revise'],
        priority: 50,
        tags: ['perspective', 'author-style'],
        config_schema: {
          strength: { type: 'float', default: 0.7, min: 0, max: 1 },
        },
        safety_tags: ['safe_for_all'],
        dependencies: [],
      },
      {
        id: 'yu-hua-perspective',
        name: '余华思维操作系统 | Yu Hua Perspective',
        description: '余华式零度叙事与幽默感',
        version: '1.0',
        author: 'external-skill',
        applies_to: ['planner', 'writer', 'revise'],
        priority: 50,
        tags: ['perspective', 'author-style'],
        config_schema: {
          strength: { type: 'float', default: 0.7, min: 0, max: 1 },
        },
        safety_tags: ['safe_for_all'],
        dependencies: [],
      },
    ],
  }),
  updateProjectSkills: mocks.updateProjectSkills,
}))

vi.mock('../components/toastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/1/skills']}>
        <Routes>
          <Route path="/projects/:id/skills" element={<SkillManagement />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SkillManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('selecting a different author style replaces the current one', async () => {
    renderWithProviders()

    fireEvent.click(await screen.findByLabelText('启用 余华 风格'))

    await waitFor(() => {
      expect(mocks.updateProjectSkills).toHaveBeenCalledWith(1, {
        enabled: [
          {
            skill_id: 'yu-hua-perspective',
            applies_to_override: ['planner', 'writer', 'revise'],
            config: { strength: 0.7, mode: 'style_only' },
          },
        ],
      })
    })
  })
})
