import { create } from 'zustand'
import type { RewriteMode } from '../utils/selectionAI'

interface SelectionState {
  selectedText: string
  selectionStart: number
  selectionEnd: number
  isToolbarVisible: boolean
  toolbarPosition: { top: number; left: number } | null
  initialRewriteMode: RewriteMode | null
  pendingRewriteResult: string | null
  reset: () => void
  setSelection: (text: string, start: number, end: number) => void
  hideToolbar: () => void
  setToolbarPosition: (pos: { top: number; left: number }) => void
  setInitialRewriteMode: (mode: RewriteMode | null) => void
  setPendingRewriteResult: (result: string | null) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedText: '',
  selectionStart: 0,
  selectionEnd: 0,
  isToolbarVisible: false,
  toolbarPosition: null,
  initialRewriteMode: null,
  pendingRewriteResult: null,

  reset: () => set({
    selectedText: '',
    selectionStart: 0,
    selectionEnd: 0,
    isToolbarVisible: false,
    toolbarPosition: null,
    initialRewriteMode: null,
    pendingRewriteResult: null,
  }),

  setSelection: (text: string, start: number, end: number) => set({
    selectedText: text,
    selectionStart: start,
    selectionEnd: end,
    isToolbarVisible: true,
    pendingRewriteResult: null,
  }),

  hideToolbar: () => set({
    isToolbarVisible: false,
    toolbarPosition: null,
  }),

  setToolbarPosition: (pos: { top: number; left: number }) => set({
    toolbarPosition: pos,
  }),

  setInitialRewriteMode: (mode: RewriteMode | null) => set({
    initialRewriteMode: mode,
  }),

  setPendingRewriteResult: (result: string | null) => set({
    pendingRewriteResult: result,
  }),
}))
