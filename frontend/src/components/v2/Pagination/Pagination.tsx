import React from 'react'

export interface PaginationProps {
  current: number
  total: number
  pageSize?: number
  onChange?: (page: number) => void
  showSizeChanger?: boolean
  showQuickJumper?: boolean
  className?: string
}

export const Pagination: React.FC<PaginationProps> = ({
  current,
  total,
  pageSize = 10,
  onChange,
  className = '',
}) => {
  const totalPages = Math.ceil(total / pageSize)

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (current <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (current >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        pages.push(current - 1)
        pages.push(current)
        pages.push(current + 1)
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages
  }

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== current) {
      onChange?.(page)
    }
  }

  return (
    <div className={`flex items-center gap-1 ${className}`.trim()}>
      {/* Prev Button */}
      <button
        aria-label="上一页"
        disabled={current <= 1}
        onClick={() => handlePageClick(current - 1)}
        className={`
          flex items-center justify-center w-8 h-8 rounded-md text-sm
          transition-colors duration-150
          ${current <= 1
            ? 'text-[var(--text-muted)] cursor-not-allowed opacity-50'
            : 'text-[var(--text-body)] hover:bg-[var(--bg-tertiary)]'
          }
        `}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Page Numbers */}
      {getPageNumbers().map((page, index) => (
        typeof page === 'number' ? (
          <button
            key={index}
            onClick={() => handlePageClick(page)}
            className={`
              flex items-center justify-center w-8 h-8 rounded-md text-sm
              transition-all duration-150
              ${page === current
                ? 'bg-[var(--accent-primary)] text-white font-medium'
                : 'text-[var(--text-body)] hover:bg-[var(--bg-tertiary)]'}
            `}
          >
            {page}
          </button>
        ) : (
          <span key={index} className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)]">
            {page}
          </span>
        )
      ))}

      {/* Next Button */}
      <button
        aria-label="下一页"
        disabled={current >= totalPages}
        onClick={() => handlePageClick(current + 1)}
        className={`
          flex items-center justify-center w-8 h-8 rounded-md text-sm
          transition-colors duration-150
          ${current >= totalPages
            ? 'text-[var(--text-muted)] cursor-not-allowed opacity-50'
            : 'text-[var(--text-body)] hover:bg-[var(--bg-tertiary)]'
          }
        `}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}

Pagination.displayName = 'Pagination'
