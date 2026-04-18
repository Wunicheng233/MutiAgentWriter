import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated())
  const user = useAuthStore(state => state.user)
  const initialized = useAuthStore(state => state.initialized)
  const initializing = useAuthStore(state => state.initializing)

  if (initializing || !initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 animate-pulse">加载中...</div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
