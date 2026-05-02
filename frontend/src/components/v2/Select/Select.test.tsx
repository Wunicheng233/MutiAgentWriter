import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select'

describe('Select', () => {
  it('renders correctly with placeholder', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>
    )

    expect(screen.getByText('Select an option')).toBeInTheDocument()
  })

  it('opens dropdown when trigger is clicked', async () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectContent>
      </Select>
    )

    await fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('selects option and calls onValueChange', async () => {
    const onValueChange = vi.fn()
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    )

    await fireEvent.click(screen.getByRole('combobox'))
    await fireEvent.click(screen.getByText('Option 1'))

    expect(onValueChange).toHaveBeenCalledWith('option1')
  })

  it('uses a translucent selected option background with readable text', async () => {
    render(
      <Select value="option1">
        <SelectTrigger>
          <SelectValue>Option 1</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    )

    await fireEvent.click(screen.getByRole('combobox'))
    const selectedOption = screen.getByRole('option', { selected: true })

    expect(selectedOption).toHaveClass('bg-[rgba(var(--accent-primary-rgb),0.10)]')
    expect(selectedOption).toHaveClass('text-[var(--text-primary)]')
    expect(selectedOption.className).not.toContain('bg-opacity-10')
  })

  it('does not trigger disabled items', async () => {
    const onValueChange = vi.fn()
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1" disabled>Option 1 (Disabled)</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    )

    await fireEvent.click(screen.getByRole('combobox'))
    await fireEvent.click(screen.getByText('Option 1 (Disabled)'))

    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('filters options when search is enabled', async () => {
    render(
      <Select searchable>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="cherry">Cherry</SelectItem>
        </SelectContent>
      </Select>
    )

    await fireEvent.click(screen.getByRole('combobox'))
    const searchInput = screen.getByPlaceholderText('Search...')

    await fireEvent.change(searchInput, { target: { value: 'ban' } })

    expect(screen.getByText('Banana')).toBeInTheDocument()
    expect(screen.queryByText('Apple')).not.toBeInTheDocument()
    expect(screen.queryByText('Cherry')).not.toBeInTheDocument()
  })

  it('closes dropdown when clicking outside', async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      </div>
    )

    await fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await fireEvent.mouseDown(screen.getByTestId('outside'))
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })
})
