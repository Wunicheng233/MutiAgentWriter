import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLayoutStore } from '../../store/useLayoutStore'

interface ModeToggleProps {
  label: string
  active: boolean
  onClick: () => void
}

const ModeToggle: React.FC<ModeToggleProps> = ({
  label,
  active,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
      active
        ? 'bg-[var(--accent-primary)] text-white'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
      }`}
  >
    <span>{label}</span>
  </button>
)

export const EditorStatusBar: React.FC = () => {
  const {
    typewriterMode,
    fadeMode,
    focusMode,
    toggleTypewriterMode,
    toggleFadeMode,
    toggleFocusMode,
    setCommandPaletteOpen,
  } = useLayoutStore(
    useShallow((state) => ({
      typewriterMode: state.typewriterMode,
      fadeMode: state.fadeMode,
      focusMode: state.focusMode,
      toggleTypewriterMode: state.toggleTypewriterMode,
      toggleFadeMode: state.toggleFadeMode,
      toggleFocusMode: state.toggleFocusMode,
      setCommandPaletteOpen: state.setCommandPaletteOpen,
    }))
  )

  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-10 border-t border-[var(--border-default)] bg-[var(--bg-primary)] flex items-center justify-between px-4 z-40"
      data-testid="editor-status-bar"
    >
      <div className="flex items-center gap-2">
        <ModeToggle label="Typewriter" active={typewriterMode} onClick={toggleTypewriterMode} />
        <ModeToggle label="Fade" active={fadeMode} onClick={toggleFadeMode} />
        <ModeToggle label="Focus" active={focusMode} onClick={toggleFocusMode} />
      </div>

      <button
        type="button"
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
