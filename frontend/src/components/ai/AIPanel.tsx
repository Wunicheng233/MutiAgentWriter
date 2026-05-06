import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLayoutStore, type RightPanelTab } from '../../store/useLayoutStore'
import { useSelectionStore } from '../../store/useSelectionStore'
import { AIChatPanel } from './AIChatPanel'
import { SelectionAIPanel } from '../editor/SelectionAIPanel'

const tabs: { id: RightPanelTab; label: string }[] = [
  { id: 'chat', label: 'AI 助手' },
  { id: 'selection', label: '选区操作' },
]

export const AIPanel: React.FC = () => {
  const { rightPanelTab, setRightPanelTab, setRightPanelOpen } = useLayoutStore(
    useShallow((state) => ({
      rightPanelTab: state.rightPanelTab,
      setRightPanelTab: state.setRightPanelTab,
      setRightPanelOpen: state.setRightPanelOpen,
    }))
  )
  const { setInitialRewriteMode } = useSelectionStore(
    useShallow((state) => ({
      setInitialRewriteMode: state.setInitialRewriteMode,
    }))
  )

  const handleTabChange = (tab: RightPanelTab) => {
    setRightPanelTab(tab)
    if (tab === 'chat') {
      setInitialRewriteMode(null)
    }
  }

  const handleClose = () => {
    setRightPanelOpen(false)
    setInitialRewriteMode(null)
  }

  return (
    <div className="h-full flex flex-col" data-testid="ai-panel">
      {/* Tab Header */}
      <div className="flex border-b border-[var(--border-default)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              rightPanelTab === tab.id
                ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent-primary)] bg-[var(--bg-tertiary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {rightPanelTab === 'chat' && <AIChatPanel />}
        {rightPanelTab === 'selection' && (
          <SelectionAIPanel
            isOpen={true}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  )
}

export default AIPanel
