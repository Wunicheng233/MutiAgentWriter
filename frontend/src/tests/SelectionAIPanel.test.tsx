import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SelectionAIPanel } from '../components/editor/SelectionAIPanel'
import { useSelectionStore } from '../store/useSelectionStore'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../store/useSelectionStore')
vi.mock('../utils/endpoints', () => ({
  aiChat: vi.fn().mockResolvedValue({ content: 'AI 返回的改写结果' }),
}))

describe('SelectionAIPanel', () => {
  const mockOnApply = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useSelectionStore as any).mockReturnValue({
      selectedText: '这是原始文本',
    })
  })

  it('should render panel with selected text', () => {
    render(
      <SelectionAIPanel
        isOpen={true}
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText(/选区智能操作/)).toBeInTheDocument()
    expect(screen.getByText(/这是原始文本/)).toBeInTheDocument()
  })

  it('should not render panel when isOpen is false', () => {
    render(
      <SelectionAIPanel
        isOpen={false}
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    )

    expect(screen.queryByText('选区智能操作')).not.toBeInTheDocument()
  })

  it('should show loading state when AI is working', async () => {
    render(
      <SelectionAIPanel
        isOpen={true}
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    )

    fireEvent.click(screen.getByText('润色'))

    await waitFor(() => {
      expect(screen.getByText(/AI 正在改写/)).toBeInTheDocument()
    })
  })

  it('should show diff preview after AI returns result', async () => {
    render(
      <SelectionAIPanel
        isOpen={true}
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    )

    fireEvent.click(screen.getByText('润色'))

    await waitFor(() => {
      expect(screen.getByText('应用')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('should call onApply with result when apply button clicked', async () => {
    render(
      <SelectionAIPanel
        isOpen={true}
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    )

    fireEvent.click(screen.getByText('润色'))

    await waitFor(() => {
      fireEvent.click(screen.getByText('应用'))
      expect(mockOnApply).toHaveBeenCalledWith('AI 返回的改写结果')
    }, { timeout: 5000 })
  })
})
