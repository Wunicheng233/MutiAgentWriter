import React from 'react'
import { render, screen } from '@testing-library/react'
import { expect, describe, it } from 'vitest'
import { StatsCard } from './StatsCard'

describe('StatsCard', () => {
  it('should render label and value', () => {
    render(<StatsCard label="测试标签" value="测试值" />)

    expect(screen.getByText('测试标签')).toBeInTheDocument()
    expect(screen.getByText('测试值')).toBeInTheDocument()
  })

  it('should format number value with locale', () => {
    render(<StatsCard label="数量" value={1000} />)

    expect(screen.getByText('1,000')).toBeInTheDocument()
  })

  it('should apply variant classes', () => {
    const { container } = render(<StatsCard label="测试" value="值" variant="primary" />)

    expect(container.firstChild).toHaveClass('bg-[var(--accent-primary)]/10')
  })

  it('should apply custom className', () => {
    const { container } = render(<StatsCard label="测试" value="值" className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})
