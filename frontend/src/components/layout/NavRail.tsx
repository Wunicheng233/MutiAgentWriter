import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

interface NavItemProps {
  icon: React.ReactNode
  label: string
  path: string
  active: boolean
  onClick: () => void
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, path, active, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        w-11 h-11 flex items-center justify-center rounded-lg transition-all duration-150
        ${active
          ? 'bg-[var(--accent-primary)] bg-opacity-10 text-[var(--accent-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
        }
      `}
      title={label}
      data-testid="nav-item"
    >
      {icon}
    </button>
  )
}

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

const EditorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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

const CharactersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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

export const NavRail: React.FC<NavRailProps> = ({ collapsed, onToggleCollapse }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [hovered, setHovered] = useState(false)

  const navItems = [
    { path: '/projects', icon: <ProjectIcon />, label: 'Project Overview' },
    { path: '/write', icon: <EditorIcon />, label: 'Editor' },
    { path: '/chapters', icon: <ChaptersIcon />, label: 'Chapters' },
    { path: '/characters', icon: <CharactersIcon />, label: 'Characters' },
    { path: '/analytics', icon: <AnalyticsIcon />, label: 'Analytics' },
    { path: '/settings', icon: <SettingsIcon />, label: 'Settings' },
  ]

  const isActive = (path: string) => {
    return location.pathname.startsWith(path)
  }

  // When collapsed and hovered, expand temporarily
  const effectiveCollapsed = collapsed && !hovered

  return (
    <div
      className={`h-full flex flex-col items-center py-4 bg-[var(--bg-secondary)] transition-all duration-200 ease-out ${
        effectiveCollapsed ? 'justify-center' : 'justify-between'
      }`}
      onMouseEnter={() => collapsed && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid="nav-rail"
    >
      {!effectiveCollapsed && (
        <>
          <div className="flex flex-col gap-2 items-center">
            {navItems.map((item) => (
              <NavItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                path={item.path}
                active={isActive(item.path)}
                onClick={() => navigate(item.path)}
              />
            ))}
          </div>

          <button
            onClick={onToggleCollapse}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all duration-150"
            title="Collapse sidebar"
            data-testid="collapse-button"
          >
            <CollapseIcon />
          </button>
        </>
      )}
    </div>
  )
}

export default NavRail
