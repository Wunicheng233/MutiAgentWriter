import React from 'react'

export interface Column<T extends object = object> {
  key: string
  title: React.ReactNode
  render?: (value: unknown, record: T, index: number) => React.ReactNode
  width?: string | number
  align?: 'left' | 'center' | 'right'
}

export interface TableProps<T extends object = object> {
  columns: Column<T>[]
  dataSource: T[]
  rowKey?: string
  striped?: boolean
  hoverable?: boolean
  bordered?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'py-2 px-3',
  md: 'py-3 px-4',
  lg: 'py-4 px-5',
}

export function Table<T extends object>({
  columns,
  dataSource,
  rowKey = 'id',
  striped = false,
  hoverable = true,
  bordered = false,
  size = 'md',
  className = '',
}: TableProps<T>) {
  const paddingClass = sizeClasses[size]

  const getAlignClass = (align?: string) => {
    switch (align) {
      case 'center': return 'text-center'
      case 'right': return 'text-right'
      default: return 'text-left'
    }
  }

  return (
    <div className={`w-full overflow-auto ${className}`.trim()}>
      <table className={`w-full border-collapse ${bordered ? 'border border-[var(--border-default)]' : ''}`}>
        <thead>
          <tr className="bg-[var(--bg-secondary)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${paddingClass} font-medium text-[var(--text-primary)] border-b-2 border-[var(--border-default)] ${getAlignClass(col.align)}`}
                style={{ width: col.width }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={`${paddingClass} text-center text-[var(--text-secondary)]`}>
                暂无数据
              </td>
            </tr>
          ) : (
            dataSource.map((record, index) => (
              <tr
                key={(record[rowKey as keyof T] as React.Key) ?? index}
                className={`
                  border-b border-[var(--border-default)]
                  ${striped && index % 2 === 1 ? 'bg-[var(--bg-tertiary)]' : ''}
                  ${hoverable ? 'hover:bg-[var(--bg-tertiary)] transition-colors' : ''}
                `}
              >
                {columns.map((col) => {
                  const value = record[col.key as keyof T]
                  return (
                    <td
                      key={col.key}
                      className={`${paddingClass} text-[var(--text-body)] ${getAlignClass(col.align)}`}
                    >
                      {col.render ? col.render(value, record, index) : (value as React.ReactNode)}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

Table.displayName = 'Table'
