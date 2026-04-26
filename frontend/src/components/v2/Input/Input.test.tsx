import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'
import { Textarea } from './Textarea'

describe('Input', () => {
  it('renders correctly with default props', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText(/enter text/i)).toBeInTheDocument()
  })

  it('renders label correctly', () => {
    render(<Input label="Email" placeholder="email@example.com" />)
    expect(screen.getByText(/email/i)).toBeInTheDocument()
  })

  it('shows error message when status is error', () => {
    render(<Input status="error" errorMessage="Invalid input" placeholder="Test" />)
    expect(screen.getByText(/invalid input/i)).toBeInTheDocument()
  })

  it('renders prefix correctly', () => {
    render(<Input prefix="https://" placeholder="example.com" />)
    expect(screen.getByText(/https:\/\//i)).toBeInTheDocument()
  })

  it('renders suffix correctly', () => {
    render(<Input suffix="@gmail.com" placeholder="username" />)
    expect(screen.getByText(/@gmail.com/i)).toBeInTheDocument()
  })

  it('calls onChange when value changes', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Input onChange={onChange} placeholder="Type here" />)

    await user.type(screen.getByPlaceholderText(/type here/i), 'hello')
    expect(onChange).toHaveBeenCalledTimes(5)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled placeholder="Disabled" />)
    expect(screen.getByPlaceholderText(/disabled/i)).toBeDisabled()
  })

  it('applies fullWidth class correctly', () => {
    const { container } = render(<Input fullWidth placeholder="Full Width" />)
    expect(container.firstChild).toHaveClass('w-full')
  })
})

describe('Textarea', () => {
  it('renders correctly with default props', () => {
    render(<Textarea placeholder="Enter description" />)
    expect(screen.getByPlaceholderText(/enter description/i)).toBeInTheDocument()
  })

  it('renders label correctly', () => {
    render(<Textarea label="Description" placeholder="..." />)
    expect(screen.getByText(/description/i)).toBeInTheDocument()
  })

  it('shows error message correctly', () => {
    render(<Textarea errorMessage="Required field" placeholder="Test" />)
    expect(screen.getByText(/required field/i)).toBeInTheDocument()
  })

  it('has correct default rows', () => {
    render(<Textarea placeholder="Test" />)
    expect(screen.getByPlaceholderText(/test/i)).toHaveAttribute('rows', '4')
  })
})
