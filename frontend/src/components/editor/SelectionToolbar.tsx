import React, { useState } from 'react'
import { useSelectionStore } from '../../store/useSelectionStore'
import { RewriteMode } from '../../utils/selectionAI'
import { Button } from '../v2'
import { Popover, PopoverTrigger, PopoverContent } from '../v2/Popover/Popover'

interface SelectionToolbarProps {
  onAction: (mode: RewriteMode) => void
}

const quickActions = [
  { mode: RewriteMode.POLISH, label: '润色', icon: '✨' },
  { mode: RewriteMode.EXPAND, label: '扩写', icon: '🔄' },
  { mode: RewriteMode.SHORTEN, label: '缩写', icon: '✂️' },
]

const moreActions = [
  { mode: RewriteMode.MORE_DRAMATIC, label: '增强戏剧张力', icon: '😱' },
  { mode: RewriteMode.ADD_FORESHADOWING, label: '植入伏笔', icon: '📍' },
  { mode: RewriteMode.CHECK_CONTINUITY, label: '检查连续性', icon: '🧐' },
]

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({ onAction }) => {
  const { isToolbarVisible, toolbarPosition, hideToolbar } = useSelectionStore()
  const [showMore, setShowMore] = useState(false)

  if (!isToolbarVisible || !toolbarPosition) {
    return null
  }

  return (
    <div
      data-selection-toolbar
      className="fixed z-50 flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-lg px-2 py-1.5"
      style={{
        top: toolbarPosition.top - 50,
        left: toolbarPosition.left,
      }}
    >
      {quickActions.map(action => (
        <Button
          key={action.mode}
          variant="tertiary"
          size="sm"
          onClick={() => onAction(action.mode)}
          className="text-sm"
        >
          <span className="mr-1">{action.icon}</span>
          {action.label}
        </Button>
      ))}

      <div className="w-px h-5 bg-[var(--border-default)] mx-1" />

      <Popover open={showMore} onOpenChange={setShowMore}>
        <PopoverTrigger>
          <Button variant="tertiary" size="sm">
            更多 ⌄
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="bottom">
          <div className="flex flex-col gap-1 p-2 min-w-[160px]">
            {moreActions.map(action => (
              <button
                key={action.mode}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors text-left"
                onClick={() => {
                  onAction(action.mode)
                  setShowMore(false)
                }}
              >
                <span>{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <button
        className="ml-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
        onClick={hideToolbar}
      >
        ✕
      </button>
    </div>
  )
}

export default SelectionToolbar
