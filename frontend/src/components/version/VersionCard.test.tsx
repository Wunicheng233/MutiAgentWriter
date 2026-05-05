import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import VersionCard from './VersionCard'

const mockVersion = {
  id: 1,
  version_number: 2,
  word_count: 2000,
  created_at: '2026-05-05T12:00:00Z',
}

describe('VersionCard', () => {
  it('renders version information correctly', () => {
    render(
      <VersionCard
        version={mockVersion}
        isLatest={false}
        onRestore={() => {}}
        onCompare={() => {}}
        isRestoring={false}
      />
    )

    expect(screen.getByText('V2')).toBeInTheDocument()
    expect(screen.getByText(/2000 字/)).toBeInTheDocument()
  })

  it('shows "当前版本" label for latest version', () => {
    render(
      <VersionCard
        version={mockVersion}
        isLatest={true}
        onRestore={() => {}}
        onCompare={() => {}}
        isRestoring={false}
      />
    )

    expect(screen.getByText('· 当前版本')).toBeInTheDocument()
  })

  it('hides restore button for latest version', () => {
    render(
      <VersionCard
        version={mockVersion}
        isLatest={true}
        onRestore={() => {}}
        onCompare={() => {}}
        isRestoring={false}
      />
    )

    expect(screen.queryByText('恢复此版本')).not.toBeInTheDocument()
    expect(screen.getByText('对比')).toBeInTheDocument()
  })

  it('calls onRestore when restore button is clicked', () => {
    const onRestore = vi.fn()
    render(
      <VersionCard
        version={mockVersion}
        isLatest={false}
        onRestore={onRestore}
        onCompare={() => {}}
        isRestoring={false}
      />
    )

    fireEvent.click(screen.getByText('恢复此版本'))
    expect(onRestore).toHaveBeenCalledWith(1)
  })

  it('calls onCompare when compare button is clicked', () => {
    const onCompare = vi.fn()
    render(
      <VersionCard
        version={mockVersion}
        isLatest={true}
        onRestore={() => {}}
        onCompare={onCompare}
        isRestoring={false}
      />
    )

    fireEvent.click(screen.getByText('对比'))
    expect(onCompare).toHaveBeenCalledWith(1)
  })
})
