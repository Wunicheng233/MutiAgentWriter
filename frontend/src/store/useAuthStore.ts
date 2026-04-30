// 认证状态管理
import { create } from 'zustand'
import type { User } from '../types/api'
import { getMe } from '../utils/endpoints'

interface AuthState {
  user: User | null
  initialized: boolean
  initializing: boolean
  setUser: (user: User | null) => void
  isAuthenticated: () => boolean
  initializeAuth: () => Promise<void>
  resetAuth: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  initialized: false,
  initializing: false,

  setUser: (user: User | null) => set({ user }),

  isAuthenticated: () => {
    const token = localStorage.getItem('access_token')
    return !!token && !!get().user
  },

  initializeAuth: async () => {
    if (get().initializing || get().initialized) return

    set({ initializing: true })
    const token = localStorage.getItem('access_token')

    if (!token) {
      set({ initialized: true, initializing: false })
      return
    }

    try {
      const user = await getMe()
      set({ user, initialized: true, initializing: false })
    } catch (error) {
      console.error('[Auth] Failed to restore session:', error)
      localStorage.removeItem('access_token')
      set({ user: null, initialized: true, initializing: false })
    }
  },

  resetAuth: () => {
    set({ user: null, initialized: false, initializing: false })
  },
}))
