import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LayoutState {
  navCollapsed: boolean
  rightPanelOpen: boolean
  rightPanelWidth: number
  focusMode: boolean
  headerCollapsed: boolean
  autoExpandHeaderInProject: boolean
  defaultNavCollapsed: boolean
  defaultAIPanelOpen: boolean
  toggleNavCollapsed: () => void
  toggleRightPanel: () => void
  toggleFocusMode: () => void
  toggleHeader: () => void
  setRightPanelOpen: (open: boolean) => void
  setRightPanelWidth: (width: number) => void
  setHeaderCollapsed: (collapsed: boolean) => void
  setAutoExpandHeaderInProject: (value: boolean) => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      navCollapsed: false,
      rightPanelOpen: false,
      rightPanelWidth: 320,
      focusMode: false,
      headerCollapsed: true,
      autoExpandHeaderInProject: true,
      defaultNavCollapsed: false,
      defaultAIPanelOpen: false,
      toggleNavCollapsed: () => set((state) => ({ navCollapsed: !state.navCollapsed })),
      toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
      toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
      toggleHeader: () => set((state) => ({ headerCollapsed: !state.headerCollapsed })),
      setRightPanelOpen: (open: boolean) => set({ rightPanelOpen: open }),
      setRightPanelWidth: (width: number) => set({ rightPanelWidth: Math.max(240, Math.min(480, width)) }),
      setHeaderCollapsed: (collapsed: boolean) => set({ headerCollapsed: collapsed }),
      setAutoExpandHeaderInProject: (value: boolean) => set({ autoExpandHeaderInProject: value }),
    }),
    {
      name: 'storyforge-layout-storage',
    }
  )
)
