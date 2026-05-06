# 项目工作室信息架构重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构前端导航架构，实现上下文感知的三栏布局，让用户在项目内的导航体验更流畅。

**Architecture:** 分三个阶段实施：
- Phase 1: 骨架重构 - 改造 NavRail 和顶栏，建立上下文感知能力
- Phase 2: 路由重定向 - 调整路由结构，确保兼容性
- Phase 3: 页面拆分 - 将 ProjectOverview 拆分为 3 个独立页面

**Tech Stack:** React + TypeScript + React Router v6 + Zustand + Vitest

---

## 文件结构总览

```
frontend/src/
├── components/layout/
│   ├── NavRail.tsx          # 修改：支持上下文切换（全局/项目内）
│   ├── ProjectHeader.tsx    # 新建：项目顶栏组件
│   └── AppLayout.tsx        # 修改：整合新的导航逻辑
├── pages/
│   ├── ProjectOverview.tsx  # 拆分：保留概览内容
│   ├── ProjectOutline.tsx   # 新建：大纲设定页
│   └── ProjectExport.tsx    # 新建：导出分享页
├── store/
│   └── useProjectStore.ts   # 新建：项目上下文状态管理
└── App.tsx                  # 修改：更新路由结构
```

---

# Phase 1: 骨架重构

## Task 1.1: 扩展布局状态 Store（支持折叠）

**Files:**
- Modify: `frontend/src/store/useLayoutStore.ts`

- [ ] **Step 1: 扩展现有 useLayoutStore，添加顶栏折叠状态和用户偏好设置**

```typescript
// 在现有 store 基础上添加：
export interface LayoutState {
  // 现有字段...
  navCollapsed: boolean
  rightPanelOpen: boolean
  rightPanelWidth: number

  // 新增字段：
  headerCollapsed: boolean    // 顶栏是否收起
  autoExpandHeaderInProject: boolean  // 进入项目时自动展开顶栏
  defaultNavCollapsed: boolean        // 默认是否收起导航
  defaultAIPanelOpen: boolean         // 默认是否展开AI面板

  setHeaderCollapsed: (collapsed: boolean) => void
  toggleHeader: () => void
  setAutoExpandHeaderInProject: (value: boolean) => void
}
```

- [ ] **Step 2: 添加新的 action 方法**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/useLayoutStore.ts
git commit -m "feat: extend layout store to support collapsible panels"
```

---

## Task 1.2: 创建项目上下文 Store

**Files:**
- Create: `frontend/src/store/useProjectStore.ts`

- [ ] **Step 1: 创建 store 文件**

```typescript
import { create } from 'zustand'

export type ProjectStatus = 'draft' | 'generating' | 'waiting_confirm' | 'completed' | 'failed'

interface ProjectState {
  currentProjectId: string | null
  currentProjectName: string | null
  projectStatus: ProjectStatus
  progressPercent: number
  isInProject: boolean

  setCurrentProject: (id: string, name: string) => void
  clearCurrentProject: () => void
  setProjectStatus: (status: ProjectStatus, progress?: number) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProjectId: null,
  currentProjectName: null,
  projectStatus: 'draft',
  progressPercent: 0,
  isInProject: false,

  setCurrentProject: (id: string, name: string) => set({
    currentProjectId: id,
    currentProjectName: name,
    isInProject: true,
  }),

  clearCurrentProject: () => set({
    currentProjectId: null,
    currentProjectName: null,
    isInProject: false,
    projectStatus: 'draft',
    progressPercent: 0,
  }),

  setProjectStatus: (status: ProjectStatus, progress = 0) => set({
    projectStatus: status,
    progressPercent: progress,
  }),
}))
```

- [ ] **Step 2: 验证文件创建成功**

```bash
ls frontend/src/store/useProjectStore.ts
```
Expected: File exists

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/useProjectStore.ts
git commit -m "feat: add project context store"
```

---

## Task 1.2: 创建 ProjectHeader 顶栏组件

**Files:**
- Create: `frontend/src/components/layout/ProjectHeader.tsx`
- Test: `frontend/src/components/layout/ProjectHeader.test.tsx`

- [ ] **Step 1: 写测试用例**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectHeader } from './ProjectHeader'
import { useProjectStore } from '../../store/useProjectStore'

vi.mock('../../store/useProjectStore')

describe('ProjectHeader', () => {
  it('renders project name and status correctly', () => {
    vi.mocked(useProjectStore).mockReturnValue({
      currentProjectName: '星际迷航',
      projectStatus: 'generating',
      progressPercent: 57,
    })

    render(<ProjectHeader />)
    expect(screen.getByText('星际迷航')).toBeInTheDocument()
    expect(screen.getByText('生成中')).toBeInTheDocument()
  })

  it('shows back to shelf button', () => {
    vi.mocked(useProjectStore).mockReturnValue({
      currentProjectName: '测试项目',
      projectStatus: 'draft',
      progressPercent: 0,
    })

    render(<ProjectHeader />)
    expect(screen.getByText('书架')).toBeInTheDocument()
  })

  it('navigates back to shelf when back button is clicked', async () => {
    const mockNavigate = vi.fn()
    vi.mock('react-router-dom', async () => ({
      ...await vi.importActual('react-router-dom'),
      useNavigate: () => mockNavigate,
    }))

    vi.mocked(useProjectStore).mockReturnValue({
      currentProjectName: '测试项目',
      projectStatus: 'draft',
      progressPercent: 0,
      clearCurrentProject: vi.fn(),
    })

    render(<ProjectHeader />)
    await fireEvent.click(screen.getByText('书架'))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd frontend && npm run test:run -- --include ProjectHeader
```
Expected: FAIL with "Cannot find module './ProjectHeader'"

- [ ] **Step 3: 实现 ProjectHeader 组件**

```tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../store/useProjectStore'
import { Badge } from '../v2/Badge/Badge'

const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'error'; label: string }> = {
  draft: { variant: 'default', label: '草稿' },
  generating: { variant: 'warning', label: '生成中' },
  waiting_confirm: { variant: 'warning', label: '待确认' },
  completed: { variant: 'success', label: '已完成' },
  failed: { variant: 'error', label: '失败' },
}

export const ProjectHeader: React.FC = () => {
  const navigate = useNavigate()
  const { currentProjectName, projectStatus, progressPercent, clearCurrentProject } = useProjectStore()

  const handleBack = () => {
    clearCurrentProject()
    navigate('/dashboard')
  }

  const config = statusConfig[projectStatus]
  const showProgress = projectStatus === 'generating'

  return (
    <header className="h-16 flex items-center px-6 border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>书架</span>
      </button>

      <div className="flex-1 flex items-center gap-4 ml-6">
        <h1 className="text-lg font-medium text-[var(--text-primary)]">{currentProjectName}</h1>
        <Badge variant={config.variant}>
          <span className="flex items-center gap-2">
            {showProgress && (
              <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
            )}
            {config.label}
            {showProgress && <span>{progressPercent}%</span>}
          </span>
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd frontend && npm run test:run -- --include ProjectHeader
```
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/ProjectHeader.tsx frontend/src/components/layout/ProjectHeader.test.tsx
git commit -m "feat: add ProjectHeader component"
```

---

## Task 1.3: 改造 NavRail 支持上下文感知

**Files:**
- Modify: `frontend/src/components/layout/NavRail.tsx`
- Test: `frontend/src/components/layout/NavRail.test.tsx`

- [ ] **Step 1: 查看现有 NavRail 代码**

```bash
cat frontend/src/components/layout/NavRail.tsx
```

- [ ] **Step 2: 改造 NavRail，添加项目内导航项**

```tsx
// 在现有组件基础上修改
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useProjectStore } from '../../store/useProjectStore'

// 现有全局导航项
const globalNavItems = [
  { id: 'dashboard', label: '书架', icon: 'ProjectIcon', path: '/dashboard' },
  { id: 'settings', label: '设置', icon: 'SettingsIcon', path: '/settings' },
]

// 项目内导航项
const projectNavItems = [
  { id: 'overview', label: '概览', icon: 'OverviewIcon', path: 'overview' },
  { id: 'outline', label: '大纲', icon: 'OutlineIcon', path: 'outline' },
  { id: 'chapters', label: '章节', icon: 'ChaptersIcon', path: 'chapters' },
  { id: 'editor', label: '编辑器', icon: 'EditorIcon', path: 'editor/0' },
  { id: 'analytics', label: '质量中心', icon: 'AnalyticsIcon', path: 'analytics' },
  { id: 'export', label: '导出分享', icon: 'ExportIcon', path: 'export' },
]

// 在组件内：
export const NavRail: React.FC<NavRailProps> = ({ collapsed, onToggleCollapse }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isInProject, currentProjectId } = useProjectStore()

  // 根据上下文选择导航项
  const navItems = isInProject ? projectNavItems : globalNavItems

  const handleNavigate = (path: string) => {
    if (isInProject) {
      navigate(`/projects/${currentProjectId}/${path}`)
    } else {
      navigate(path)
    }
  }

  // 现有渲染逻辑...
}
```

- [ ] **Step 3: 补全所有项目内导航图标 SVG**

- [ ] **Step 4: 运行测试**

```bash
cd frontend && npm run test:run -- --include NavRail
```
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/NavRail.tsx
git commit -m "feat: NavRail support context-aware navigation"
```

---

## Task 1.4: 整合 AppLayout

**Files:**
- Modify: `frontend/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: 修改 AppLayout，根据上下文显示不同的顶栏**

```tsx
import { ProjectHeader } from './ProjectHeader'
import { useProjectStore } from '../../store/useProjectStore'

// 在 AppLayout 组件内：
export const AppLayout = () => {
  const { isInProject } = useProjectStore()

  return (
    <div className={`flex h-screen w-full overflow-hidden bg-[var(--bg-primary)] app-layout`}>
      {/* Left Navigation Rail */}
      <NavRail collapsed={navCollapsed} onToggleCollapse={toggleNavCollapsed} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Conditional Header - ProjectHeader when in project, global header otherwise */}
        {isInProject ? <ProjectHeader /> : <NavBar />}

        {/* Center Canvas Content */}
        <div className="flex-1 overflow-auto">
          <CanvasContainer>
            <Outlet />
          </CanvasContainer>
        </div>
      </div>

      {/* Right AI Panel */}
      {/* 保持现有逻辑不变 */}
    </div>
  )
}
```

- [ ] **Step 2: 运行测试确认没有回归**

```bash
cd frontend && npm run test:run
```
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/AppLayout.tsx
git commit -m "feat: integrate ProjectHeader into AppLayout"
```

---

## Task 1.5: 实现顶栏和导航栏折叠动画

**Files:**
- Modify: `frontend/src/components/layout/ProjectHeader.tsx` (add collapse animation)
- Modify: `frontend/src/components/layout/NavRail.tsx` (add collapse button)

- [ ] **Step 1: 为 ProjectHeader 添加收起状态的样式和动画**

```tsx
// 收起时：高度 4px，只有一条细线，鼠标悬停展开
// transition: height 200ms ease-out
```

- [ ] **Step 2: 为 NavRail 添加底部折叠按钮**

- [ ] **Step 3: 添加双击顶栏区域切换收起/展开**

- [ ] **Step 4: 运行测试**

```bash
cd frontend && npm run test:run
```
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/ProjectHeader.tsx frontend/src/components/layout/NavRail.tsx
git commit -m "feat: add collapse animation for header and nav rail"
```

---

## Task 1.6: 进入项目时自动展开顶栏

**Files:**
- Modify: `frontend/src/pages/ProjectOverview.tsx`

- [ ] **Step 1: 在项目进入逻辑中添加顶栏自动展开**

```tsx
// 在 useEffect 中：
const { autoExpandHeaderInProject, setHeaderCollapsed } = useLayoutStore()

useEffect(() => {
  if (autoExpandHeaderInProject) {
    setHeaderCollapsed(false)
  }
}, [id, autoExpandHeaderInProject, setHeaderCollapsed])
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/ProjectOverview.tsx
git commit -m "feat: auto expand header when entering project"
```

---

## Task 1.7: 在设置页面添加布局偏好选项

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: 在设置页面添加布局偏好部分**

```tsx
<div className="mb-6">
  <h3 className="text-lg font-medium mb-4 text-[var(--text-primary)]">布局偏好</h3>

  <div className="space-y-4">
    <label className="flex items-center gap-3">
      <Checkbox checked={autoExpandHeaderInProject} onChange={(e) => setAutoExpandHeaderInProject(e.target.checked)} />
      <span className="text-[var(--text-body)]">进入项目时自动展开顶栏</span>
    </label>

    {/* 其他布局选项 */}
  </div>
</div>
```

- [ ] **Step 2: 运行测试**

```bash
cd frontend && npm run test:run
```
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat: add layout preference settings"
```

---

## Task 1.8: 添加键盘快捷键

**Files:**
- Modify: `frontend/src/hooks/useKeyboardShortcuts.ts`

- [ ] **Step 1: 添加以下快捷键**

```
Ctrl+B / Cmd+B: 切换左侧导航栏
Ctrl+T / Cmd+T: 切换顶栏
Ctrl+I / Cmd+I: 切换 AI 助手面板
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useKeyboardShortcuts.ts
git commit -m "feat: add keyboard shortcuts for panel toggling"
```

---

# Phase 2: 路由结构调整

## Task 2.1: 更新路由结构

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 更新 App.tsx 中的项目路由**

```tsx
// 更新受保护的项目内路由
<Route element={<ProtectedLayout />}>
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/projects/new" element={<CreateProject />} />

  {/* 项目工作室统一路由前缀 */}
  <Route path="/projects/:id">
    <Route index element={<Navigate to="overview" replace />} />
    <Route path="overview" element={<ProjectOverview />} />
    <Route path="outline" element={<ProjectOutline />} />
    <Route path="chapters" element={<ChapterList />} />
    <Route path="editor/:chapterIndex" element={<Editor />} />
    <Route path="analytics" element={<QualityDashboard />} />
    <Route path="export" element={<ProjectExport />} />
    <Route path="workflows/:runId" element={<WorkflowRunDetail />} />
    <Route path="artifacts/:artifactId" element={<ArtifactDetail />} />
  </Route>

  <Route path="/settings" element={<Settings />} />
</Route>
```

- [ ] **Step 2: 添加旧路由重定向**

```tsx
// 在 Routes 内添加重定向
<Route path="/projects/:id/write/:chapterIndex" element={<Navigate to="/projects/:id/editor/:chapterIndex" replace />} />
```

- [ ] **Step 3: 运行 TypeScript 检查**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: update router structure for project studio"
```

---

## Task 2.2: 在项目页面初始化 ProjectStore

**Files:**
- Modify: `frontend/src/pages/ProjectOverview.tsx`
- Modify: `frontend/src/pages/ChapterList.tsx`
- Modify: `frontend/src/pages/Editor.tsx`
- Modify: `frontend/src/pages/QualityDashboard.tsx`

- [ ] **Step 1: 在每个项目内页面的 useEffect 中初始化 ProjectStore**

```tsx
import { useProjectStore } from '../store/useProjectStore'
import { useParams } from 'react-router-dom'

// 在组件内：
const { id } = useParams<{ id: string }>()
const { setCurrentProject } = useProjectStore()

useEffect(() => {
  // 从 API 获取项目名称和状态，然后设置
  if (id && projectData) {
    setCurrentProject(id, projectData.name)
    // 同时设置状态和进度
  }
}, [id, projectData, setCurrentProject])
```

- [ ] **Step 2: 对每个项目内页面重复此修改**

- [ ] **Step 3: 运行测试**

```bash
cd frontend && npm run test:run
```
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProjectOverview.tsx frontend/src/pages/ChapterList.tsx frontend/src/pages/Editor.tsx frontend/src/pages/QualityDashboard.tsx
git commit -m "feat: initialize ProjectStore on project pages"
```

---

# Phase 3: ProjectOverview 页面拆分

## Task 3.1: 创建 ProjectOutline 大纲页

**Files:**
- Create: `frontend/src/pages/ProjectOutline.tsx`
- Move code from: `frontend/src/pages/ProjectOverview.tsx:300-600`

- [ ] **Step 1: 创建 ProjectOutline.tsx，从 ProjectOverview 迁移大纲相关代码**

- [ ] **Step 2: 确保所有依赖项都正确导入**

- [ ] **Step 3: 运行 TypeScript 检查**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProjectOutline.tsx
git commit -m "feat: create ProjectOutline page from ProjectOverview"
```

---

## Task 3.2: 创建 ProjectExport 导出分享页

**Files:**
- Create: `frontend/src/pages/ProjectExport.tsx`
- Move code from: `frontend/src/pages/ProjectOverview.tsx:600-900`

- [ ] **Step 1: 创建 ProjectExport.tsx，从 ProjectOverview 迁移导出和分享相关代码**

- [ ] **Step 2: 确保所有依赖项都正确导入**

- [ ] **Step 3: 运行 TypeScript 检查**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProjectExport.tsx
git commit -m "feat: create ProjectExport page from ProjectOverview"
```

---

## Task 3.3: 清理 ProjectOverview.tsx

**Files:**
- Modify: `frontend/src/pages/ProjectOverview.tsx`

- [ ] **Step 1: 删除已迁移到 ProjectOutline 和 ProjectExport 的代码**

- [ ] **Step 2: 确保文件大小 < 400 行**

- [ ] **Step 3: 运行测试和 TypeScript 检查**

```bash
cd frontend && npm run test:run && npx tsc --noEmit
```
Expected: All tests PASS, no type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProjectOverview.tsx
git commit -m "refactor: clean up ProjectOverview after page split"
```

---

# 最终验收

## Task 4: 完整功能验证

- [ ] **Step 1: 启动开发服务器并手动测试完整流程**

```bash
cd frontend && npm run dev
```

验证：
- 书架 → 进入项目 → NavRail 变成项目内导航
- 顶栏显示项目名称和状态
- 点击"书架"返回书架页
- 切换各个项目内页面正常
- 所有现有功能正常工作

- [ ] **Step 2: 运行完整测试套件**

```bash
cd frontend && npm run test:run
```
Expected: All tests PASS

- [ ] **Step 3: TypeScript 类型检查**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No type errors

---

# Phase 4: 沉浸感增强（可选，建议上线后迭代）

## Task 4.1: 顶栏进度条效果

**Files:**
- Modify: `frontend/src/components/layout/ProjectHeader.tsx`

- [ ] **Step 1: 实现收起状态下顶栏细线本身就是进度条**
- [ ] **Step 2: 颜色随进度从红 → 黄 → 绿渐变**
- [ ] **Step 3: 生成完成时闪烁效果**

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/layout/ProjectHeader.tsx
git commit -m "feat: header line as progress bar"
```

---

## Task 4.2: 智能专注模式（打字自动隐退 UI）

**Files:**
- Create: `frontend/src/hooks/useFocusMode.ts`
- Modify: `frontend/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: 创建 useFocusMode hook**
  - 监听键盘输入事件
  - 打字 3 秒后自动收起所有面板
  - 鼠标移动到屏幕边缘时自动弹出

- [ ] **Step 2: 集成到 AppLayout**

- [ ] **Step 3: 在设置中添加开关**

- [ ] **Step 4: Commit**
```bash
git add frontend/src/hooks/useFocusMode.ts frontend/src/components/layout/AppLayout.tsx frontend/src/pages/Settings.tsx
git commit -m "feat: intelligent focus mode - UI auto-hides when typing"
```

---

## Task 4.3: 项目进入过渡动画

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: 点击项目卡片时的放大过渡效果**
- [ ] **Step 2: 项目标题平滑移动到顶栏位置**
- [ ] **Step 3: 内容区渐入**

- [ ] **Step 4: Commit**
```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/components/layout/AppLayout.tsx
git commit -m "feat: seamless project entry animation"
```

---

## Task 4.4: 导航微交互

**Files:**
- Modify: `frontend/src/components/layout/NavRail.tsx`

- [ ] **Step 1: 选中项呼吸动效（2秒周期亮度变化）**
- [ ] **Step 2: 悬停时图标 2px 右移回弹**

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/layout/NavRail.tsx
git commit -m "feat: add nav micro-interactions"
```

---

**计划完整！**

> 注：Phase 4 为增强体验，可在核心功能上线后迭代实施，不影响 Phase 1-3 的完整可用性。
