import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renders correctly with default props', () => {
    render(<Skeleton />)
    expect(screen.getByTestId('skeleton')).toBeInTheDocument()
  })

  it('applies text variant with correct line count', () => {
    render(<Skeleton variant="text" count={3} />)
    const lines = screen.getAllByTestId('skeleton')
    expect(lines).toHaveLength(3)
  })

  it('applies circle variant', () => {
    render(<Skeleton variant="circle" width={40} height={40} />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton).toHaveClass('rounded-full')
  })

  it('applies rect variant', () => {
    render(<Skeleton variant="rect" width={100} height={50} />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton).toHaveClass('rounded-[var(--radius-md)]')
  })

  it('applies custom width and height', () => {
    render(<Skeleton variant="rect" width={200} height={100} />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton).toHaveStyle({ width: '200px', height: '100px' })
  })

  it('applies custom className', () => {
    render(<Skeleton className="custom-class" />)
    expect(screen.getByTestId('skeleton')).toHaveClass('custom-class')
  })

  it('does not animate when animation is false', () => {
    render(<Skeleton animation={false} />)
    expect(screen.getByTestId('skeleton')).not.toHaveClass('animate-pulse')
  })

  it('animates when animation is true (default)', () => {
    render(<Skeleton animation={true} />)
    expect(screen.getByTestId('skeleton')).toHaveClass('animate-pulse')
  })

  it('applies lastLineWidth for text variant', () => {
    render(<Skeleton variant="text" count={3} lastLineWidth="50%" />)
    const lines = screen.getAllByTestId('skeleton')
    expect(lines[2]).toHaveStyle({ width: '50%' })
  })

  it('renders multiple text lines with correct spacing', () => {
    render(<Skeleton variant="text" count={5} gap={8} />)
    const lines = screen.getAllByTestId('skeleton')
    const container = lines[0].parentElement
    expect(container).toHaveClass('gap-2')
  })
})
