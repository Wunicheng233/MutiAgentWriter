import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { Button } from './v2'
import { logout } from '../utils/endpoints'

export const NavBar: React.FC = () => {
  const { user, setUser, resetAuth } = useAuthStore()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    setUser(null)
    resetAuth()
    navigate('/login')
  }

  return (
    <nav className="sticky top-0 z-50 bg-[var(--bg-primary)] bg-opacity-90 backdrop-blur-lg border-b border-[var(--border-default)]">
      <div className="max-w-6xl mx-auto px-6 h-[64px] flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="font-medium text-sm uppercase tracking-[0.24em] text-[var(--text-secondary)]">
            MultiAgentWriter
          </span>
        </Link>

        {/* Desktop menu */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            to="/dashboard"
            className="text-[var(--text-body)] hover:text-[var(--accent-primary)] px-3 py-2 rounded-full transition-colors"
          >
            书架
          </Link>
          <Link
            to="/settings"
            className="text-[var(--text-body)] hover:text-[var(--accent-primary)] px-3 py-2 rounded-full transition-colors"
          >
            设置
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-[var(--text-secondary)] text-sm">{user.username}</span>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                退出
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="secondary" size="sm">
                  登录
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  注册
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {isMenuOpen && (
        <div className="md:hidden bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-[var(--shadow-default)] mx-4 py-3 absolute top-[72px] left-0 right-0 z-50">
          <div className="flex flex-col gap-1 px-3">
            <Link
              to="/dashboard"
              className="px-3 py-2 text-[var(--text-body)] hover:bg-[var(--bg-tertiary)] rounded-lg"
              onClick={() => setIsMenuOpen(false)}
            >
              书架
            </Link>
            <Link
              to="/settings"
              className="px-3 py-2 text-[var(--text-body)] hover:bg-[var(--bg-tertiary)] rounded-lg"
              onClick={() => setIsMenuOpen(false)}
            >
              设置
            </Link>
            {user && (
              <button
                className="text-left px-3 py-2 text-[var(--accent-warm)] hover:bg-[var(--bg-tertiary)] rounded-lg"
                onClick={() => {
                  handleLogout()
                  setIsMenuOpen(false)
                }}
              >
                退出
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

export default NavBar
