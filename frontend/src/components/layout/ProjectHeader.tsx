import React, { useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../store/useProjectStore'
import { useLayoutStore } from '../../store/useLayoutStore'
import { Badge } from '../v2/Badge/Badge'

const statusConfig: Record<string, { variant: 'secondary' | 'success' | 'warning' | 'error'; label: string }> = {
  draft: { variant: 'secondary', label: '草稿' },
  generating: { variant: 'warning', label: '生成中' },
  waiting_confirm: { variant: 'warning', label: '待确认' },
  completed: { variant: 'success', label: '已完成' },
  failed: { variant: 'error', label: '失败' },
}

export const ProjectHeader: React.FC = () => {
  const navigate = useNavigate()
  const { currentProjectName, projectStatus, progressPercent, clearCurrentProject } = useProjectStore(useShallow(state => ({
    currentProjectName: state.currentProjectName,
    projectStatus: state.projectStatus,
    progressPercent: state.progressPercent,
    clearCurrentProject: state.clearCurrentProject,
  })))
  const { headerCollapsed, toggleHeader } = useLayoutStore(useShallow(state => ({
    headerCollapsed: state.headerCollapsed,
    toggleHeader: state.toggleHeader,
  })))
  const [isHoverPreview, setIsHoverPreview] = useState(false)

  const handleBack = () => {
    clearCurrentProject()
    navigate('/dashboard')
  }

  const handleHeaderClick = useCallback(() => {
    if (headerCollapsed) {
      toggleHeader()
    }
  }, [headerCollapsed, toggleHeader])

  const handleToggleHeader = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    toggleHeader()
  }, [toggleHeader])

  const handleMouseEnter = useCallback(() => {
    if (headerCollapsed) {
      setIsHoverPreview(true)
    }
  }, [headerCollapsed])

  const handleMouseLeave = useCallback(() => {
    setIsHoverPreview(false)
  }, [])

  const config = statusConfig[projectStatus]
  const showProgress = projectStatus === 'generating'
  const displayedProgress = Math.round(Math.min(100, Math.max(0, progressPercent)))

  // Calculate effective height: collapsed(6px) -> hoverPreview(14px) -> expanded(64px)
  const effectiveHeight = headerCollapsed ? (isHoverPreview ? '14px' : '6px') : '64px'

  return (
    <header
      data-testid="project-header"
      className={`non-essential-ui flex items-center px-6 border-b border-[var(--border-default)] bg-[var(--bg-primary)]
        ${headerCollapsed ? 'header-collapsed' : 'header-expanded'}
        ${headerCollapsed ? 'cursor-pointer' : 'cursor-default'}
        transition-[height,background-color,border-color] ease-out`}
      style={{
        height: effectiveHeight,
        transitionDuration: '200ms',
      }}
      onClick={handleHeaderClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="flex w-full items-center transition-opacity ease-out"
        style={{
          opacity: headerCollapsed ? 0 : 1,
          transitionDuration: '150ms',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleBack()
          }}
          className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>书架</span>
        </button>

        <div className="flex-1 flex items-center gap-4 ml-6">
          <h1 className="text-lg font-medium text-[var(--text-primary)]">{currentProjectName}</h1>
          <Badge variant={config.variant}>
            <span className="flex items-center gap-2">
              {showProgress && (
                <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
              )}
              {config.label}
              {showProgress && <span>{displayedProgress}%</span>}
            </span>
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="收起顶栏"
            title="收起顶栏"
            onClick={handleToggleHeader}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
