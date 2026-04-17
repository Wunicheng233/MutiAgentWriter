// 认证状态管理
import { create } from 'zustand'
import type { User } from '../types/api'

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  setUser: (user: User | null) => set({ user }),
  isAuthenticated: () => {
    const token = localStorage.getItem('access_token')
    return !!token && !!get().user
  },
}))
