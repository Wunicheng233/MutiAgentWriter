import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SelectionAIPanel } from '../components/editor/SelectionAIPanel'
import { useSelectionStore } from '../store/useSelectionStore'
import { describe, it, expect, vi } from 'vitest'
import { aiChat } from '../utils/endpoints'

const mockSetPendingRewriteResult = vi.fn()
const mockSetInitialRewriteMode = vi.fn()

vi.mock('../store/useSelectionStore', () => ({
  useSelectionStore: vi.fn(),
  __esModule: true,
  default: {
    getState: () => ({
      setPendingRewriteResult: mockSetPendingRewriteResult,
      setInitialRewriteMode: mockSetInitialRewriteMode,
    }),
  },
}))

vi.mock('../utils/endpoints', () => ({
  aiChat: vi.fn().mockResolvedValue({ content: 'AI 返回的改写结果' }),
}))

describe('SelectionAIPanel', () => {
  const mockOnApply = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useSelectionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (state: unknown) => unknown) => {
      const state = {
        selectedText: '这是原始文本',
        setPendingRewriteResult: mockSetPendingRewriteResult,
        setInitialRewriteMode: mockSetInitialRewriteMode,
      }
      return selector ? selector(state) : state
    })
  })

  it('should render panel with selected text', () => {
    render(
      <SelectionAIPanel
        isOpen={true}
        onApply={mockOnApply}
      />
    )

    expect(screen.getByText(/这是原始文本/)).toBeInTheDocument()
  })

  it('should not render panel when isOpen is false', () => {
    render(
      <SelectionAIPanel
        isOpen={false}
        onApply={mockOnApply}
      />
    )

    expect(screen.queryByText(/这是原始文本/)).not.toBeInTheDocument()
  })

  it('should show loading state when AI is working', async () => {
    render(
      <SelectionAIPanel
        isOpen={true}
        onApply={mockOnApply}
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
      />
    )

    fireEvent.click(screen.getByText('润色'))

    await waitFor(() => {
      expect(screen.getByText('应用')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('should call onApply with result when apply button clicked and onApply provided', async () => {
    render(
      <SelectionAIPanel
        isOpen={true}
        onApply={mockOnApply}
      />
    )

    fireEvent.click(screen.getByText('润色'))

    await waitFor(() => {
      fireEvent.click(screen.getByText('应用'))
      expect(mockOnApply).toHaveBeenCalledWith('AI 返回的改写结果')
    }, { timeout: 5000 })
  })

  it('should use store when onApply is not provided', async () => {
    render(
      <SelectionAIPanel
        isOpen={true}
      />
    )

    fireEvent.click(screen.getByText('润色'))

    await waitFor(() => {
      fireEvent.click(screen.getByText('应用'))
      expect(mockSetPendingRewriteResult).toHaveBeenCalledWith('AI 返回的改写结果')
    }, { timeout: 5000 })
  })

  it('should include selected character name in character voice prompt', async () => {
    render(
      <SelectionAIPanel
        isOpen={true}
        characters={[{ name: '李逍遥', personality: '乐观开朗' }]}
      />
    )

    fireEvent.click(screen.getByText('李逍遥'))

    await waitFor(() => {
      expect(aiChat).toHaveBeenCalledWith(
        expect.objectContaining({
          user_input: expect.stringContaining('请用角色【李逍遥】的语气重写这段文字'),
        })
      )
    })
  })
})
