import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OnboardingTour from './OnboardingTour'
import {
  ONBOARDING_STORAGE_KEY,
  markOnboardingTourComplete,
  shouldShowOnboardingTour,
} from './onboardingTourState'

function renderTour(onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <OnboardingTour open onClose={onClose} />
    </MemoryRouter>
  )
  return onClose
}

describe('OnboardingTour', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('renders the guided tour and advances through steps', () => {
    renderTour()

    expect(screen.getByTestId('onboarding-tour')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '快速上手 StoryForge' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '先确认模型能跑' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '下一步' }))

    expect(screen.getByRole('heading', { name: '用小说信息创建项目' })).toBeInTheDocument()
  })

  it('marks the tour complete when dismissed with Escape', () => {
    const onClose = renderTour()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe('true')
  })

  it('spotlights a real product element when the step target exists', async () => {
    render(
      <MemoryRouter>
        <div data-tour="settings-api">真实 API 设置区域</div>
        <OnboardingTour open onClose={vi.fn()} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('tour-spotlight')).toBeInTheDocument()
    })
    expect(screen.getByText('正在高亮真实界面：设置页的模型供应商表单')).toBeInTheDocument()
  })

  it('does not request auto play after completion', () => {
    expect(shouldShowOnboardingTour()).toBe(true)

    markOnboardingTourComplete()

    expect(shouldShowOnboardingTour()).toBe(false)
  })

  it('treats unavailable storage as already handled', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    expect(shouldShowOnboardingTour()).toBe(false)
  })
})
