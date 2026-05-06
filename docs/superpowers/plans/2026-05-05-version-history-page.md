# 历史版本页面实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将版本历史从编辑器 Inspector 面板迁移为独立的全局页面，通过左侧导航栏访问，提供版本列表、恢复和对比功能。

**Architecture:** 新增独立页面组件 ProjectVersions，新增版本卡片和对比模态框组件，在 NavRail 中添加导航项，最后清理 Editor 中的旧代码。使用现有的 API endpoints 和 textDiff 工具。

**Tech Stack:** React 19 + TypeScript, TanStack Query, Tailwind CSS, Vitest + React Testing Library

---

## 文件结构概览

| 操作 | 文件路径 | 职责 |
|------|---------|------|
| 修改 | `frontend/src/components/layout/NavRail.tsx:64-130,152-160` | 添加 HistoryIcon SVG 和导航项 |
| 创建 | `frontend/src/pages/ProjectVersions.tsx` | 历史版本主页面 |
| 创建 | `frontend/src/components/version/VersionCard.tsx` | 单个版本卡片 |
| 创建 | `frontend/src/components/version/VersionCompareModal.tsx` | 双栏对比模态框 |
| 创建 | `frontend/src/hooks/useVersions.ts` | 版本数据查询 Hook |
| 修改 | `frontend/src/pages/Editor.tsx:68-69,405-438,702-742` | 删除旧的版本历史代码 |
| 创建 | `frontend/src/pages/ProjectVersions.test.tsx` | 页面测试 |
| 创建 | `frontend/src/components/version/VersionCard.test.tsx` | 版本卡片测试 |

---

## Task 1: 添加导航图标和导航项

**Files:**
- Modify: `frontend/src/components/layout/NavRail.tsx:64-130,152-160`

- [ ] **Step 1: 添加 HistoryIcon SVG 组件**

在 NavRail.tsx 的图标定义区域（第 64-130 行之间，ExportIcon 后面）添加：

```tsx
const HistoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)
```

- [ ] **Step 2: 在 projectNavItems 中添加历史版本导航项**

在 projectNavItems 数组（第 152-160 行）的 'export' 项之前添加：

```tsx
{ id: 'versions', label: '历史版本', path: 'versions', icon: <HistoryIcon /> },
```

- [ ] **Step 3: 验证导航项显示正确**

Run: `cd frontend && npm run test:run -- --include "**/NavRail*"`
Expected: 所有现有测试通过

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/NavRail.tsx
git commit -m "feat: add version history navigation item"
```

---

## Task 2: 创建 useVersions Hook

**Files:**
- Create: `frontend/src/hooks/useVersions.ts`

- [ ] **Step 1: 创建 Hook 文件**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listChapterVersions,
  getChapterVersion,
  restoreChapterVersion,
  type ChapterVersionInfo,
} from '../utils/endpoints'
import { useToast } from '../components/toastContext'

export function useVersions(projectId: number, chapterIndex: number) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  // 查询版本列表
  const {
    data: versionsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['versions', projectId, chapterIndex],
    queryFn: () => listChapterVersions(projectId, chapterIndex),
    enabled: !!projectId && !!chapterIndex && projectId > 0 && chapterIndex > 0,
  })

  const versions = versionsData?.versions ?? []

  // 查询单个版本详情
  const getVersionDetail = (versionId: number) => {
    return getChapterVersion(projectId, chapterIndex, versionId)
  }

  // 恢复版本 mutation
  const restoreMutation = useMutation({
    mutationFn: (versionId: number) =>
      restoreChapterVersion(projectId, chapterIndex, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['chapter', projectId, chapterIndex],
      })
      queryClient.invalidateQueries({
        queryKey: ['versions', projectId, chapterIndex],
      })
      showToast('已恢复到所选版本', 'success')
    },
    onError: (error: Error) => {
      showToast(error.message || '恢复失败', 'error')
    },
  })

  return {
    versions,
    isLoading,
    error,
    refetch,
    getVersionDetail,
    restoreVersion: restoreMutation.mutate,
    isRestoring: restoreMutation.isPending,
  }
}
```

- [ ] **Step 2: 验证 TypeScript 类型检查通过**

Run: `cd frontend && npx tsc --noEmit --skipLibCheck`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useVersions.ts
git commit -m "feat: add useVersions hook for version data management"
```

---

## Task 3: 创建 VersionCard 组件

**Files:**
- Create: `frontend/src/components/version/VersionCard.tsx`
- Create: `frontend/src/components/version/VersionCard.test.tsx`

- [ ] **Step 1: 创建版本目录**

```bash
mkdir -p frontend/src/components/version
```

- [ ] **Step 2: 创建 VersionCard 组件**

```tsx
import React from 'react'
import { Button } from '../v2'
import type { ChapterVersionInfo } from '../../utils/endpoints'

interface VersionCardProps {
  version: ChapterVersionInfo
  isLatest: boolean
  onRestore: (versionId: number) => void
  onCompare: (versionId: number) => void
  isRestoring: boolean
}

export const VersionCard: React.FC<VersionCardProps> = ({
  version,
  isLatest,
  onRestore,
  onCompare,
  isRestoring,
}) => {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div
      className={`rounded-standard border p-4 transition-all duration-200 ${
        isLatest
          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
          : 'border-[var(--border-default)] bg-[var(--bg-secondary)]'
      }`}
      data-testid="version-card"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[var(--text-primary)]">
              V{version.version_number}
            </span>
            {isLatest && (
              <span className="text-xs text-[var(--accent-primary)] font-medium">
                · 当前版本
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">
            {formatDate(version.created_at)}
            {' · '}{version.word_count} 字
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => onCompare(version.id)}
          >
            对比
          </Button>
          {!isLatest && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRestore(version.id)}
              disabled={isRestoring}
            >
              {isRestoring ? '恢复中...' : '恢复此版本'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default VersionCard
```

- [ ] **Step 3: 创建测试文件 VersionCard.test.tsx**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import VersionCard from './VersionCard'

const mockVersion = {
  id: 1,
  version_number: 2,
  word_count: 2000,
  created_at: '2026-05-05T12:00:00Z',
}

describe('VersionCard', () => {
  it('renders version information correctly', () => {
    render(
      <VersionCard
        version={mockVersion}
        isLatest={false}
        onRestore={() => {}}
        onCompare={() => {}}
        isRestoring={false}
      />
    )

    expect(screen.getByText('V2')).toBeInTheDocument()
    expect(screen.getByText(/2000 字/)).toBeInTheDocument()
  })

  it('shows "当前版本" label for latest version', () => {
    render(
      <VersionCard
        version={mockVersion}
        isLatest={true}
        onRestore={() => {}}
        onCompare={() => {}}
        isRestoring={false}
      />
    )

    expect(screen.getByText('· 当前版本')).toBeInTheDocument()
  })

  it('hides restore button for latest version', () => {
    render(
      <VersionCard
        version={mockVersion}
        isLatest={true}
        onRestore={() => {}}
        onCompare={() => {}}
        isRestoring={false}
      />
    )

    expect(screen.queryByText('恢复此版本')).not.toBeInTheDocument()
    expect(screen.getByText('对比')).toBeInTheDocument()
  })

  it('calls onRestore when restore button is clicked', () => {
    const onRestore = vi.fn()
    render(
      <VersionCard
        version={mockVersion}
        isLatest={false}
        onRestore={onRestore}
        onCompare={() => {}}
        isRestoring={false}
      />
    )

    fireEvent.click(screen.getByText('恢复此版本'))
    expect(onRestore).toHaveBeenCalledWith(1)
  })

  it('calls onCompare when compare button is clicked', () => {
    const onCompare = vi.fn()
    render(
      <VersionCard
        version={mockVersion}
        isLatest={true}
        onRestore={() => {}}
        onCompare={onCompare}
        isRestoring={false}
      />
    )

    fireEvent.click(screen.getByText('对比'))
    expect(onCompare).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 4: 运行测试验证**

Run: `cd frontend && npm run test:run -- --include "**/VersionCard*"`
Expected: 所有测试通过

- [ ] **Step 5: 验证 TypeScript 类型检查通过**

Run: `cd frontend && npx tsc --noEmit --skipLibCheck`
Expected: 无类型错误

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/version/VersionCard.tsx
git add frontend/src/components/version/VersionCard.test.tsx
git commit -m "feat: add VersionCard component with tests"
```

---

## Task 4: 创建 VersionCompareModal 组件

**Files:**
- Create: `frontend/src/components/version/VersionCompareModal.tsx`

- [ ] **Step 1: 创建对比模态框组件**

```tsx
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

  // 初始化时将最新版本设为右侧版本
  useEffect(() => {
    if (isOpen && versions.length > 0 && !rightVersionId) {
      setRightVersionId(versions[0].id)
    }
  }, [isOpen, versions, rightVersionId])

  // 加载左侧版本内容
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

  // 加载右侧版本内容
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

  // 关闭时重置状态
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
      <div className="w-full max-w-6xl max-h-[90vh] bg-[var(--bg-primary)] rounded-standard border border-[var(--border-default)] shadow-lg flex flex-col overflow-hidden">
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
                className="p-4 bg-[var(--bg-tertiary)] rounded-standard text-sm leading-relaxed"
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
        <div className="flex justify-end gap-3 p-4 border-t border-[var(--border-default)]">
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
```

- [ ] **Step 2: 验证 TypeScript 类型检查通过**

Run: `cd frontend && npx tsc --noEmit --skipLibCheck`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/version/VersionCompareModal.tsx
git commit -m "feat: add VersionCompareModal component"
```

---

## Task 5: 创建 ProjectVersions 主页面

**Files:**
- Create: `frontend/src/pages/ProjectVersions.tsx`
- Modify: `frontend/src/App.tsx` (添加路由)

- [ ] **Step 1: 创建 ProjectVersions 页面组件**

```tsx
import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Card } from '../components/v2'
import VersionCard from '../components/version/VersionCard'
import VersionCompareModal from '../components/version/VersionCompareModal'
import { useVersions } from '../hooks/useVersions'
import { listChapters } from '../utils/endpoints'

export const ProjectVersions: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const projectId = id ? parseInt(id) : 0

  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(1)
  const [compareModalOpen, setCompareModalOpen] = useState(false)
  const [compareLeftVersionId, setCompareLeftVersionId] = useState<number | null>(null)

  // 查询章节列表
  const { data: chaptersData } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => listChapters(projectId),
    enabled: projectId > 0,
  })

  const chapters = chaptersData ?? []

  // 使用 versions hook
  const { versions, isLoading, error, getVersionDetail, restoreVersion, isRestoring } =
    useVersions(projectId, selectedChapterIndex)

  const handleCompare = (versionId: number) => {
    setCompareLeftVersionId(versionId)
    setCompareModalOpen(true)
  }

  const handleRestoreConfirm = (versionId: number) => {
    if (window.confirm('确定要恢复到此版本吗？当前内容将被覆盖。')) {
      restoreVersion(versionId)
    }
  }

  if (projectId <= 0) {
    return (
      <div className="p-8 text-center text-[var(--text-secondary)]">
        项目不存在
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-[var(--text-primary)] mb-2">
            历史版本
          </h1>
          <p className="text-[var(--text-secondary)]">
            查看和管理章节的历史版本
          </p>
        </div>

        {/* Chapter Selector */}
        <div className="mb-6">
          <label className="block text-sm text-[var(--text-secondary)] mb-2">
            选择章节
          </label>
          <select
            value={selectedChapterIndex}
            onChange={(e) => setSelectedChapterIndex(Number(e.target.value))}
            className="w-full max-w-md h-10 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            data-testid="chapter-selector"
          >
            {chapters.map(chapter => (
              <option key={chapter.chapter_index} value={chapter.chapter_index}>
                第 {chapter.chapter_index} 章 · {chapter.title || '未命名'}
              </option>
            ))}
          </select>
        </div>

        {/* Version List */}
        <Card className="p-6 border-[var(--border-default)]">
          {isLoading ? (
            <div className="text-center py-8 text-[var(--text-secondary)]" data-testid="loading-state">
              加载中...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-[var(--accent-error)]" data-testid="error-state">
              加载失败，请稍后重试
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-secondary)]" data-testid="empty-state">
              暂无历史版本
            </div>
          ) : (
            <div className="space-y-4" data-testid="version-list">
              {versions.map((version, index) => (
                <VersionCard
                  key={version.id}
                  version={version}
                  isLatest={index === 0}
                  onRestore={handleRestoreConfirm}
                  onCompare={handleCompare}
                  isRestoring={isRestoring}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Back to Editor Button */}
        <div className="mt-6">
          <Button
            variant="secondary"
            onClick={() => navigate(`/projects/${projectId}/editor/${selectedChapterIndex}`)}
          >
            返回编辑器
          </Button>
        </div>
      </div>

      {/* Compare Modal */}
      <VersionCompareModal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        versions={versions}
        initialLeftVersionId={compareLeftVersionId}
        getVersionDetail={getVersionDetail}
        onRestore={handleRestoreConfirm}
        isRestoring={isRestoring}
      />
    </div>
  )
}

export default ProjectVersions
```

- [ ] **Step 2: 在 App.tsx 中添加路由**

在 App.tsx 的路由部分（找到其他 `/projects/${projectId}/xxx` 路由的位置）添加：

```tsx
{projectId && (
  <Route
    path={`/projects/${projectId}/versions`}
    element={<ProjectVersions />}
  />
)}
```

同时确保在文件顶部添加 import：

```tsx
import ProjectVersions from './pages/ProjectVersions'
```

- [ ] **Step 3: 验证 TypeScript 类型检查通过**

Run: `cd frontend && npx tsc --noEmit --skipLibCheck`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProjectVersions.tsx
git add frontend/src/App.tsx
git commit -m "feat: add ProjectVersions page and route"
```

---

## Task 6: 创建 ProjectVersions 页面测试

**Files:**
- Create: `frontend/src/pages/ProjectVersions.test.tsx`

- [ ] **Step 1: 创建页面测试文件**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProjectVersions from './ProjectVersions'

// Mock endpoints
vi.mock('../utils/endpoints', () => ({
  listChapters: async () => [
    { chapter_index: 1, title: '第一章' },
    { chapter_index: 2, title: '第二章' },
  ],
  listChapterVersions: async () => ({
    versions: [
      { id: 2, version_number: 2, word_count: 2000, created_at: '2026-05-05T12:00:00Z' },
      { id: 1, version_number: 1, word_count: 1500, created_at: '2026-05-04T12:00:00Z' },
    ],
  }),
  getChapterVersion: async () => ({
    id: 1,
    version_number: 1,
    word_count: 1500,
    created_at: '2026-05-04T12:00:00Z',
    content: '测试内容',
  }),
  restoreChapterVersion: async () => ({
    chapter_index: 1,
    title: '第一章',
    content: '恢复的内容',
    word_count: 1500,
  }),
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  </BrowserRouter>
)

describe('ProjectVersions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page title correctly', () => {
    render(<ProjectVersions />, { wrapper })
    expect(screen.getByText('历史版本')).toBeInTheDocument()
  })

  it('renders chapter selector', async () => {
    render(<ProjectVersions />, { wrapper })
    const selector = await screen.findByTestId('chapter-selector')
    expect(selector).toBeInTheDocument()
  })

  it('renders back to editor button', () => {
    render(<ProjectVersions />, { wrapper })
    expect(screen.getByText('返回编辑器')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试验证**

Run: `cd frontend && npm run test:run -- --include "**/ProjectVersions*"`
Expected: 所有测试通过

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ProjectVersions.test.tsx
git commit -m "test: add ProjectVersions page tests"
```

---

## Task 7: 清理 Editor 页面旧的版本历史代码

**Files:**
- Modify: `frontend/src/pages/Editor.tsx`

- [ ] **Step 1: 删除旧的 state**

删除第 68-69 行：
```tsx
const [showVersionHistory, setShowVersionHistory] = useState(false)
const [versions, setVersions] = useState<ChapterVersionInfo[]>([])
```

同时删除第 21 行的 import：
```tsx
listChapterVersions,
restoreChapterVersion,
type ChapterVersionInfo,
```

- [ ] **Step 2: 删除旧的函数**

删除第 405-438 行（`loadVersions`、`handleRestore`、`toggleVersionHistory` 函数）

- [ ] **Step 3: 删除 Inspector 面板中的版本历史 UI**

删除第 702-742 行（Button 和 Card 部分）

- [ ] **Step 4: 运行现有测试确保没有破坏功能**

Run: `cd frontend && npm run test:run -- --include "**/Editor*"`
Expected: 所有现有测试通过

- [ ] **Step 5: 验证 TypeScript 类型检查通过**

Run: `cd frontend && npx tsc --noEmit --skipLibCheck`
Expected: 无类型错误

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Editor.tsx
git commit -m "refactor: remove old version history code from Editor"
```

---

## Task 8: 运行完整测试套件

- [ ] **Step 1: 运行所有前端测试**

Run: `cd frontend && npm run test:run`
Expected: 所有测试通过

- [ ] **Step 2: 运行后端测试**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest discover tests -v`
Expected: 所有测试通过

- [ ] **Step 3: 最终验证**

手动验证：
1. 打开项目后左侧导航栏显示「历史版本」图标
2. 点击图标跳转到版本页面
3. 选择章节后显示版本列表
4. 点击「对比」打开对比模态框
5. 点击「恢复此版本」有确认弹窗

- [ ] **Step 4: Commit 验证结果**

```bash
git commit --allow-empty -m "test: verify all tests pass"
```

---

## 自审清单

###  1. Spec 覆盖率
- [x] 导航栏新增图标和导航项 → Task 1
- [x] 独立历史版本页面 → Task 5
- [x] 章节选择下拉框 → Task 5
- [x] 当前版本视觉标记 → Task 3
- [x] 恢复版本功能 → Task 3, 5
- [x] 双栏对比模态框 → Task 4
- [x] 删除 Editor 旧代码 → Task 7
- [x] 空状态、加载状态、错误状态 → Task 5

###  2. 无 Placeholders
- [x] 所有步骤都有完整代码
- [x] 没有 "TBD" 或 "TODO"
- [x] 所有 API 调用都有实际代码

###  3. 类型一致性
- [x] `useVersions` Hook 返回类型与组件 Props 匹配
- [x] `ChapterVersionInfo` 类型在所有组件中一致使用
- [x] `restoreVersion` 函数签名一致

---

Plan complete and saved to `docs/superpowers/plans/2026-05-05-version-history-page.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
