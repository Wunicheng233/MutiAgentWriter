import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { Button } from './Button'
import { logout } from '../utils/endpoints'

export const NavBar: React.FC = () => {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    setUser(null)
    navigate('/login')
  }

  return (
    <nav className="sticky top-0 z-50 bg-parchment/85 backdrop-blur-xl">
      <div className="max-w-content mx-auto px-6 h-[72px] flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="font-serif text-2xl text-inkwell font-normal">
            MutiAgentWriter
          </span>
        </Link>

        {/* Desktop menu */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            to="/dashboard"
            className="text-body hover:text-sage px-3 py-2 rounded-pill transition-colors"
          >
            书架
          </Link>
          <Link
            to="/settings"
            className="text-body hover:text-sage px-3 py-2 rounded-pill transition-colors"
          >
            设置
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-secondary text-sm">{user.username}</span>
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
          className="md:hidden p-2 text-secondary hover:text-inkwell"
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
        <div className="md:hidden bg-white border border-border rounded-standard shadow-elevated mx-4 py-3 absolute top-[80px] left-0 right-0">
          <div className="flex flex-col gap-1 px-3">
            <Link
              to="/dashboard"
              className="px-3 py-2 text-body hover:bg-parchment rounded-standard"
              onClick={() => setIsMenuOpen(false)}
            >
              书架
            </Link>
            <Link
              to="/settings"
              className="px-3 py-2 text-body hover:bg-parchment rounded-standard"
              onClick={() => setIsMenuOpen(false)}
            >
              设置
            </Link>
            {user && (
              <button
                className="text-left px-3 py-2 text-terracotta hover:bg-parchment rounded-standard"
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
