import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, describe, test, vi } from 'vitest'
import React from 'react'
import SkillSelector from './SkillSelector'

const mocks = vi.hoisted(() => ({
  updateProjectSkills: vi.fn().mockResolvedValue({}),
}))

vi.mock('../utils/endpoints', () => ({
  listSkills: vi.fn().mockResolvedValue({
    skills: [
      {
        id: 'liu-cixin-perspective',
        name: 'liu-cixin-perspective',
        description: '刘慈欣科幻创作系统',
        version: '1.0',
        author: 'external-skill',
        applies_to: ['planner', 'writer', 'revise'],
        priority: 100,
        tags: ['perspective', 'author-style'],
        config_schema: {
          strength: { type: 'float', default: 0.7, min: 0, max: 1 },
        },
        safety_tags: ['safe_for_all'],
        dependencies: [],
      },
      {
        id: 'consistency-checker',
        name: '连续性助手',
        description: '维护时间线和设定一致性',
        version: '1.0',
        author: 'StoryForge',
        applies_to: ['planner', 'writer', 'revise'],
        priority: 40,
        tags: ['quality'],
        config_schema: {},
        safety_tags: ['safe_for_all'],
        dependencies: [],
      },
    ],
  }),
  updateProjectSkills: mocks.updateProjectSkills,
}))

vi.mock('./toastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('SkillSelector', () => {
  test('lists installed skills and saves selected skill config', async () => {
    renderWithProviders(<SkillSelector projectId={1} enabledSkills={[]} />)

    expect(await screen.findByText('刘慈欣｜Liu Cixin')).toBeInTheDocument()
    expect(screen.getByText('连续性助手｜连续性助手')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('启用 刘慈欣 风格'))

    await waitFor(() => {
      expect(mocks.updateProjectSkills).toHaveBeenCalledWith(1, {
        enabled: [
          {
            skill_id: 'liu-cixin-perspective',
            applies_to_override: ['planner', 'writer', 'revise'],
            config: { strength: 0.7, mode: 'style_only' },
          },
        ],
      })
    })
  })
})
