import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLayoutStore } from '../../store/useLayoutStore'

export const EditorStatusBar: React.FC = () => {
  const {
    typewriterMode,
    fadeMode,
    focusMode,
    vimMode,
    toggleTypewriterMode,
    toggleFadeMode,
    toggleFocusMode,
    toggleVimMode,
    setCommandPaletteOpen,
  } = useLayoutStore(
    useShallow((state) => ({
      typewriterMode: state.typewriterMode,
      fadeMode: state.fadeMode,
      focusMode: state.focusMode,
      vimMode: state.vimMode,
      toggleTypewriterMode: state.toggleTypewriterMode,
      toggleFadeMode: state.toggleFadeMode,
      toggleFocusMode: state.toggleFocusMode,
      toggleVimMode: state.toggleVimMode,
      setCommandPaletteOpen: state.setCommandPaletteOpen,
    }))
  )

  const ModeToggle = ({
    label,
    active,
    onClick,
    icon,
  }: {
    label: string
    active: boolean
    onClick: () => void
    icon: string
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
        active
          ? 'bg-[var(--accent-primary)] text-white'
          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )

  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-10 border-t border-[var(--border-default)] bg-[var(--bg-primary)] flex items-center justify-between px-4 z-40"
      data-testid="editor-status-bar"
    >
      <div className="flex items-center gap-2">
        <ModeToggle label="Typewriter" active={typewriterMode} onClick={toggleTypewriterMode} icon="📠" />
        <ModeToggle label="Fade" active={fadeMode} onClick={toggleFadeMode} icon="👁️" />
        <ModeToggle label="Focus" active={focusMode} onClick={toggleFocusMode} icon="🎯" />
        <ModeToggle label="Vim" active={vimMode} onClick={toggleVimMode} icon="🅥" />
      </div>

      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex items-center gap-1 px-2 py-1 rounded text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
        data-testid="cmd-k-button"
      >
        <span>⌘K</span>
      </button>
    </div>
  )
}

export default EditorStatusBar
