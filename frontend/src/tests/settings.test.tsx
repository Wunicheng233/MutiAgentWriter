import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Settings } from '../pages/Settings'
import { useLayoutStore } from '../store/useLayoutStore'
import { RewriteMode } from '../utils/selectionAI'
import type { SettingsTab } from '../components/settings/types'

interface InputMockProps {
  label: string
  value: string
  onChange: React.ChangeEventHandler<HTMLInputElement>
}

interface SelectMockProps {
  children: React.ReactNode
}

interface SelectValueMockProps {
  placeholder?: string
  children?: React.ReactNode
}

interface SelectItemMockProps {
  value: string
  children: React.ReactNode
}

interface SettingsSidebarMockProps {
  onTabChange: (tab: SettingsTab) => void
}

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

// Mock tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null }),
  useMutation: () => ({ mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

// Mock components
vi.mock('../components/v2', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({ children, onClick, variant }: { children: React.ReactNode; onClick?: () => void; variant?: string }) => (
    <button onClick={onClick} data-variant={variant}>{children}</button>
  ),
  Input: ({ label, value, onChange }: InputMockProps) => (
    <div>
      <label>{label}</label>
      <input value={value} onChange={onChange} />
    </div>
  ),
  Divider: () => <hr />,
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Switch: ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button onClick={onChange} data-checked={checked} />
  ),
  Select: ({ children }: SelectMockProps) => (
    <div data-testid="select">{children}</div>
  ),
  SelectTrigger: ({ children }: SelectMockProps) => <div>{children}</div>,
  SelectValue: ({ placeholder, children }: SelectValueMockProps) => <span>{children || placeholder}</span>,
  SelectContent: ({ children }: SelectMockProps) => <div>{children}</div>,
  SelectItem: ({ value, children }: SelectItemMockProps) => <div data-value={value}>{children}</div>,
}))

vi.mock('../components/ThemeSelector', () => ({
  ThemeSelector: () => <div>Warm Parchment</div>,
}))

vi.mock('../components/settings/SettingsSidebar', () => ({
  default: ({ onTabChange }: SettingsSidebarMockProps) => (
    <div data-testid="settings-sidebar">
      <button data-testid="settings-tab-theme" onClick={() => onTabChange('theme')}>theme</button>
      <button data-testid="settings-tab-editor" onClick={() => onTabChange('editor')}>editor</button>
      <button data-testid="settings-tab-shortcuts" onClick={() => onTabChange('shortcuts')}>shortcuts</button>
      <button data-testid="settings-tab-ai" onClick={() => onTabChange('ai')}>ai</button>
      <button data-testid="settings-tab-layout" onClick={() => onTabChange('layout')}>layout</button>
      <button data-testid="settings-tab-account" onClick={() => onTabChange('account')}>account</button>
    </div>
  ),
  SettingsTab: {},
}))

vi.mock('../components/settings/ShortcutList', () => ({
  default: () => <div data-testid="shortcut-search">ShortcutList</div>,
}))

vi.mock('../store/useAuthStore', () => ({
  useAuthStore: () => ({
    user: {
      username: 'testuser',
      email: 'test@example.com',
      api_key: 'test-key',
      llm_provider: 'deepseek',
      llm_base_url: 'https://api.deepseek.com',
      llm_model: 'deepseek-chat',
    },
    setUser: vi.fn(),
  }),
}))

vi.mock('../components/toastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

describe('Settings Page', () => {
  beforeEach(() => {
    // Reset store state
    useLayoutStore.setState({
      typewriterMode: false,
      fadeMode: false,
      focusMode: false,
      defaultAIPanelOpen: false,
      autoExpandHeaderInProject: true,
      defaultRewriteMode: RewriteMode.POLISH,
    })
  })

  it('should render sidebar with all categories', () => {
    render(<Settings />)
    expect(screen.getByTestId('settings-sidebar')).toBeTruthy()
    expect(screen.getByTestId('settings-tab-theme')).toBeTruthy()
    expect(screen.getByTestId('settings-tab-editor')).toBeTruthy()
    expect(screen.getByTestId('settings-tab-shortcuts')).toBeTruthy()
    expect(screen.getByTestId('settings-tab-ai')).toBeTruthy()
    expect(screen.getByTestId('settings-tab-layout')).toBeTruthy()
    expect(screen.getByTestId('settings-tab-account')).toBeTruthy()
  })

  it('should show theme tab content by default', () => {
    render(<Settings />)
    expect(screen.getByText('Warm Parchment')).toBeTruthy()
  })

  it('should switch tabs when clicking sidebar', () => {
    render(<Settings />)

    fireEvent.click(screen.getByTestId('settings-tab-editor'))
    expect(screen.getByText('Typewriter 模式')).toBeTruthy()

    fireEvent.click(screen.getByTestId('settings-tab-shortcuts'))
    expect(screen.getByTestId('shortcut-search')).toBeTruthy()
  })

  it('editor tab should have mode switches', () => {
    render(<Settings />)
    fireEvent.click(screen.getByTestId('settings-tab-editor'))

    expect(screen.getByText('Typewriter 模式')).toBeTruthy()
    expect(screen.getByText('Fade 模式')).toBeTruthy()
  })

  it('layout tab should have layout switches', () => {
    render(<Settings />)
    fireEvent.click(screen.getByTestId('settings-tab-layout'))

    expect(screen.getByText('Focus 模式')).toBeTruthy()
    expect(screen.getByText('右侧面板默认打开')).toBeTruthy()
    expect(screen.getByText('顶栏自动展开')).toBeTruthy()
  })

  it('ai tab should have default rewrite mode selector', () => {
    render(<Settings />)
    fireEvent.click(screen.getByTestId('settings-tab-ai'))

    expect(screen.getByText('选区 AI 默认重写模式')).toBeTruthy()
  })

  it('ai tab should expose model provider settings to users', () => {
    render(<Settings />)
    fireEvent.click(screen.getByTestId('settings-tab-ai'))

    expect(screen.getAllByText('模型供应商').length).toBeGreaterThan(0)
    expect(screen.getAllByText('DeepSeek').length).toBeGreaterThan(0)
    expect(screen.getByText('API Base URL')).toBeTruthy()
    expect(screen.getByDisplayValue('https://api.deepseek.com')).toBeTruthy()
    expect(screen.getByDisplayValue('deepseek-chat')).toBeTruthy()
  })
})
