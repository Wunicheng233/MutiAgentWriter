import React, { useState, useCallback, useMemo } from 'react'
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
            ? 'bg-[var(--accent-primary)] text-white shadow-[var(--shadow-sm)]'
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

interface NavConfigItem {
  id: string
  label: string
  path: string
  activePath?: string
  icon: React.ReactNode
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

const ReaderIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H11v18H4.5A2.5 2.5 0 0 0 2 22V4.5z" />
    <path d="M22 4.5A2.5 2.5 0 0 0 19.5 2H13v18h6.5A2.5 2.5 0 0 1 22 22V4.5z" />
  </svg>
)

const ExportIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const HistoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)

const BibleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M9 9h.01" />
    <path d="M15 9h.01" />
    <path d="M12 15h.01" />
  </svg>
)

// 全局导航项
const globalNavItems: NavConfigItem[] = [
  { id: 'dashboard', label: '书架', path: '/dashboard', icon: <ProjectIcon /> },
  { id: 'settings', label: '设置', path: '/settings', icon: <SettingsIcon /> },
]

export const NavRail: React.FC<NavRailProps> = React.memo(({ collapsed, onToggleCollapse }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [, setHovered] = useState(false)
  const { isInProject, currentProjectId } = useProjectStore()
  const routeProjectId = location.pathname.match(/^\/projects\/(?!new(?:\/|$))([^/]+)/)?.[1] ?? null
  const activeProjectId = routeProjectId ?? currentProjectId
  const isProjectContext = !!routeProjectId || (
    !!isInProject &&
    !!currentProjectId &&
    location.pathname.startsWith(`/projects/${currentProjectId}`)
  )

  // 项目内导航项
  const projectNavItems = useMemo<NavConfigItem[]>(() => [
    { id: 'overview', label: '概览', path: 'overview', icon: <ProjectIcon /> },
    { id: 'outline', label: '大纲', path: 'outline', icon: <OutlineIcon /> },
    { id: 'chapters', label: '章节', path: 'chapters', icon: <ChaptersIcon /> },
    { id: 'reader', label: '阅读器', path: 'read/1', activePath: 'read', icon: <ReaderIcon /> },
    { id: 'editor', label: '编辑器', path: 'editor/1', activePath: 'editor', icon: <EditorIcon /> },
    { id: 'bible', label: '设定库', path: 'bible', icon: <BibleIcon /> },
    { id: 'analytics', label: '质量中心', path: 'analytics', icon: <AnalyticsIcon /> },
    { id: 'versions', label: '历史版本', path: 'versions', icon: <HistoryIcon /> },
    { id: 'export', label: '导出分享', path: 'export', icon: <ExportIcon /> },
  ], [])

  const navItems = isProjectContext ? projectNavItems : globalNavItems

  const handleNavigate = useCallback((path: string) => {
    if (isProjectContext && activeProjectId) {
      navigate(`/projects/${activeProjectId}/${path}`)
    } else {
      navigate(path)
    }
  }, [navigate, isProjectContext, activeProjectId])

  const isActive = useCallback((path: string, activePath?: string) => {
    if (isProjectContext && activeProjectId) {
      return location.pathname.startsWith(`/projects/${activeProjectId}/${activePath ?? path}`)
    }
    return location.pathname.startsWith(path)
  }, [location.pathname, isProjectContext, activeProjectId])

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
      className={`h-full flex flex-col justify-between items-center py-4 bg-[var(--bg-secondary)] border-r border-[var(--border-default)] rounded-tr-[var(--radius-lg)] rounded-br-[var(--radius-lg)] transition-all duration-200 ease-out nav-rail ${collapsed ? 'nav-collapsed' : 'nav-expanded'}`}
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
            active={isActive(item.path, item.activePath)}
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
