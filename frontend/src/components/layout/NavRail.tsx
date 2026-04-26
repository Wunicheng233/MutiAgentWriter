import React, { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useProjectStore } from '../../store/useProjectStore'

interface NavItemProps {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}

const NavItem: React.FC<NavItemProps> = React.memo(({ icon, label, active, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          w-11 h-11 flex items-center justify-center rounded-lg transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-opacity-50
          ${active
            ? 'bg-[var(--accent-primary)] bg-opacity-10 text-[var(--accent-primary)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
          }
        `}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        data-testid="nav-item"
      >
        {icon}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50">
          <div className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm whitespace-nowrap shadow-[var(--shadow-default)] border border-[var(--border-default)]">
            {label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[var(--bg-secondary)]"></div>
          </div>
        </div>
      )}
    </div>
  )
})

NavItem.displayName = 'NavItem'

interface NavRailProps {
  collapsed: boolean
  onToggleCollapse: () => void
}

// SVG Icons (outline style, no emoji)
const ProjectIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

const ChaptersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)

const AnalyticsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
)

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.1a1.65 1.65 0 0 0-1.51-1H10a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1-1.51H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.1a1.65 1.65 0 0 0 1.51-1l-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.1a1.65 1.65 0 0 0 1 1.51l.33 1.82.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15" />
  </svg>
)

const CollapseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

const OutlineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
)

const EditorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const ExportIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

// 全局导航项
const globalNavItems = [
  { id: 'dashboard', label: '书架', path: '/dashboard', icon: <ProjectIcon /> },
  { id: 'settings', label: '设置', path: '/settings', icon: <SettingsIcon /> },
]

// 项目内导航项
const projectNavItems = [
  { id: 'overview', label: '概览', path: 'overview', icon: <ProjectIcon /> },
  { id: 'outline', label: '大纲', path: 'outline', icon: <OutlineIcon /> },
  { id: 'chapters', label: '章节', path: 'chapters', icon: <ChaptersIcon /> },
  { id: 'editor', label: '编辑器', path: 'editor/0', icon: <EditorIcon /> },
  { id: 'analytics', label: '质量中心', path: 'analytics', icon: <AnalyticsIcon /> },
  { id: 'export', label: '导出分享', path: 'export', icon: <ExportIcon /> },
]

export const NavRail: React.FC<NavRailProps> = React.memo(({ collapsed, onToggleCollapse }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [, setHovered] = useState(false)
  const { isInProject, currentProjectId } = useProjectStore()

  const navItems = isInProject ? projectNavItems : globalNavItems

  const handleNavigate = useCallback((path: string) => {
    if (isInProject && currentProjectId) {
      navigate(`/projects/${currentProjectId}/${path}`)
    } else {
      navigate(path)
    }
  }, [navigate, isInProject, currentProjectId])

  const isActive = useCallback((path: string) => {
    if (isInProject && currentProjectId) {
      return location.pathname.startsWith(`/projects/${currentProjectId}/${path}`)
    }
    return location.pathname.startsWith(path)
  }, [location.pathname, isInProject, currentProjectId])

  const handleMouseEnter = useCallback(() => {
    if (collapsed) setHovered(true)
  }, [collapsed])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
  }, [])

  // Collapsed width: 56px, Expanded width: 64px
  // When collapsed and hovered, show tooltip on nav items
  const navWidth = collapsed ? '56px' : '64px'

  return (
    <nav
      className={`h-full flex flex-col justify-between items-center py-4 bg-[var(--bg-secondary)] transition-all duration-200 ease-out nav-rail ${collapsed ? 'nav-collapsed' : 'nav-expanded'}`}
      style={{ width: navWidth }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid="nav-rail"
      aria-label="Main navigation"
    >
      {/* Navigation Items */}
      <div className="flex flex-col gap-3 items-center" role="menubar">
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={isActive(item.path)}
            onClick={() => handleNavigate(item.path)}
          />
        ))}
      </div>

      {/* Collapse/Expand Button at the bottom */}
      <button
        onClick={onToggleCollapse}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-opacity-50"
        title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        data-testid="collapse-button"
      >
        <span style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 200ms ease-out' }}>
          <CollapseIcon />
        </span>
      </button>
    </nav>
  )
})

NavRail.displayName = 'NavRail'

export default NavRail
