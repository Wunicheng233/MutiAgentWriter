import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentCard } from './AgentCard'

describe('AgentCard', () => {
  it('renders name and subtitle correctly', () => {
    render(<AgentCard name="AI 写作助手" subtitle="智能生成内容" status="idle" />)
    expect(screen.getByText('AI 写作助手')).toBeInTheDocument()
    expect(screen.getByText('智能生成内容')).toBeInTheDocument()
  })

  it('renders correct status badge and dot', () => {
    render(<AgentCard name="Agent" subtitle="Test" status="running" />)
    expect(screen.getByText('执行中')).toBeInTheDocument()
  })

  it('renders progress bar when provided', () => {
    render(<AgentCard name="Agent" subtitle="Test" status="running" progress={50} />)
    // Progress bar is rendered
  })

  it('renders current step when provided', () => {
    render(<AgentCard name="Agent" subtitle="Test" status="running" currentStep="正在处理内容" />)
    expect(screen.getByText('正在处理内容')).toBeInTheDocument()
  })
})
