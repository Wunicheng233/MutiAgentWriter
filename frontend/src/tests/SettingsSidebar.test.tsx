import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsSidebar } from '../components/settings/SettingsSidebar'

describe('SettingsSidebar', () => {
  const mockOnTabChange = vi.fn()

  beforeEach(() => {
    mockOnTabChange.mockClear()
  })

  it('should render all 6 category tabs', () => {
    render(<SettingsSidebar activeTab="theme" onTabChange={mockOnTabChange} />)

    expect(screen.getByText('外观主题')).toBeInTheDocument()
    expect(screen.getByText('编辑器模式')).toBeInTheDocument()
    expect(screen.getByText('键盘快捷键')).toBeInTheDocument()
    expect(screen.getByText('AI 偏好')).toBeInTheDocument()
    expect(screen.getByText('布局设置')).toBeInTheDocument()
    expect(screen.getByText('账户数据')).toBeInTheDocument()
  })

  it('should highlight active tab', () => {
    render(<SettingsSidebar activeTab="theme" onTabChange={mockOnTabChange} />)

    const themeTab = screen.getByTestId('settings-tab-theme')
    expect(themeTab).toHaveClass('bg-[var(--bg-tertiary)]')
    expect(themeTab).toHaveClass('text-[var(--text-primary)]')
  })

  it('should call onTabChange when clicking a tab', () => {
    render(<SettingsSidebar activeTab="theme" onTabChange={mockOnTabChange} />)

    fireEvent.click(screen.getByTestId('settings-tab-editor'))
    expect(mockOnTabChange).toHaveBeenCalledWith('editor')

    fireEvent.click(screen.getByTestId('settings-tab-ai'))
    expect(mockOnTabChange).toHaveBeenCalledWith('ai')
  })
})
