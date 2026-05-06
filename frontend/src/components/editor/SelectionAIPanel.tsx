import React, { useState, useCallback, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSelectionStore } from '../../store/useSelectionStore'
import { RewriteMode, buildRewritePrompt } from '../../utils/selectionAI'
import { renderDiffHtml } from '../../utils/textDiff'
import { aiChat } from '../../utils/endpoints'
import { Button } from '../v2'
import {
  PolishIcon,
  ExpandIcon,
  ShortenIcon,
  DramaticIcon,
  SpinnerIcon,
  CharacterIcon,
} from './icons'

interface SelectionAIPanelProps {
  isOpen: boolean
  onApply?: (newText: string) => void
  onClose?: () => void
  initialMode?: RewriteMode | null
  characters?: Array<{ name: string; personality?: string }>
}

const actionButtons = [
  { mode: RewriteMode.POLISH, label: '润色', Icon: PolishIcon },
  { mode: RewriteMode.EXPAND, label: '扩写', Icon: ExpandIcon },
  { mode: RewriteMode.SHORTEN, label: '缩写', Icon: ShortenIcon },
  { mode: RewriteMode.MORE_DRAMATIC, label: '增强张力', Icon: DramaticIcon },
]

export const SelectionAIPanel: React.FC<SelectionAIPanelProps> = ({
  isOpen,
  onApply,
  initialMode: externalInitialMode,
  characters = [],
}) => {
  const { selectedText, initialRewriteMode: storeInitialMode, setInitialRewriteMode, setPendingRewriteResult } = useSelectionStore(
    useShallow((state) => ({
      selectedText: state.selectedText,
      initialRewriteMode: state.initialRewriteMode,
      setInitialRewriteMode: state.setInitialRewriteMode,
      setPendingRewriteResult: state.setPendingRewriteResult,
    }))
  )
  const [isLoading, setIsLoading] = useState(false)
  const [rewriteResult, setRewriteResult] = useState<{ sourceText: string; content: string } | null>(null)
  const lastAutoRunKeyRef = useRef<string | null>(null)

  const initialMode = externalInitialMode ?? storeInitialMode
  const result = rewriteResult?.sourceText === selectedText ? rewriteResult.content : null

  const handleAction = useCallback(async (mode: RewriteMode, characterName?: string) => {
    if (!selectedText) return

    setIsLoading(true)
    setRewriteResult(null)

    try {
      const prompt = buildRewritePrompt({
        selectedText,
        mode,
        characters,
        characterName,
      })

      const response = await aiChat({
        user_input: prompt,
      })

      setRewriteResult({
        sourceText: selectedText,
        content: response.content,
      })
    } catch (error) {
      console.error('AI rewrite failed:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedText, characters])

  // Auto-trigger action when initialMode is set (called from toolbar)
  React.useEffect(() => {
    if (!initialMode || !isOpen || !selectedText || isLoading || result) return

    const autoRunKey = `${initialMode}:${selectedText}`
    if (lastAutoRunKeyRef.current === autoRunKey) return
    lastAutoRunKeyRef.current = autoRunKey

    if (!externalInitialMode) {
      setInitialRewriteMode(null)
    }

    void handleAction(initialMode)
  }, [
    externalInitialMode,
    handleAction,
    initialMode,
    isLoading,
    isOpen,
    result,
    selectedText,
    setInitialRewriteMode,
  ])

  const handleApply = () => {
    if (result) {
      if (onApply) {
        onApply(result)
      } else {
        // Use store for global communication when no callback provided
        setPendingRewriteResult(result)
      }
      setRewriteResult(null)
      setInitialRewriteMode(null)
    }
  }

  const handleCancel = () => {
    setRewriteResult(null)
    setInitialRewriteMode(null)
  }

  if (!isOpen) return null

  return (
    <div
      data-selection-panel
      className="h-full flex flex-col bg-[var(--bg-primary)]"
    >
      {/* Selected text preview */}
      <div className="px-4 py-3 border-b border-[var(--border-default)]">
        <p className="text-xs text-[var(--text-muted)] mb-1">选中的文本：</p>
        <p className="text-sm text-[var(--text-secondary)] line-clamp-3 bg-[var(--bg-tertiary)] p-2 rounded">
          {selectedText || '(未选中文本)'}
        </p>
      </div>

      {/* Action buttons */}
      <div className="p-4 grid grid-cols-2 gap-2">
        {actionButtons.map(action => (
          <Button
            key={action.mode}
            variant="secondary"
            size="sm"
            onClick={() => handleAction(action.mode)}
            disabled={isLoading || !selectedText}
          >
            <action.Icon className="w-4 h-4 mr-1" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Character voice section */}
      {characters.length > 0 && (
        <div className="px-4 py-3 border-t border-[var(--border-default)]">
          <p className="text-xs text-[var(--text-muted)] mb-2 flex items-center gap-1">
            <CharacterIcon className="w-3 h-3" />
            角色语气改写：
          </p>
          <div className="flex flex-wrap gap-2">
            {characters.map(char => (
              <Button
                key={char.name}
                variant="tertiary"
                size="sm"
                onClick={() => handleAction(RewriteMode.CHARACTER_VOICE, char.name)}
                disabled={isLoading || !selectedText}
              >
                {char.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Result area */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center py-8">
            <SpinnerIcon className="w-8 h-8 mx-auto mb-3 text-[var(--accent-primary)]" />
            <p className="text-sm text-[var(--text-secondary)]">AI 正在改写中...</p>
          </div>
        ) : result ? (
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-2">改写结果对比：</p>
            <div
              className="p-3 bg-[var(--bg-tertiary)] rounded text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderDiffHtml(selectedText, result) }}
            />
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-[var(--text-muted)]">
            {selectedText ? '选择一个操作开始' : '请在编辑器中选中一段文本'}
          </div>
        )}
      </div>

      {/* Action footer */}
      {result && (
        <div className="p-4 border-t border-[var(--border-default)] flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleCancel} className="flex-1">
            放弃
          </Button>
          <Button variant="primary" size="sm" onClick={handleApply} className="flex-1">
            应用
          </Button>
        </div>
      )}
    </div>
  )
}

export default SelectionAIPanel
