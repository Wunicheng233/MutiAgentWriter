import React, { useState, useEffect } from 'react'
import { Button } from '../v2'
import { renderDiffHtml } from '../../utils/textDiff'
import type { ChapterVersionInfo, ChapterVersionDetail } from '../../utils/endpoints'

interface VersionCompareModalProps {
  isOpen: boolean
  onClose: () => void
  versions: ChapterVersionInfo[]
  initialLeftVersionId: number | null
  getVersionDetail: (versionId: number) => Promise<ChapterVersionDetail>
  onRestore: (versionId: number) => void
  isRestoring: boolean
}

export const VersionCompareModal: React.FC<VersionCompareModalProps> = ({
  isOpen,
  onClose,
  versions,
  initialLeftVersionId,
  getVersionDetail,
  onRestore,
  isRestoring,
}) => {
  const [leftVersionId, setLeftVersionId] = useState<number | null>(initialLeftVersionId)
  const [rightVersionId, setRightVersionId] = useState<number | null>(null)
  const [leftContent, setLeftContent] = useState<string>('')
  const [rightContent, setRightContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Initialize right version to latest when opening
  useEffect(() => {
    if (isOpen && versions.length > 0 && !rightVersionId) {
      setRightVersionId(versions[0].id)
    }
  }, [isOpen, versions, rightVersionId])

  // Load left version content
  useEffect(() => {
    if (!leftVersionId) {
      setLeftContent('')
      return
    }

    const load = async () => {
      setLoading(true)
      try {
        const detail = await getVersionDetail(leftVersionId)
        setLeftContent(detail.content)
      } catch (error) {
        console.error('Failed to load version:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [leftVersionId, getVersionDetail])

  // Load right version content
  useEffect(() => {
    if (!rightVersionId) {
      setRightContent('')
      return
    }

    const load = async () => {
      setLoading(true)
      try {
        const detail = await getVersionDetail(rightVersionId)
        setRightContent(detail.content)
      } catch (error) {
        console.error('Failed to load version:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [rightVersionId, getVersionDetail])

  // Reset state when closing
  const handleClose = () => {
    setLeftVersionId(null)
    setRightVersionId(null)
    setLeftContent('')
    setRightContent('')
    onClose()
  }

  if (!isOpen) return null

  const leftVersion = versions.find(v => v.id === leftVersionId)
  const rightVersion = versions.find(v => v.id === rightVersionId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="version-compare-modal">
      <div className="w-full max-w-6xl max-h-[90vh] bg-[var(--bg-primary)] rounded-lg border border-[var(--border-default)] shadow-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">版本对比</h2>
          <button
            onClick={handleClose}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
            aria-label="关闭"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18"/>
              <path d="M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Version Selectors */}
        <div className="grid grid-cols-2 gap-4 p-4 border-b border-[var(--border-default)]">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">旧版本</label>
            <select
              value={leftVersionId ?? ''}
              onChange={(e) => setLeftVersionId(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-10 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="">请选择版本</option>
              {versions.map(v => (
                <option key={v.id} value={v.id}>
                  V{v.version_number} · {new Date(v.created_at).toLocaleDateString('zh-CN')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">新版本</label>
            <select
              value={rightVersionId ?? ''}
              onChange={(e) => setRightVersionId(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-10 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="">请选择版本</option>
              {versions.map(v => (
                <option key={v.id} value={v.id}>
                  V{v.version_number} · {new Date(v.created_at).toLocaleDateString('zh-CN')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {loading ? (
            <div className="text-center py-8 text-[var(--text-secondary)]">加载中...</div>
          ) : leftContent && rightContent ? (
            <div>
              <div
                className="p-4 bg-[var(--bg-tertiary)] rounded-lg text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderDiffHtml(leftContent, rightContent) }}
              />
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              请选择左右两个版本进行对比
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 p-4 border-b border-[var(--border-default)]">
          {leftVersion && (
            <Button
              variant="secondary"
              onClick={() => {
                onRestore(leftVersion.id)
                handleClose()
              }}
              disabled={isRestoring}
            >
              恢复到 V{leftVersion.version_number}
            </Button>
          )}
          <Button variant="primary" onClick={handleClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  )
}

export default VersionCompareModal
