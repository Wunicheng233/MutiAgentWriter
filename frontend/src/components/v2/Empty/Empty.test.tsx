import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Empty } from './Empty'

describe('Empty', () => {
  it('renders with default title', () => {
    render(<Empty />)
    expect(screen.getByText('暂无数据')).toBeInTheDocument()
  })

  it('renders with custom title and description', () => {
    render(<Empty title="没有项目" description="点击按钮创建第一个项目" />)

    expect(screen.getByText('没有项目')).toBeInTheDocument()
    expect(screen.getByText('点击按钮创建第一个项目')).toBeInTheDocument()
  })

  it('renders with action button', () => {
    render(
      <Empty
        title="空列表"
        action={<button type="button">创建</button>}
      />
    )

    expect(screen.getByRole('button', { name: '创建' })).toBeInTheDocument()
  })

  it('renders with different icon types', () => {
    const { rerender } = render(<Empty icon="document" />)
    // Document icon should render

    rerender(<Empty icon="folder" />)
    // Folder icon should render

    rerender(<Empty icon="list" />)
    // List icon should render
  })
})
