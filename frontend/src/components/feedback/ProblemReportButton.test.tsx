import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProblemReportButton from './ProblemReportButton'
import { submitProblemReport } from '../../utils/endpoints'

const showToast = vi.fn()

vi.mock('../../utils/endpoints', () => ({
  submitProblemReport: vi.fn(),
}))

vi.mock('../toastContext', () => ({
  useToast: () => ({ showToast }),
}))

describe('ProblemReportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(submitProblemReport).mockResolvedValue({
      id: 1,
      category: 'generation',
      severity: 'high',
      status: 'open',
      description: '逐章共创确认后没有继续生成。',
      created_at: '2026-05-07T00:00:00',
    })
  })

  it('submits a problem report with route and project context', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/42/overview?confirm=1']}>
        <ProblemReportButton />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: '反馈问题' }))
    fireEvent.change(screen.getByLabelText('问题类型'), { target: { value: 'generation' } })
    fireEvent.change(screen.getByLabelText('影响程度'), { target: { value: 'high' } })
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '生成卡住' } })
    fireEvent.change(screen.getByLabelText('问题描述'), {
      target: { value: '逐章共创确认后没有继续生成。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '提交反馈' }))

    await waitFor(() => {
      expect(submitProblemReport).toHaveBeenCalledWith(expect.objectContaining({
        category: 'generation',
        severity: 'high',
        title: '生成卡住',
        description: '逐章共创确认后没有继续生成。',
        route: '/projects/42/overview?confirm=1',
        project_id: 42,
      }))
    })
    expect(showToast).toHaveBeenCalledWith('问题已提交，我们会带着上下文排查', 'success')
  })

  it('requires a meaningful description before submitting', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProblemReportButton />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: '反馈问题' }))
    fireEvent.change(screen.getByLabelText('问题描述'), { target: { value: '卡' } })
    fireEvent.click(screen.getByRole('button', { name: '提交反馈' }))

    expect(submitProblemReport).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith('请简单描述你遇到的问题', 'error')
  })
})
