import React from 'react'

export type SkeletonVariant = 'text' | 'circle' | 'rect'

export interface SkeletonProps {
  variant?: SkeletonVariant
  count?: number
  width?: number | string
  height?: number | string
  animation?: boolean
  lastLineWidth?: string
  gap?: number
  className?: string
}

const variantClasses: Record<SkeletonVariant, string> = {
  text: 'h-4 rounded-[var(--radius-sm)]',
  circle: 'rounded-full',
  rect: 'rounded-[var(--radius-md)]',
}

const gapClasses: Record<number, string> = {
  4: 'gap-1',
  8: 'gap-2',
  12: 'gap-3',
  16: 'gap-4',
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  count = 1,
  width,
  height,
  animation = true,
  lastLineWidth,
  gap = 8,
  className = '',
}) => {
  const baseClasses = `
    bg-[var(--bg-tertiary)]
    ${animation ? 'animate-pulse' : ''}
    ${variantClasses[variant]}
  `

  const getStyle = (index: number): React.CSSProperties => {
    const style: React.CSSProperties = {}

    if (width) {
      style.width = typeof width === 'number' ? `${width}px` : width
    }
    if (height) {
      style.height = typeof height === 'number' ? `${height}px` : height
    }

    if (variant === 'text' && lastLineWidth && index === count - 1) {
      style.width = lastLineWidth
    }

    return style
  }

  const renderSkeleton = (index: number) => (
    <div
      key={index}
      data-testid="skeleton"
      className={`${baseClasses} ${className}`.trim()}
      style={getStyle(index)}
    />
  )

  if (count > 1 && variant === 'text') {
    return (
      <div className={`flex flex-col ${gapClasses[gap] || 'gap-2'}`}>
        {Array.from({ length: count }).map((_, index) => renderSkeleton(index))}
      </div>
    )
  }

  return renderSkeleton(0)
}

Skeleton.displayName = 'Skeleton'

// Helper component for skeleton cards
export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="p-4 space-y-4">
    <Skeleton variant="rect" height={120} />
    <Skeleton variant="text" count={lines} lastLineWidth="60%" />
  </div>
)

// Helper component for skeleton text paragraphs
export const SkeletonParagraph: React.FC<{ lines?: number }> = ({ lines = 4 }) => (
  <div className="space-y-3">
    <Skeleton variant="text" count={lines} lastLineWidth="80%" />
  </div>
)
