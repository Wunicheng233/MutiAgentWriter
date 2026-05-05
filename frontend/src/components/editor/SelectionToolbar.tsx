import React, { useState } from 'react'
import { useSelectionStore } from '../../store/useSelectionStore'
import { RewriteMode } from '../../utils/selectionAI'
import { Button } from '../v2'
import { Popover, PopoverTrigger, PopoverContent } from '../v2/Popover/Popover'
import {
  PolishIcon,
  ExpandIcon,
  ShortenIcon,
  DramaticIcon,
  ForeshadowIcon,
  ContinuityIcon,
  CloseIcon,
  ChevronDownIcon,
} from './icons'

interface SelectionToolbarProps {
  onAction: (mode: RewriteMode) => void
}

const quickActions = [
  { mode: RewriteMode.POLISH, label: '润色', Icon: PolishIcon },
  { mode: RewriteMode.EXPAND, label: '扩写', Icon: ExpandIcon },
  { mode: RewriteMode.SHORTEN, label: '缩写', Icon: ShortenIcon },
]

const moreActions = [
  { mode: RewriteMode.MORE_DRAMATIC, label: '增强戏剧张力', Icon: DramaticIcon },
  { mode: RewriteMode.ADD_FORESHADOWING, label: '植入伏笔', Icon: ForeshadowIcon },
  { mode: RewriteMode.CHECK_CONTINUITY, label: '检查连续性', Icon: ContinuityIcon },
]

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({ onAction }) => {
  const { isToolbarVisible, toolbarPosition, hideToolbar } = useSelectionStore()
  const [showMore, setShowMore] = useState(false)

  // Reset dropdown state when toolbar is hidden
  React.useEffect(() => {
    if (!isToolbarVisible) {
      setShowMore(false)
    }
  }, [isToolbarVisible])

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
          <action.Icon className="w-4 h-4 mr-1" />
          {action.label}
        </Button>
      ))}

      <div className="w-px h-5 bg-[var(--border-default)] mx-1" />

      <Popover open={showMore} onOpenChange={setShowMore}>
        <PopoverTrigger>
          <Button variant="tertiary" size="sm">
            更多
            <ChevronDownIcon className="w-3 h-3 ml-1" />
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
                <action.Icon className="w-4 h-4" />
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
        <CloseIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

export default SelectionToolbar
