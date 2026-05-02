import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders correctly with default props', () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText(/new/i)).toBeInTheDocument()
  })

  it('applies variant correctly', () => {
    const { rerender } = render(<Badge variant="primary">Primary</Badge>)
    expect(screen.getByText(/primary/i)).toHaveClass(/badge-primary-bg/)

    rerender(<Badge variant="success">Success</Badge>)
    expect(screen.getByText(/success/i)).toHaveClass(/badge-success-bg/)

    rerender(<Badge variant="error">Error</Badge>)
    expect(screen.getByText(/error/i)).toHaveClass(/badge-error-bg/)
  })

  it('applies custom className correctly', () => {
    render(<Badge className="custom-class">Custom</Badge>)
    expect(screen.getByText(/custom/i)).toHaveClass('custom-class')
  })
})
