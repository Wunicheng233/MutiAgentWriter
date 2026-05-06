import React, { useState, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLayoutStore } from '../../store/useLayoutStore'

interface Command {
  id: string
  label: string
  shortcut: string
  action: () => void
}

export const CommandPalette: React.FC = () => {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    toggleTypewriterMode,
    toggleFadeMode,
    toggleFocusMode,
    toggleVimMode,
    toggleRightPanel,
  } = useLayoutStore(
    useShallow((state) => ({
      commandPaletteOpen: state.commandPaletteOpen,
      setCommandPaletteOpen: state.setCommandPaletteOpen,
      toggleTypewriterMode: state.toggleTypewriterMode,
      toggleFadeMode: state.toggleFadeMode,
      toggleFocusMode: state.toggleFocusMode,
      toggleVimMode: state.toggleVimMode,
      toggleRightPanel: state.toggleRightPanel,
    }))
  )

  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands: Command[] = [
    { id: 'typewriter', label: '切换 Typewriter 模式', shortcut: '⌘⇧T', action: toggleTypewriterMode },
    { id: 'fade', label: '切换 Fade 模式', shortcut: '⌘⇧G', action: toggleFadeMode },
    { id: 'focus', label: '切换 Focus 模式', shortcut: '⌘⇧F', action: toggleFocusMode },
    { id: 'vim', label: '切换 Vim 模式', shortcut: '⌘⇧V', action: toggleVimMode },
    { id: 'ai-panel', label: '打开/关闭 AI 面板', shortcut: '⌘I', action: toggleRightPanel },
  ]

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase())
  )

  const executeCommand = (cmd: Command) => {
    cmd.action()
    setCommandPaletteOpen(false)
    setSearch('')
  }

  // Close on Escape and handle arrow keys
  useEffect(() => {
    if (!commandPaletteOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false)
        setSearch('')
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1))
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault()
        executeCommand(filteredCommands[selectedIndex])
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commandPaletteOpen, filteredCommands, selectedIndex, setCommandPaletteOpen])

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen && inputRef.current) {
      inputRef.current.focus()
      setSelectedIndex(0)
    }
  }, [commandPaletteOpen])

  // Close on outside click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setCommandPaletteOpen(false)
      setSearch('')
    }
  }

  if (!commandPaletteOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/50"
      onClick={handleBackdropClick}
      data-testid="command-palette-backdrop"
    >
      <div className="w-full max-w-lg bg-[var(--bg-primary)] rounded-lg shadow-2xl border border-[var(--border-default)] overflow-hidden">
        <div className="p-3 border-b border-[var(--border-default)]">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="搜索命令..."
            className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none text-lg"
            data-testid="command-palette-input"
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-[var(--text-muted)]">
              没有找到匹配的命令
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={() => executeCommand(cmd)}
                className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                }`}
                data-testid={`command-item-${cmd.id}`}
              >
                <span>{cmd.label}</span>
                <span className={`text-sm ${index === selectedIndex ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                  {cmd.shortcut}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t border-[var(--border-default)] text-xs text-[var(--text-muted)] flex gap-4">
          <span>↑↓ 选择</span>
          <span>↵ 执行</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
