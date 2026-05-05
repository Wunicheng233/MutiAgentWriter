import React, { useState } from 'react'
import { useSelectionStore } from '../../store/useSelectionStore'
import { RewriteMode, buildRewritePrompt } from '../../utils/selectionAI'
import { renderDiffHtml } from '../../utils/textDiff'
import { aiChat } from '../../utils/endpoints'
import { Button } from '../v2'

interface SelectionAIPanelProps {
  isOpen: boolean
  onApply: (newText: string) => void
  onClose: () => void
  characters?: Array<{ name: string; personality?: string }>
}

const actionButtons = [
  { mode: RewriteMode.POLISH, label: '润色', icon: '✨' },
  { mode: RewriteMode.EXPAND, label: '扩写', icon: '🔄' },
  { mode: RewriteMode.SHORTEN, label: '缩写', icon: '✂️' },
  { mode: RewriteMode.MORE_DRAMATIC, label: '增强张力', icon: '😱' },
  { mode: RewriteMode.ADD_FORESHADOWING, label: '植入伏笔', icon: '📍' },
]

export const SelectionAIPanel: React.FC<SelectionAIPanelProps> = ({
  isOpen,
  onApply,
  onClose,
  characters = [],
}) => {
  const { selectedText } = useSelectionStore()
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [currentMode, setCurrentMode] = useState<RewriteMode | null>(null)

  const handleAction = async (mode: RewriteMode) => {
    if (!selectedText) return

    setIsLoading(true)
    setCurrentMode(mode)
    setResult(null)

    try {
      const prompt = buildRewritePrompt({
        selectedText,
        mode,
        characters,
      })

      const response = await aiChat({
        user_input: prompt,
      })

      setResult(response.content)
    } catch (error) {
      console.error('AI rewrite failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = () => {
    if (result) {
      onApply(result)
      setResult(null)
    }
  }

  const handleCancel = () => {
    setResult(null)
  }

  if (!isOpen) return null

  return (
    <div
      data-selection-panel
      className="h-full flex flex-col border-l border-[var(--border-default)] bg-[var(--bg-primary)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
        <h3 className="font-medium text-[var(--text-primary)]">✏️ 选区智能操作</h3>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          ✕
        </button>
      </div>

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
            <span className="mr-1">{action.icon}</span>
            {action.label}
          </Button>
        ))}
      </div>

      {/* Character voice section */}
      {characters.length > 0 && (
        <div className="px-4 py-3 border-t border-[var(--border-default)]">
          <p className="text-xs text-[var(--text-muted)] mb-2">🎭 角色语气改写：</p>
          <div className="flex flex-wrap gap-2">
            {characters.map(char => (
              <Button
                key={char.name}
                variant="tertiary"
                size="sm"
                onClick={() => handleAction(RewriteMode.CHARACTER_VOICE)}
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
            <div className="animate-spin text-2xl mb-2">⏳</div>
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
            选择一个操作开始
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
