import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShortcutList } from '../components/settings/ShortcutList'

describe('ShortcutList', () => {
  it('should render search input', () => {
    render(<ShortcutList />)
    expect(screen.getByPlaceholderText(/搜索快捷键/i)).toBeTruthy()
  })

  it('should render shortcut groups', () => {
    render(<ShortcutList />)
    expect(screen.getByText('编辑器操作')).toBeTruthy()
    expect(screen.getByText('模式切换')).toBeTruthy()
    expect(screen.getByText('面板操作')).toBeTruthy()
    expect(screen.getByText('导航操作')).toBeTruthy()
  })

  it('should render shortcut items with label and keys', () => {
    render(<ShortcutList />)
    expect(screen.getByText('切换 Typewriter 模式')).toBeTruthy()
    expect(screen.getByText('Cmd + Shift + T')).toBeTruthy()
  })

  it('should filter shortcuts based on search input', () => {
    render(<ShortcutList />)

    const searchInput = screen.getByPlaceholderText(/搜索快捷键/i)
    fireEvent.change(searchInput, { target: { value: 'Typewriter' } })

    expect(screen.getByText('切换 Typewriter 模式')).toBeTruthy()
    // Should not show unrelated shortcuts
    expect(screen.queryByText('切换侧边栏')).toBeNull()
  })

  it('should show empty message when no shortcuts match', () => {
    render(<ShortcutList />)

    const searchInput = screen.getByPlaceholderText(/搜索快捷键/i)
    fireEvent.change(searchInput, { target: { value: 'xyz-nonexistent' } })

    expect(screen.getByText(/没有找到匹配的快捷键/i)).toBeTruthy()
  })
})
