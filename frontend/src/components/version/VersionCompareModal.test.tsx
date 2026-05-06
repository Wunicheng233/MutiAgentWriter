import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import VersionCompareModal from './VersionCompareModal'

const mockVersions = [
  { id: 2, version_number: 2, word_count: 2000, created_at: '2026-05-05T12:00:00Z' },
  { id: 1, version_number: 1, word_count: 1500, created_at: '2026-05-04T12:00:00Z' },
]

const mockGetVersionDetail = vi.fn().mockResolvedValue({
  id: 1,
  version_number: 1,
  word_count: 1500,
  created_at: '2026-05-04T12:00:00Z',
  content: '测试内容',
})

describe('VersionCompareModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when isOpen is false', () => {
    render(
      <VersionCompareModal
        isOpen={false}
        onClose={() => {}}
        versions={mockVersions}
        initialLeftVersionId={null}
        getVersionDetail={mockGetVersionDetail}
        onRestore={() => {}}
        isRestoring={false}
      />
    )

    expect(screen.queryByTestId('version-compare-modal')).not.toBeInTheDocument()
  })

  it('renders when isOpen is true and uses v2 Modal component', () => {
    render(
      <VersionCompareModal
        isOpen={true}
        onClose={() => {}}
        versions={mockVersions}
        initialLeftVersionId={null}
        getVersionDetail={mockGetVersionDetail}
        onRestore={() => {}}
        isRestoring={false}
      />
    )

    expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument()
    expect(screen.getByTestId('modal-content')).toBeInTheDocument()
    expect(screen.getByText('版本对比')).toBeInTheDocument()
  })

  it('renders version selectors with correct labels', () => {
    render(
      <VersionCompareModal
        isOpen={true}
        onClose={() => {}}
        versions={mockVersions}
        initialLeftVersionId={null}
        getVersionDetail={mockGetVersionDetail}
        onRestore={() => {}}
        isRestoring={false}
      />
    )

    expect(screen.getByText('旧版本')).toBeInTheDocument()
    expect(screen.getByText('新版本')).toBeInTheDocument()
  })

  it('shows restore button only when left version is selected', async () => {
    render(
      <VersionCompareModal
        isOpen={true}
        onClose={() => {}}
        versions={mockVersions}
        initialLeftVersionId={null}
        getVersionDetail={mockGetVersionDetail}
        onRestore={() => {}}
        isRestoring={false}
      />
    )

    // Restore button should not be visible initially
    expect(screen.queryByText('恢复到')).not.toBeInTheDocument()
  })

  it('auto-selects latest version as right version on open', () => {
    render(
      <VersionCompareModal
        isOpen={true}
        onClose={() => {}}
        versions={mockVersions}
        initialLeftVersionId={null}
        getVersionDetail={mockGetVersionDetail}
        onRestore={() => {}}
        isRestoring={false}
      />
    )

    // Right version should be auto-selected to latest (id=2)
    const rightSelect = screen.getAllByRole('combobox')[1]
    expect(rightSelect).toHaveValue('2')
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <VersionCompareModal
        isOpen={true}
        onClose={onClose}
        versions={mockVersions}
        initialLeftVersionId={null}
        getVersionDetail={mockGetVersionDetail}
        onRestore={() => {}}
        isRestoring={false}
      />
    )

    fireEvent.click(screen.getByTestId('modal-close-button'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
