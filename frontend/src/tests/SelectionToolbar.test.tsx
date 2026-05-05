import { render, screen, fireEvent } from '@testing-library/react'
import { SelectionToolbar } from '../components/editor/SelectionToolbar'
import { useSelectionStore } from '../store/useSelectionStore'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../store/useSelectionStore')

describe('SelectionToolbar', () => {
  const mockOnAction = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useSelectionStore as any).mockReturnValue({
      isToolbarVisible: true,
      toolbarPosition: { top: 100, left: 200 },
      selectedText: '测试文本',
      hideToolbar: vi.fn(),
    })
  })

  it('should render toolbar when visible', () => {
    render(<SelectionToolbar onAction={mockOnAction} />)

    expect(screen.getByText('润色')).toBeInTheDocument()
    expect(screen.getByText('扩写')).toBeInTheDocument()
    expect(screen.getByText('缩写')).toBeInTheDocument()
  })

  it('should not render toolbar when not visible', () => {
    ;(useSelectionStore as any).mockReturnValue({
      isToolbarVisible: false,
      toolbarPosition: null,
      selectedText: '',
      hideToolbar: vi.fn(),
    })

    render(<SelectionToolbar onAction={mockOnAction} />)

    expect(screen.queryByText('润色')).not.toBeInTheDocument()
  })

  it('should call onAction with polish mode when 润色 button clicked', () => {
    render(<SelectionToolbar onAction={mockOnAction} />)

    fireEvent.click(screen.getByText('润色'))

    expect(mockOnAction).toHaveBeenCalledWith('polish')
  })

  it('should have 更多 button', () => {
    render(<SelectionToolbar onAction={mockOnAction} />)

    expect(screen.getByText(/更多/)).toBeInTheDocument()
  })
})
