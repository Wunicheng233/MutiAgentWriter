import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { RewriteMode } from '../utils/selectionAI'

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
  commandPaletteOpen: boolean
  defaultRewriteMode: RewriteMode
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
  setCommandPaletteOpen: (open: boolean) => void
  setDefaultRewriteMode: (mode: RewriteMode) => void
  setDefaultAIPanelOpen: (open: boolean) => void
  clearAllLocalState: () => void
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
      commandPaletteOpen: false,
      defaultRewriteMode: RewriteMode.POLISH,
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
      setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),
      setDefaultRewriteMode: (mode: RewriteMode) => set({ defaultRewriteMode: mode }),
      setDefaultAIPanelOpen: (open: boolean) => set({ defaultAIPanelOpen: open }),
      clearAllLocalState: () => {
        set({
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
          commandPaletteOpen: false,
          defaultRewriteMode: RewriteMode.POLISH,
        })
        if (typeof window !== 'undefined') {
          localStorage.clear()
        }
      },
    }),
    {
      name: 'storyforge-layout-storage',
    }
  )
)
