import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, describe, test, vi, beforeEach } from 'vitest'
import React from 'react'
import { ToastContext } from '../components/toastContext'

// Mock useAuthStore
vi.mock('../store/useAuthStore', () => ({
  useAuthStore: () => ({ user: { id: 1, username: 'test', email: 'test@example.com' }, setUser: vi.fn() }),
}))

// Mock useLayoutStore with setters we can spy on
const mockSetAutoExpandHeaderInProject = vi.fn()
const mockAutoExpandHeaderInProject = { current: true }

vi.mock('../store/useLayoutStore', () => ({
  useLayoutStore: (selector?: (state: any) => any) => {
    const state = {
      autoExpandHeaderInProject: mockAutoExpandHeaderInProject.current,
      setAutoExpandHeaderInProject: mockSetAutoExpandHeaderInProject,
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('../components/ThemeSelector', () => ({
  ThemeSelector: () => <div data-testid="theme-selector" />,
}))

vi.mock('../components/layout/CanvasContainer', () => ({
  CanvasContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../utils/endpoints', () => ({
  clearApiKey: vi.fn().mockResolvedValue({}),
  getUserMonthlyTokenStats: vi.fn().mockResolvedValue({ total_tokens: 0 }),
  updateApiKey: vi.fn().mockResolvedValue({}),
}))

import Settings from './Settings'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ToastContext.Provider value={{ showToast: vi.fn() }}>
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    </ToastContext.Provider>
  )
}

describe('Settings - 布局偏好', () => {
  beforeEach(() => {
    mockSetAutoExpandHeaderInProject.mockClear()
    mockAutoExpandHeaderInProject.current = true
  })

  test('页面显示"布局偏好"部分', () => {
    renderWithProviders(<Settings />)
    expect(screen.getByText('布局偏好')).toBeInTheDocument()
  })

  test('显示"进入项目时自动展开顶栏"的 Switch', () => {
    renderWithProviders(<Settings />)
    expect(screen.getByText('进入项目时自动展开顶栏')).toBeInTheDocument()
  })

  test('点击 Switch 调用 setAutoExpandHeaderInProject', () => {
    renderWithProviders(<Settings />)

    // 找到 switch 并点击
    const switchEl = screen.getByRole('switch')
    fireEvent.click(switchEl)

    expect(mockSetAutoExpandHeaderInProject).toHaveBeenCalledWith(false)
  })

  test('当 autoExpandHeaderInProject 为 false 时，Switch 状态正确', () => {
    mockAutoExpandHeaderInProject.current = false
    renderWithProviders(<Settings />)

    const switchEl = screen.getByRole('switch')
    expect(switchEl).not.toBeChecked()
  })

  test('当 autoExpandHeaderInProject 为 true 时，Switch 状态正确', () => {
    mockAutoExpandHeaderInProject.current = true
    renderWithProviders(<Settings />)

    const switchEl = screen.getByRole('switch')
    expect(switchEl).toBeChecked()
  })
})
