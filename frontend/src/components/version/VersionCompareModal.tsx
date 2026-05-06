import React, { useState, useEffect } from 'react'
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
  const [leftVersionId, setLeftVersionId] = useState<number | null>(initialLeftVersionId)
  const [rightVersionId, setRightVersionId] = useState<number | null>(null)
  const [leftContent, setLeftContent] = useState<string>('')
  const [rightContent, setRightContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Initialize right version to latest when opening
  useEffect(() => {
    if (isOpen && versions.length > 0) {
      setRightVersionId(versions[0].id)
    }
  }, [isOpen, versions])

  // Reset state when opening with a new initialLeftVersionId
  useEffect(() => {
    if (isOpen) {
      setLeftVersionId(initialLeftVersionId)
    }
  }, [isOpen, initialLeftVersionId])

  // Load both versions with Promise.all to avoid loading race conditions
  useEffect(() => {
    if (!leftVersionId && !rightVersionId) {
      setLeftContent('')
      setRightContent('')
      return
    }

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
        setLeftContent(leftDetail?.content ?? '')
        setRightContent(rightDetail?.content ?? '')
      } catch (error) {
        console.error('Failed to load version:', error)
      } finally {
        setLoading(false)
      }
    }

    loadVersions()
  }, [leftVersionId, rightVersionId, getVersionDetail])

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
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-[var(--text-secondary)]">加载中...</div>
          ) : leftContent && rightContent ? (
            <div
              className="p-4 bg-[var(--bg-tertiary)] rounded-lg text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderDiffHtml(leftContent, rightContent) }}
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
