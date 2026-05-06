import React, { useState, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSelectionStore } from '../../store/useSelectionStore'
import { useLayoutStore } from '../../store/useLayoutStore'
import { RewriteMode } from '../../utils/selectionAI'
import { Button } from '../v2'
import { Popover, PopoverTrigger, PopoverContent } from '../v2/Popover/Popover'
import {
  PolishIcon,
  ExpandIcon,
  ShortenIcon,
  DramaticIcon,
  CloseIcon,
  ChevronDownIcon,
} from './icons'

const quickActions = [
  { mode: RewriteMode.POLISH, label: '润色', Icon: PolishIcon },
  { mode: RewriteMode.EXPAND, label: '扩写', Icon: ExpandIcon },
  { mode: RewriteMode.SHORTEN, label: '缩写', Icon: ShortenIcon },
]

const moreActions = [
  { mode: RewriteMode.MORE_DRAMATIC, label: '增强戏剧张力', Icon: DramaticIcon },
]

export const SelectionToolbar: React.FC = () => {
  const { isToolbarVisible, toolbarPosition, hideToolbar, setInitialRewriteMode } = useSelectionStore(
    useShallow((state) => ({
      isToolbarVisible: state.isToolbarVisible,
      toolbarPosition: state.toolbarPosition,
      hideToolbar: state.hideToolbar,
      setInitialRewriteMode: state.setInitialRewriteMode,
    }))
  )
  const { setRightPanelOpen, setRightPanelTab } = useLayoutStore()
  const [showMore, setShowMore] = useState(false)

  const handleAction = (mode: RewriteMode) => {
    setInitialRewriteMode(mode)
    setRightPanelTab('selection')
    setRightPanelOpen(true)
    hideToolbar()
  }

  // Reset dropdown state when toolbar is hidden (using useRef to avoid cascading renders
  const prevToolbarVisibleRef = useRef(isToolbarVisible)

  React.useEffect(() => {
    if (prevToolbarVisibleRef.current && !isToolbarVisible) {
      setShowMore(false)
    }
    prevToolbarVisibleRef.current = isToolbarVisible
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
          onClick={() => handleAction(action.mode)}
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
        <PopoverContent align="start" side="bottom" className="p-2">
          <div className="flex flex-col gap-1 w-[150px] text-left">
            {moreActions.map(action => (
              <Button
                key={action.mode}
                variant="tertiary"
                size="sm"
                fullWidth
                className="!justify-start !text-left"
                onClick={() => {
                  handleAction(action.mode)
                  setShowMore(false)
                }}
                leftIcon={<action.Icon className="w-4 h-4 flex-shrink-0" />}
              >
                <span className="text-left">{action.label}</span>
              </Button>
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
