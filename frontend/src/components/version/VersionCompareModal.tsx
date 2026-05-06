import React, { useState, useEffect, useMemo } from 'react'
import { Modal, ModalHeader, ModalContent, ModalFooter, Button } from '../v2'
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
  const [leftVersionOverride, setLeftVersionOverride] = useState<number | null | undefined>(undefined)
  const [rightVersionOverride, setRightVersionOverride] = useState<number | null | undefined>(undefined)
  const [leftContent, setLeftContent] = useState<string>('')
  const [rightContent, setRightContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const defaultRightVersionId = useMemo(
    () => (isOpen && versions.length > 0 ? versions[0].id : null),
    [isOpen, versions]
  )
  const leftVersionId = leftVersionOverride === undefined ? initialLeftVersionId : leftVersionOverride
  const rightVersionId = rightVersionOverride === undefined ? defaultRightVersionId : rightVersionOverride

  // Load both versions with Promise.all to avoid loading race conditions
  useEffect(() => {
    if (!isOpen || (!leftVersionId && !rightVersionId)) return
    let cancelled = false

    const loadVersions = async () => {
      setLoading(true)
      try {
        const promises: Promise<ChapterVersionDetail | null>[] = []

        if (leftVersionId) {
          promises.push(getVersionDetail(leftVersionId))
        } else {
          promises.push(Promise.resolve(null))
        }

        if (rightVersionId) {
          promises.push(getVersionDetail(rightVersionId))
        } else {
          promises.push(Promise.resolve(null))
        }

        const [leftDetail, rightDetail] = await Promise.all(promises)
        if (!cancelled) {
          setLeftContent(leftDetail?.content ?? '')
          setRightContent(rightDetail?.content ?? '')
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load version:', error)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadVersions()
    return () => {
      cancelled = true
    }
  }, [isOpen, leftVersionId, rightVersionId, getVersionDetail])

  // Reset state when closing
  const handleClose = () => {
    setLeftVersionOverride(undefined)
    setRightVersionOverride(undefined)
    setLeftContent('')
    setRightContent('')
    onClose()
  }

  if (!isOpen) return null

  const leftVersion = versions.find(v => v.id === leftVersionId)
  const displayLeftContent = leftVersionId ? leftContent : ''
  const displayRightContent = rightVersionId ? rightContent : ''

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="xl"
      data-testid="version-compare-modal"
    >
      <ModalHeader>版本对比</ModalHeader>

      <ModalContent>
        {/* Version Selectors */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">旧版本</label>
            <select
              value={leftVersionId ?? ''}
              onChange={(e) => setLeftVersionOverride(e.target.value ? Number(e.target.value) : null)}
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
              onChange={(e) => setRightVersionOverride(e.target.value ? Number(e.target.value) : null)}
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
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-[var(--text-secondary)]">加载中...</div>
          ) : displayLeftContent && displayRightContent ? (
            <div
              className="p-4 bg-[var(--bg-tertiary)] rounded-lg text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderDiffHtml(displayLeftContent, displayRightContent) }}
            />
          ) : (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              请选择左右两个版本进行对比
            </div>
          )}
        </div>
      </ModalContent>

      <ModalFooter>
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
      </ModalFooter>
    </Modal>
  )
}

export default VersionCompareModal
