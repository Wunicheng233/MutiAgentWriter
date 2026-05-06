import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RightPanelTab = 'chat' | 'selection'

interface LayoutState {
  navCollapsed: boolean
  rightPanelOpen: boolean
  rightPanelWidth: number
  rightPanelTab: RightPanelTab
  focusMode: boolean
  headerCollapsed: boolean
  autoExpandHeaderInProject: boolean
  defaultNavCollapsed: boolean
  defaultAIPanelOpen: boolean
  typewriterMode: boolean
  fadeMode: boolean
  vimMode: boolean
  commandPaletteOpen: boolean
  toggleNavCollapsed: () => void
  toggleRightPanel: () => void
  toggleFocusMode: () => void
  toggleHeader: () => void
  setRightPanelOpen: (open: boolean) => void
  setRightPanelWidth: (width: number) => void
  setRightPanelTab: (tab: RightPanelTab) => void
  setHeaderCollapsed: (collapsed: boolean) => void
  setAutoExpandHeaderInProject: (value: boolean) => void
  toggleTypewriterMode: () => void
  toggleFadeMode: () => void
  toggleVimMode: () => void
  setCommandPaletteOpen: (open: boolean) => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      navCollapsed: false,
      rightPanelOpen: false,
      rightPanelWidth: 320,
      rightPanelTab: 'chat',
      focusMode: false,
      headerCollapsed: true,
      autoExpandHeaderInProject: true,
      defaultNavCollapsed: false,
      defaultAIPanelOpen: false,
      typewriterMode: false,
      fadeMode: false,
      vimMode: false,
      commandPaletteOpen: false,
      toggleNavCollapsed: () => set((state) => ({ navCollapsed: !state.navCollapsed })),
      toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
      toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
      toggleHeader: () => set((state) => ({ headerCollapsed: !state.headerCollapsed })),
      setRightPanelOpen: (open: boolean) => set({ rightPanelOpen: open }),
      setRightPanelWidth: (width: number) => set({ rightPanelWidth: Math.max(240, Math.min(480, width)) }),
      setRightPanelTab: (tab: RightPanelTab) => set({ rightPanelTab: tab }),
      setHeaderCollapsed: (collapsed: boolean) => set({ headerCollapsed: collapsed }),
      setAutoExpandHeaderInProject: (value: boolean) => set({ autoExpandHeaderInProject: value }),
      toggleTypewriterMode: () => set((state) => ({ typewriterMode: !state.typewriterMode })),
      toggleFadeMode: () => set((state) => ({ fadeMode: !state.fadeMode })),
      toggleVimMode: () => set((state) => ({ vimMode: !state.vimMode })),
      setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),
    }),
    {
      name: 'storyforge-layout-storage',
    }
  )
)
