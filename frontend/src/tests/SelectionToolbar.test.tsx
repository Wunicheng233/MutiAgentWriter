import { render, screen, fireEvent } from '@testing-library/react'
import { SelectionToolbar } from '../components/editor/SelectionToolbar'
import { useSelectionStore } from '../store/useSelectionStore'
import { useLayoutStore } from '../store/useLayoutStore'
import { describe, it, expect, vi } from 'vitest'

const mockSetInitialRewriteMode = vi.fn()
const mockHideToolbar = vi.fn()
const mockSetRightPanelTab = vi.fn()
const mockSetRightPanelOpen = vi.fn()

vi.mock('../store/useSelectionStore', () => ({
  useSelectionStore: vi.fn(),
}))

vi.mock('../store/useLayoutStore', () => ({
  useLayoutStore: vi.fn(),
}))

describe('SelectionToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useSelectionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (state: unknown) => unknown) => {
      const state = {
        isToolbarVisible: true,
        toolbarPosition: { top: 100, left: 200 },
        selectedText: '测试文本',
        hideToolbar: mockHideToolbar,
        setInitialRewriteMode: mockSetInitialRewriteMode,
      }
      return selector ? selector(state) : state
    })
    ;(useLayoutStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (state: unknown) => unknown) => {
      const state = {
        setRightPanelTab: mockSetRightPanelTab,
        setRightPanelOpen: mockSetRightPanelOpen,
      }
      return selector ? selector(state) : state
    })
  })

  it('should render toolbar when visible', () => {
    render(<SelectionToolbar />)

    expect(screen.getByText('润色')).toBeInTheDocument()
    expect(screen.getByText('扩写')).toBeInTheDocument()
    expect(screen.getByText('缩写')).toBeInTheDocument()
  })

  it('should not render toolbar when not visible', () => {
    ;(useSelectionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (state: unknown) => unknown) => {
      const state = {
        isToolbarVisible: false,
        toolbarPosition: null,
        selectedText: '',
        hideToolbar: mockHideToolbar,
        setInitialRewriteMode: mockSetInitialRewriteMode,
      }
      return selector ? selector(state) : state
    })

    render(<SelectionToolbar />)

    expect(screen.queryByText('润色')).not.toBeInTheDocument()
  })

  it('should open right panel with selection tab when button clicked', () => {
    render(<SelectionToolbar />)

    fireEvent.click(screen.getByText('润色'))

    expect(mockSetInitialRewriteMode).toHaveBeenCalledWith('polish')
    expect(mockSetRightPanelTab).toHaveBeenCalledWith('selection')
    expect(mockSetRightPanelOpen).toHaveBeenCalledWith(true)
    expect(mockHideToolbar).toHaveBeenCalled()
  })

  it('should have 更多 button', () => {
    render(<SelectionToolbar />)

    expect(screen.getByText(/更多/)).toBeInTheDocument()
  })
})
