import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Slider } from './Slider'

describe('Slider', () => {
  it('renders correctly with default value', () => {
    render(<Slider value={50} />)
    const slider = screen.getByRole('slider')
    expect(slider).toBeInTheDocument()
    expect(slider).toHaveValue('50')
  })

  it('calls onChange when value changes', async () => {
    const onChange = vi.fn()
    render(<Slider value={30} onChange={onChange} />)

    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '70' } })

    expect(onChange).toHaveBeenCalledWith(70)
  })

  it('renders disabled state correctly', () => {
    render(<Slider value={50} disabled />)
    const slider = screen.getByRole('slider')
    expect(slider).toBeDisabled()
  })

  it('renders label and value when enabled', () => {
    render(<Slider value={75} label="强度" showValue />)
    expect(screen.getByText('强度')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
  })
})
