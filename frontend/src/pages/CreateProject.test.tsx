import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import React from 'react'
import CreateProject from './CreateProject'

const mocks = vi.hoisted(() => ({
  createProject: vi.fn().mockResolvedValue({ id: 7 }),
}))

vi.mock('../utils/endpoints', () => ({
  createProject: mocks.createProject,
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
      <MemoryRouter initialEntries={['/projects/new']}>
        <CreateProject />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CreateProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('does not allow jumping to confirmation before required earlier steps are valid', () => {
    renderWithProviders()

    fireEvent.click(screen.getByRole('button', { name: /5\. 确认创建/ }))

    expect(screen.getByPlaceholderText('给你的作品起一个名字')).toBeInTheDocument()
    expect(screen.getByText('请输入项目名称')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '创建项目' })).not.toBeInTheDocument()
    expect(mocks.createProject).not.toHaveBeenCalled()
  })

  test('allows selecting an initial author style before project creation', async () => {
    renderWithProviders()

    fireEvent.change(screen.getByPlaceholderText('给你的作品起一个名字'), { target: { value: '时间余韵不足' } })
    fireEvent.click(screen.getByText('下一步'))

    fireEvent.change(screen.getByPlaceholderText('详细描述你想要的故事'), { target: { value: '写一个关于时间债务的故事' } })
    fireEvent.click(screen.getByText('下一步'))

    fireEvent.click(await screen.findByLabelText('启用 余华 风格'))
    fireEvent.click(screen.getByText('下一步'))

    fireEvent.click(screen.getByText('下一步'))
    fireEvent.click(screen.getByText('创建项目'))

    await waitFor(() => {
      expect(mocks.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '时间余韵不足',
          core_requirement: '写一个关于时间债务的故事',
          config: {
            skills: {
              enabled: [
                {
                  skill_id: 'yu-hua-perspective',
                  applies_to_override: ['planner', 'writer', 'revise'],
                  config: { strength: 0.7, mode: 'style_only' },
                },
              ],
            },
          },
        })
      )
    })
  })
})
