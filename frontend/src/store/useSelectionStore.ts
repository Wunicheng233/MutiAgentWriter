import { create } from 'zustand'

interface SelectionState {
  selectedText: string
  selectionStart: number
  selectionEnd: number
  isToolbarVisible: boolean
  toolbarPosition: { top: number; left: number } | null
  reset: () => void
  setSelection: (text: string, start: number, end: number) => void
  hideToolbar: () => void
  setToolbarPosition: (pos: { top: number; left: number }) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedText: '',
  selectionStart: 0,
  selectionEnd: 0,
  isToolbarVisible: false,
  toolbarPosition: null,

  reset: () => set({
    selectedText: '',
    selectionStart: 0,
    selectionEnd: 0,
    isToolbarVisible: false,
    toolbarPosition: null,
  }),

  setSelection: (text: string, start: number, end: number) => set({
    selectedText: text,
    selectionStart: start,
    selectionEnd: end,
    isToolbarVisible: true,
  }),

  hideToolbar: () => set({
    isToolbarVisible: false,
    toolbarPosition: null,
    selectedText: '',
  }),

  setToolbarPosition: (pos: { top: number; left: number }) => set({
    toolbarPosition: pos,
  }),
}))
