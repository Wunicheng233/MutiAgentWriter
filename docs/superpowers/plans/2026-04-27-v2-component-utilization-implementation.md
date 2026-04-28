# v2 组件库充分利用实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 充分利用现有 v2 组件库，消除重复 UI 模式代码，提升用户体验，不改变业务逻辑

**Architecture:** 渐进式重构 - 按组件优先级分批实施，每个任务独立可测试，不破坏现有功能。P0 任务为基础组件替换，P1 为新模式抽象，P2 为数据展示增强。

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, React Testing Library

---

## 文件变更摘要

| 操作 | 文件 |
|------|------|
| 修改 | `frontend/src/pages/Dashboard.tsx` |
| 修改 | `frontend/src/pages/ChapterList.tsx` |
| 修改 | `frontend/src/pages/QualityDashboard.tsx` |
| 修改 | `frontend/src/pages/Settings.tsx` |
| 修改 | `frontend/src/pages/ProjectOverview.tsx` |
| 修改 | `frontend/src/pages/ProjectOutline.tsx` |
| 修改 | `frontend/src/pages/CreateProject.tsx` |
| 创建 | `frontend/src/components/v2/StatsCard/StatsCard.tsx` |
| 创建 | `frontend/src/components/v2/StatsCard/StatsCard.test.tsx` |
| 修改 | `frontend/src/components/v2/index.ts` |

---

## P0 任务（Day 1-2：基础组件替换）

---

### Task 1: Divider 组件全面替换手动 border-t

**Files:**
- Modify: `frontend/src/pages/ProjectOverview.tsx` (3 处)
- Modify: `frontend/src/pages/CreateProject.tsx` (2 处)
- Modify: `frontend/src/pages/ChapterList.tsx` (2 处)
- Modify: `frontend/src/pages/QualityDashboard.tsx` (1 处)
- Modify: `frontend/src/pages/Settings.tsx` (1 处)
- Test: Run existing tests

#### 代码变更模式

- [ ] **Step 1: 应用统一替换模式**

在每个文件中查找并替换以下模式：

**查找模式:**
```tsx
<div className="mt-6 pt-6 border-t border-[var(--border-default)]">
```

**替换为:**
```tsx
<Divider className="my-6" />
```

**注意：** 根据实际上下文调整 `className`，例如 `mt-6 mb-6` 变为 `my-6`，仅上边距用 `mt-6`，仅下边距用 `mb-6`。

**ProjectOverview.tsx 具体位置：**
- 约 304 行 - "创作 Skill" 卡片标题上方
- 约 347 行 - "创建 Skill" 按钮上方
- 约 370 行 - 卡片底部分隔线

**CreateProject.tsx 具体位置：**
- 约 376 行 - 确认创建卡片底部按钮上方
- 约 400 行 - 步骤导航上方

**ChapterList.tsx 具体位置：**
- 运行历史卡片顶部标题下方
- 章节列表卡片内部

- [ ] **Step 2: 在所有修改文件中添加 Divider import**

```tsx
import { Divider } from '../components/v2'
```

- [ ] **Step 3: 运行前端测试套件验证**

Run:
```bash
cd frontend && npm run test:run
```
Expected: All tests pass (no regressions)

- [ ] **Step 4: 启动开发服务器进行视觉检查**

Run:
```bash
cd frontend && npm run dev
```
Expected: 所有分隔线视觉上与原设计一致

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/pages/ProjectOverview.tsx \
        frontend/src/pages/CreateProject.tsx \
        frontend/src/pages/ChapterList.tsx \
        frontend/src/pages/QualityDashboard.tsx \
        frontend/src/pages/Settings.tsx
git commit -m "refactor: replace manual border-t with Divider component"
```

---

### Task 2: Empty 组件统一空状态

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/pages/ChapterList.tsx`
- Modify: `frontend/src/pages/QualityDashboard.tsx`

#### Dashboard 空项目状态

- [ ] **Step 1: 替换 Dashboard 空状态**

**查找（约 76-83 行）:**
```tsx
{data && data.items.length === 0 && (
  <Card hoverable className="text-center py-12">
    <p className="text-[var(--text-secondary)] mb-6">还没有项目，创建第一个项目开始创作吧</p>
    <Link to="/projects/new">
      <Button variant="primary">创建新项目</Button>
    </Link>
  </Card>
)}
```

**替换为:**
```tsx
{data && data.items.length === 0 && (
  <Empty
    icon="folder"
    title="还没有项目"
    description="创建第一个项目开始创作吧"
    action={
      <Link to="/projects/new">
        <Button variant="primary">创建新项目</Button>
      </Link>
    }
  />
)}
```

- [ ] **Step 2: 添加 Empty import 到 Dashboard.tsx**

```tsx
import { Empty } from '../components/v2'
```

#### ChapterList 空章节和空运行历史

- [ ] **Step 3: 替换 ChapterList 空章节状态**

**查找（约 266-275 行）:**
```tsx
{!chapters?.length && (
  <div className="rounded-standard border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-tertiary)] p-12 text-center">
    <svg className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
    <p className="text-[var(--text-primary)] font-medium mb-2">还没有章节</p>
    <p className="text-[var(--text-secondary)] text-sm">开始生成后，章节会在这里出现。你可以随时编辑和润色。</p>
  </div>
)}
```

**替换为:**
```tsx
{!chapters?.length && (
  <Empty
    icon="list"
    title="还没有章节"
    description="开始生成后，章节会在这里出现。你可以随时编辑和润色。"
  />
)}
```

- [ ] **Step 4: 替换 ChapterList 空运行历史状态**

**查找（约 350-359 行）:**
```tsx
{!workflowHistory?.items.length && (
  <div className="rounded-standard border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-tertiary)] p-12 text-center">
    <svg className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
    <p className="text-[var(--text-primary)] font-medium mb-2">还没有运行记录</p>
    <p className="text-[var(--text-secondary)] text-sm">触发生成后，这里会开始沉淀项目运行记录，方便后续回放和问题定位。</p>
  </div>
)}
```

**替换为:**
```tsx
{!workflowHistory?.items.length && (
  <Empty
    icon="document"
    title="还没有运行记录"
    description="触发生成后，这里会开始沉淀项目运行记录，方便后续回放和问题定位。"
  />
)}
```

- [ ] **Step 5: 添加 Empty import 到 ChapterList.tsx**

```tsx
import { Empty } from '../components/v2'
```

#### QualityDashboard 无数据状态

- [ ] **Step 6: 替换 QualityDashboard 无分析数据状态**

**查找（约 68-70 行）:**
```tsx
if (!analytics) {
  return <p className="text-[var(--text-secondary)]">暂无数据分析数据，请先生成章节并运行质量分析</p>
}
```

**替换为:**
```tsx
if (!analytics) {
  return (
    <Empty
      icon="chart"
      title="暂无分析数据"
      description="先生成章节并运行质量分析后再来查看"
    />
  )
}
```

**注意：** 需要在 Empty 组件中添加 'chart' icon 类型，参考 Task 3。

- [ ] **Step 7: 添加 Empty import 到 QualityDashboard.tsx**

```tsx
import { Empty } from '../components/v2'
```

- [ ] **Step 8: 运行测试验证**

Run:
```bash
cd frontend && npm run test:run
```
Expected: All tests pass

- [ ] **Step 9: Commit changes**

```bash
git add frontend/src/pages/Dashboard.tsx \
        frontend/src/pages/ChapterList.tsx \
        frontend/src/pages/QualityDashboard.tsx
git commit -m "refactor: use Empty component for all empty states"
```

---

### Task 3: 扩展 Empty 组件支持 'chart' icon 类型

**Files:**
- Modify: `frontend/src/components/v2/Empty/Empty.tsx`
- Test: `frontend/src/components/v2/Empty/Empty.test.tsx` (verify existing tests)

- [ ] **Step 1: 扩展 EmptyIconType 并添加 ChartIcon**

**查找（约 3 行）:**
```tsx
export type EmptyIconType = 'document' | 'folder' | 'list'
```

**替换为:**
```tsx
export type EmptyIconType = 'document' | 'folder' | 'list' | 'chart'
```

**查找 iconMap 上方（约 28-37 行），添加 ChartIcon:**

在 `ListIcon` 定义后添加：

```tsx
// Chart icon
const ChartIcon = () => (
  <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 48V28M24 48V16M36 48V24M48 48V8" strokeWidth="3" />
    <path d="M8 48h48" strokeWidth="3" />
  </svg>
)
```

**更新 iconMap（约 39 行）:**
```tsx
const iconMap: Record<EmptyIconType, React.FC> = {
  document: DocumentIcon,
  folder: FolderIcon,
  list: ListIcon,
  chart: ChartIcon,
}
```

- [ ] **Step 2: 运行 Empty 组件测试**

Run:
```bash
cd frontend && npm run test:run -- src/components/v2/Empty/Empty.test.tsx
```
Expected: All tests pass

- [ ] **Step 3: Commit changes**

```bash
git add frontend/src/components/v2/Empty/Empty.tsx
git commit -m "feat: add 'chart' icon type to Empty component"
```

---

### Task 4: Alert 组件集成 - 错误和成功反馈

**Files:**
- Modify: `frontend/src/pages/ProjectOutline.tsx`
- Modify: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/src/pages/QualityDashboard.tsx`
- Modify: `frontend/src/pages/CreateProject.tsx`

#### ProjectOutline 配置保存反馈

- [ ] **Step 1: 在 ProjectOutline 中添加 Alert 用于配置更新反馈**

**查找 updateConfigMutation（约 74-89 行）:**

在 mutation 成功回调中添加视觉反馈。当前实现使用 Toast，我们添加 Alert 组件显示在表单上方：

```tsx
// 在表单上方添加成功提示状态
const [showSuccess, setShowSuccess] = useState(false)

const updateConfigMutation = useMutation({
  mutationFn: () => updateProject(projectId, {
    config: {
      ...data?.config,
      ...configForm,
    },
  }),
  onSuccess: () => {
    showToast('配置已更新', 'success')
    setShowSuccess(true)
    queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    setEditingConfig(false)
    setTimeout(() => setShowSuccess(false), 3000)
  },
  onError: () => {
    showToast('更新失败', 'error')
  },
})
```

**在编辑表单上方（约 239 行）添加 Alert:**

```tsx
{showSuccess && (
  <Alert variant="success" title="配置已更新" className="mb-4">
    你的项目配置已成功保存
  </Alert>
)}
```

- [ ] **Step 2: 添加 Alert import 到 ProjectOutline.tsx**

```tsx
import { Alert } from '../components/v2'
```

#### QualityDashboard 加载错误提示

- [ ] **Step 3: 在 QualityDashboard 中添加 Alert 错误提示**

**查找（约 57-66 行）:**
```tsx
if (isError) {
  return (
    <div className="space-y-4">
      <p className="text-[var(--text-danger)]">加载分析数据失败</p>
      <p className="text-sm text-[var(--text-secondary)]">
        {error instanceof Error ? error.message : '请稍后重试'}
      </p>
    </div>
  )
}
```

**替换为:**
```tsx
if (isError) {
  return (
    <Alert variant="error" title="加载分析数据失败">
      {error instanceof Error ? error.message : '请稍后重试'}
    </Alert>
  )
}
```

- [ ] **Step 4: 添加 Alert import 到 QualityDashboard.tsx**

```tsx
import { Alert } from '../components/v2'
```

#### CreateProject 表单验证警告

- [ ] **Step 5: 在 CreateProject 中添加章节范围冲突警告**

在步骤 3 配置表单中，当结束章节小于起始章节时显示 Alert：

```tsx
// 在 Step 3 表单内添加
{configForm.end_chapter < configForm.start_chapter && (
  <Alert variant="warning" title="章节范围冲突" className="mb-4">
    结束章节不能小于起始章节，请检查输入
  </Alert>
)}
```

- [ ] **Step 6: 添加 Alert import 到 CreateProject.tsx**

```tsx
import { Alert } from '../components/v2'
```

#### Settings API Key 更新反馈

- [ ] **Step 7: 在 Settings.tsx 中添加操作反馈**

在 mutations 中添加视觉状态反馈，当清除或更新 API Key 成功后显示 Alert：

```tsx
// 添加状态
const [alert, setAlert] = useState<{ type: AlertVariant; message: string } | null>(null)

// 在 clearMutation 中
onSuccess: (data) => {
  setUser(data)
  queryClient.invalidateQueries({ queryKey: ['me'] })
  setAlert({ type: 'success', message: '已切换为系统默认 API Key' })
  setLoading(false)
  setTimeout(() => setAlert(null), 3000)
},

// 在 updateMutation 中
onSuccess: (data) => {
  setUser(data)
  queryClient.invalidateQueries({ queryKey: ['me'] })
  setAlert({ type: 'success', message: 'API Key 已更新' })
  setNewApiKey('')
  setLoading(false)
  setTimeout(() => setAlert(null), 3000)
},
```

**在页面顶部显示 Alert:**

```tsx
{alert && (
  <Alert variant={alert.type} className="mb-6">
    {alert.message}
  </Alert>
)}
```

- [ ] **Step 8: 添加 Alert import 到 Settings.tsx**

```tsx
import { Alert, AlertVariant } from '../components/v2'
```

- [ ] **Step 9: 运行测试验证**

Run:
```bash
cd frontend && npm run test:run
```
Expected: All tests pass

- [ ] **Step 10: Commit changes**

```bash
git add frontend/src/pages/ProjectOutline.tsx \
        frontend/src/pages/QualityDashboard.tsx \
        frontend/src/pages/CreateProject.tsx \
        frontend/src/pages/Settings.tsx
git commit -m "refactor: integrate Alert component for user feedback"
```

---

### Task 5: Switch 组件替换 Settings 布尔 Checkbox

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: 替换 Checkbox 为 Switch**

**查找（约 83-93 行）:**
```tsx
<Card>
  <h2 className="text-lg font-medium mb-4 text-[var(--text-primary)]">布局偏好</h2>
  <div className="space-y-4">
    <label className="flex items-center gap-3 cursor-pointer">
      <Checkbox
        checked={autoExpandHeaderInProject}
        onChange={setAutoExpandHeaderInProject}
      />
      <span className="text-[var(--text-body)]">进入项目时自动展开顶栏</span>
    </label>
  </div>
</Card>
```

**替换为:**
```tsx
<Card>
  <h2 className="text-lg font-medium mb-4 text-[var(--text-primary)]">布局偏好</h2>
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <span className="text-[var(--text-body)]">进入项目时自动展开顶栏</span>
      <Switch
        checked={autoExpandHeaderInProject}
        onChange={setAutoExpandHeaderInProject}
      />
    </div>
  </div>
</Card>
```

- [ ] **Step 2: 更新 import，移除 Checkbox，添加 Switch**

```tsx
import { Switch } from '../components/v2'
```

- [ ] **Step 3: 运行 Settings 测试**

Run:
```bash
cd frontend && npm run test:run -- src/pages/Settings.test.tsx
```
Expected: All tests pass

- [ ] **Step 4: Commit changes**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "refactor: replace Checkbox with Switch for boolean settings"
```

---

## P1 任务（Day 2-3：新模式抽象）

---

### Task 6: StatsCard 新组件开发

**Files:**
- Create: `frontend/src/components/v2/StatsCard/StatsCard.tsx`
- Create: `frontend/src/components/v2/StatsCard/StatsCard.test.tsx`
- Modify: `frontend/src/components/v2/index.ts`

- [ ] **Step 1: 写失败的单元测试**

创建 `frontend/src/components/v2/StatsCard/StatsCard.test.tsx`:

```tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import { expect, describe, it } from 'vitest'
import { StatsCard } from './StatsCard'

describe('StatsCard', () => {
  it('should render label and value', () => {
    render(<StatsCard label="测试标签" value="测试值" />)
    
    expect(screen.getByText('测试标签')).toBeInTheDocument()
    expect(screen.getByText('测试值')).toBeInTheDocument()
  })

  it('should format number value with locale', () => {
    render(<StatsCard label="数量" value={1000} />)
    
    expect(screen.getByText('1,000')).toBeInTheDocument()
  })

  it('should apply variant classes', () => {
    const { container } = render(<StatsCard label="测试" value="值" variant="primary" />)
    
    expect(container.firstChild).toHaveClass('bg-[var(--accent-primary)]/10')
  })

  it('should apply custom className', () => {
    const { container } = render(<StatsCard label="测试" value="值" className="custom-class" />)
    
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd frontend && npm run test:run -- src/components/v2/StatsCard/StatsCard.test.tsx
```
Expected: FAIL with "module not found"

- [ ] **Step 3: 实现 StatsCard 组件**

创建 `frontend/src/components/v2/StatsCard/StatsCard.tsx`:

```tsx
import React from 'react'

export type StatsCardVariant = 'default' | 'primary' | 'success' | 'warning'

export interface StatsCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  variant?: StatsCardVariant
  className?: string
}

const variantClasses: Record<StatsCardVariant, string> = {
  default: '',
  primary: 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/20',
  success: 'bg-[var(--accent-success)]/10 border-[var(--accent-success)]/20',
  warning: 'bg-[var(--accent-gold)]/10 border-[var(--accent-gold)]/20',
}

export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  icon,
  variant = 'default',
  className = '',
}) => {
  const displayValue = typeof value === 'number' 
    ? value.toLocaleString() 
    : value

  return (
    <div
      className={`
        rounded-standard border border-[var(--border-default)] 
        bg-[var(--bg-secondary)] px-4 py-3 text-center 
        transition-all hover:border-[var(--border-strong)]
        ${variantClasses[variant]}
        ${className}
      `.trim()}
    >
      {icon && <div className="mb-1">{icon}</div>}
      <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 text-[var(--text-primary)] font-medium">
        {displayValue}
      </p>
    </div>
  )
}

StatsCard.displayName = 'StatsCard'
```

- [ ] **Step 4: 添加到 v2 index 导出**

修改 `frontend/src/components/v2/index.ts`:

```tsx
// 在文件末尾添加
export * from './StatsCard/StatsCard'
```

- [ ] **Step 5: 运行测试验证通过**

Run:
```bash
cd frontend && npm run test:run -- src/components/v2/StatsCard/StatsCard.test.tsx
```
Expected: All 4 tests PASS

- [ ] **Step 6: Commit changes**

```bash
git add frontend/src/components/v2/StatsCard/StatsCard.tsx \
        frontend/src/components/v2/StatsCard/StatsCard.test.tsx \
        frontend/src/components/v2/index.ts
git commit -m "feat: add StatsCard component for statistic display"
```

---

### Task 7: 在所有页面应用 StatsCard 组件

**Files:**
- Modify: `frontend/src/pages/ChapterList.tsx` (4 处)
- Modify: `frontend/src/pages/QualityDashboard.tsx` (4 处)
- Modify: `frontend/src/pages/ProjectOverview.tsx` (2 处)

#### ChapterList 统计卡片

- [ ] **Step 1: 替换 ChapterList 中的手动统计卡片**

**查找（约 166-183 行）4 个手动 div 卡片:**

```tsx
<div className="flex gap-3 flex-wrap justify-center lg:justify-end">
  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 transition-all hover:border-[var(--border-strong)] min-w-[100px] text-center">
    <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">目标范围</p>
    <p className="mt-1 text-[var(--text-primary)] font-medium">{targetStart} - {targetEnd}</p>
  </div>
  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 transition-all hover:border-[var(--border-strong)] min-w-[100px] text-center">
    <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">当前章节</p>
    <p className="mt-1 text-[var(--text-primary)] font-medium">{completedChapters}</p>
  </div>
  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 transition-all hover:border-[var(--border-strong)] min-w-[100px] text-center">
    <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">平均评分</p>
    <p className="mt-1 text-[var(--text-primary)] font-medium">{averageScore > 0 ? averageScore.toFixed(1) : '待生成'}</p>
  </div>
  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 transition-all hover:border-[var(--border-strong)] min-w-[100px] text-center">
    <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">历史运行</p>
    <p className="mt-1 text-[var(--text-primary)] font-medium">{workflowHistory?.total ?? 0}</p>
  </div>
</div>
```

**替换为:**
```tsx
<div className="flex gap-3 flex-wrap justify-center lg:justify-end">
  <StatsCard label="目标范围" value={`${targetStart} - ${targetEnd}`} />
  <StatsCard label="当前章节" value={completedChapters} variant="primary" />
  <StatsCard 
    label="平均评分" 
    value={averageScore > 0 ? averageScore.toFixed(1) : '待生成'} 
  />
  <StatsCard label="历史运行" value={workflowHistory?.total ?? 0} />
</div>
```

- [ ] **Step 2: 添加 StatsCard import 到 ChapterList.tsx**

```tsx
import { StatsCard } from '../components/v2'
```

#### QualityDashboard 统计卡片

- [ ] **Step 3: 替换 QualityDashboard 中的手动统计卡片**

**查找（约 247-264 行）4 个卡片:**

```tsx
<div className="grid grid-cols-2 gap-3 flex-wrap">
  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-center">
    <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">总章节</p>
    <p className="mt-1 text-[var(--text-primary)] font-medium">{totalChapters}</p>
  </div>
  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-center">
    <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">合格</p>
    <p className="mt-1 text-[var(--text-primary)] font-medium">{passedChapters}</p>
  </div>
  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-center">
    <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">通过率</p>
    <p className="mt-1 text-[var(--text-primary)] font-medium">{passRate.toFixed(0)}%</p>
  </div>
  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-center">
    <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">待处理</p>
    <p className="mt-1 text-[var(--text-primary)] font-medium">{scoreBuckets.weak}</p>
  </div>
</div>
```

**替换为:**
```tsx
<div className="grid grid-cols-2 gap-3">
  <StatsCard label="总章节" value={totalChapters} />
  <StatsCard label="合格" value={passedChapters} variant="success" />
  <StatsCard label="通过率" value={`${passRate.toFixed(0)}%`} variant="primary" />
  <StatsCard label="待处理" value={scoreBuckets.weak} variant="warning" />
</div>
```

- [ ] **Step 4: 添加 StatsCard import 到 QualityDashboard.tsx**

```tsx
import { StatsCard } from '../components/v2'
```

#### ProjectOverview 极值卡片

- [ ] **Step 5: 替换 ProjectOverview 中的维度极值卡片**

**查找（约 292-306 行）:**

```tsx
<div className="grid gap-3 md:grid-cols-2 mb-5">
  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
    <p className="text-[var(--text-secondary)] text-sm">最强维度</p>
    <p className="mt-2 text-xl text-[var(--text-primary)] font-medium">
      {strongestDimensionEntry
        ? `${dimensionMapping[strongestDimensionEntry[0]] || strongestDimensionEntry[0]} ${strongestDimensionEntry[1].toFixed(1)}`
        : '-'}
    </p>
  </div>
  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
    <p className="text-[var(--text-secondary)] text-sm">最弱维度</p>
    <p className="mt-2 text-xl text-[var(--text-primary)] font-medium">
      {weakestDimensionEntry
        ? `${dimensionMapping[weakestDimensionEntry[0]] || weakestDimensionEntry[0]} ${weakestDimensionEntry[1].toFixed(1)}`
        : '-'}
    </p>
  </div>
</div>
```

**替换为:**
```tsx
<div className="grid gap-3 md:grid-cols-2 mb-5">
  <StatsCard
    label="最强维度"
    value={strongestDimensionEntry
      ? `${dimensionMapping[strongestDimensionEntry[0]] || strongestDimensionEntry[0]} ${strongestDimensionEntry[1].toFixed(1)}`
      : '-'}
    variant="success"
  />
  <StatsCard
    label="最弱维度"
    value={weakestDimensionEntry
      ? `${dimensionMapping[weakestDimensionEntry[0]] || weakestDimensionEntry[0]} ${weakestDimensionEntry[1].toFixed(1)}`
      : '-'}
    variant="warning"
  />
</div>
```

- [ ] **Step 5: 添加 StatsCard import 到 ProjectOverview.tsx**

```tsx
import { StatsCard } from '../components/v2'
```

- [ ] **Step 6: 运行测试验证**

Run:
```bash
cd frontend && npm run test:run
```
Expected: All tests pass

- [ ] **Step 7: Commit changes**

```bash
git add frontend/src/pages/ChapterList.tsx \
        frontend/src/pages/QualityDashboard.tsx \
        frontend/src/pages/ProjectOverview.tsx
git commit -m "refactor: apply StatsCard to all statistic display patterns"
```

---

### Task 8: Skeleton 加载状态全面应用

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/pages/ChapterList.tsx`
- Modify: `frontend/src/pages/QualityDashboard.tsx`
- Modify: `frontend/src/pages/ProjectOverview.tsx`

#### Dashboard 项目列表加载状态

- [ ] **Step 1: 替换 Dashboard 简单加载文本**

**查找（约 74 行）:**
```tsx
{isLoading && <p className="text-[var(--text-secondary)]">加载中...</p>}
```

**替换为:**
```tsx
{isLoading && (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-32 rounded-lg" />
    ))}
  </div>
)}
```

#### ChapterList 加载状态

- [ ] **Step 2: 替换 ChapterList 加载状态**

**查找 chapters 加载位置，添加 Skeleton:**

```tsx
{isLoading && (
  <div className="space-y-3">
    <Skeleton className="h-20 rounded-lg" />
    <Skeleton className="h-20 rounded-lg" />
    <Skeleton className="h-20 rounded-lg" />
  </div>
)}
```

#### QualityDashboard 加载状态

- [ ] **Step 3: 替换 QualityDashboard 加载状态**

```tsx
{isLoading && (
  <div className="space-y-6">
    <Skeleton className="h-24 rounded-lg" />
    <div className="grid gap-6 xl:grid-cols-2">
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  </div>
)}
```

#### ProjectOutline 加载状态

- [ ] **Step 4: 替换 ProjectOutline 加载状态**

```tsx
{isLoading && (
  <div className="space-y-6">
    <Skeleton className="h-32 rounded-lg" />
    <Skeleton className="h-40 rounded-lg" />
  </div>
)}
```

- [ ] **Step 5: 在所有修改文件中添加 Skeleton import**

```tsx
import { Skeleton } from '../components/v2'
```

- [ ] **Step 6: 运行测试验证**

Run:
```bash
cd frontend && npm run test:run
```
Expected: All tests pass

- [ ] **Step 7: Commit changes**

```bash
git add frontend/src/pages/Dashboard.tsx \
        frontend/src/pages/ChapterList.tsx \
        frontend/src/pages/QualityDashboard.tsx \
        frontend/src/pages/ProjectOverview.tsx
git commit -m "refactor: add Skeleton loading states to all data pages"
```

---

### Task 9: Select 组件重构 CreateProject 内容类型选择

**Files:**
- Modify: `frontend/src/pages/CreateProject.tsx`

- [ ] **Step 1: 替换自定义单选实现为 Select 组件**

**查找（约 177-201 行）:**
```tsx
<div className="space-y-3">
  <label className="text-body text-sm font-medium">内容类型</label>
  <div className="grid gap-3 md:grid-cols-3">
    {contentTypes.map(type => (
      <label
        key={type.value}
        className={`cursor-pointer rounded-comfortable border p-4 text-center transition-colors ${
          formData.content_type === type.value
            ? 'border-sage bg-sage/10 text-inkwell'
            : 'border-border bg-parchment/40 text-[var(--text-secondary)] hover:border-sage/30'
        }`}
      >
        <input
          type="radio"
          name="content_type"
          value={type.value}
          checked={formData.content_type === type.value}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateForm({ content_type: event.target.value as ContentType })}
          className="sr-only"
        />
        <div className="font-medium">{type.label}</div>
      </label>
    ))}
  </div>
</div>
```

**替换为:**
```tsx
<Input
  label="内容类型"
  render={() => (
    <Select
      value={formData.content_type}
      onValueChange={(value) => updateForm({ content_type: value as ContentType })}
    >
      <SelectTrigger>
        <SelectValue placeholder="选择内容类型" />
      </SelectTrigger>
      <SelectContent>
        {contentTypes.map(type => (
          <SelectItem key={type.value} value={type.value}>
            {type.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )}
/>
```

**注意：** Input 组件支持 `render` 属性用于自定义内容，或者我们直接使用不带 Input 包裹的 Select。

简化版本：
```tsx
<div className="space-y-2">
  <label className="text-body text-sm font-medium">内容类型</label>
  <Select
    value={formData.content_type}
    onValueChange={(value) => updateForm({ content_type: value as ContentType })}
  >
    <SelectTrigger>
      <SelectValue placeholder="选择内容类型" />
    </SelectTrigger>
    <SelectContent>
      {contentTypes.map(type => (
        <SelectItem key={type.value} value={type.value}>
          {type.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

- [ ] **Step 2: 添加 Select 相关组件 import**

```tsx
import { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from '../components/v2'
```

- [ ] **Step 3: 运行 CreateProject 测试**

Run:
```bash
cd frontend && npm run test:run -- src/pages/CreateProject.test.tsx
```
Expected: All tests pass

- [ ] **Step 4: Commit changes**

```bash
git add frontend/src/pages/CreateProject.tsx
git commit -m "refactor: use Select component for content type picker"
```

---

## P2 任务（Day 4-5：数据展示增强）

---

### Task 10: Table + Pagination 重构 QualityDashboard 章节明细

**Files:**
- Modify: `frontend/src/pages/QualityDashboard.tsx`

- [ ] **Step 1: 替换自定义章节列表为 Table 组件**

**查找（约 382-409 行）:**

```tsx
<div className="space-y-3">
  {chapterScores.map(chapter => (
    <div
      key={chapter.chapter_index}
      className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 transition-all hover:border-[var(--border-strong)]"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-[var(--text-primary)] truncate">{chapter.title || `第${chapter.chapter_index}章`}</span>
            <Badge variant="secondary">{chapter.status}</Badge>
          </div>
          <div className="mt-3 max-w-md">
            <Progress value={chapter.quality_score * 10} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={getScoreColor(chapter.quality_score)}>
            {chapter.quality_score.toFixed(1)}
          </Badge>
          <Link to={`/projects/${projectId}/write/${chapter.chapter_index}`}>
            <Button variant="tertiary" size="sm">编辑</Button>
          </Link>
        </div>
      </div>
    </div>
  ))}
</div>
```

**替换为:**
```tsx
<Table
  columns={[
    {
      key: 'title',
      title: '章节',
      render: (_: unknown, record: any) => (
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">
            {record.title || `第${record.chapter_index}章`}
          </span>
          <Badge variant="secondary">{record.status}</Badge>
        </div>
      ),
    },
    {
      key: 'quality_score',
      title: '评分',
      render: (value: unknown) => (
        <div className="w-32">
          <Progress value={(value as number) * 10} />
          <div className="mt-1 text-sm text-right">
            {(value as number).toFixed(1)}
          </div>
        </div>
      ),
    },
    {
      key: 'word_count',
      title: '字数',
      render: (value: unknown) => (value as number)?.toLocaleString() || '-',
      align: 'right',
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (_: unknown, record: any) => (
        <Link to={`/projects/${projectId}/write/${record.chapter_index}`}>
          <Button variant="tertiary" size="sm">编辑</Button>
        </Link>
      ),
    },
  ]}
  dataSource={chapterScores}
  hoverable
  striped
/>
```

- [ ] **Step 2: 添加 Table import**

```tsx
import { Table } from '../components/v2'
```

- [ ] **Step 3: 运行测试验证**

Run:
```bash
cd frontend && npm run test:run -- src/pages/QualityDashboard.test.tsx
```
Expected: All tests pass

- [ ] **Step 4: Commit changes**

```bash
git add frontend/src/pages/QualityDashboard.tsx
git commit -m "refactor: use Table component for chapter details"
```

---

### Task 11: AgentCard 组件化 ProjectOverview 智能体状态

**Files:**
- Modify: `frontend/src/pages/ProjectOverview.tsx`

- [ ] **Step 1: 使用 AgentCard 替换自定义智能体卡片**

**查找（约 457-471 行）:**

```tsx
<Card className="border-[var(--border-default)] p-6">
  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">智能体状态</h2>
  <div className="grid gap-4 md:grid-cols-4">
    {agentCards.map(agent => (
      <div
        key={agent.key}
        className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-center"
      >
        <h3 className="text-lg font-medium text-[var(--text-primary)]">{agent.title}</h3>
        <Badge variant={agentStates[agent.key] === 'done' ? 'success' : agentStates[agent.key] === 'running' ? 'status' : 'secondary'} className="mt-3">
          {agentStates[agent.key] === 'done' ? '已完成' : agentStates[agent.key] === 'running' ? '运行中' : '等待'}
        </Badge>
      </div>
    ))}
  </div>
</Card>
```

**替换为:**

```tsx
<Card className="border-[var(--border-default)] p-6">
  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">智能体状态</h2>
  <div className="grid gap-4 md:grid-cols-4">
    {agentCards.map(agent => (
      <AgentCard
        key={agent.key}
        name={agent.title}
        description={agent.subtitle}
        status={agentStates[agent.key]}
      />
    ))}
  </div>
</Card>
```

**注意：** 如果 AgentCard 不支持 status 属性，请按现有组件 API 调整，或者直接使用现有组件保持不变。

- [ ] **Step 2: 添加 AgentCard import**

```tsx
import { AgentCard } from '../components/v2'
```

- [ ] **Step 3: 运行测试验证**

Run:
```bash
cd frontend && npm run test:run
```
Expected: All tests pass

- [ ] **Step 4: Commit changes**

```bash
git add frontend/src/pages/ProjectOverview.tsx
git commit -m "refactor: use AgentCard for agent status display"
```

---

## 最终验证和收尾

### Task 12: 完整测试和验证

- [ ] **Step 1: 运行完整测试套件**

Run:
```bash
cd frontend && npm run test:run
```
Expected: All 100+ tests pass

- [ ] **Step 2: 运行 TypeScript 类型检查**

Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: No type errors

- [ ] **Step 3: 运行 ESLint 检查**

Run:
```bash
cd frontend && npm run lint
```
Expected: No lint errors

- [ ] **Step 4: 完整功能冒烟测试**

在开发服务器中手动验证：
- Dashboard 空状态和加载状态
- ChapterList 空章节状态、统计卡片
- QualityDashboard 表格、空状态、错误提示
- Settings Switch 组件和 Alert 反馈
- CreateProject Select 组件工作正常
- ProjectOutline Alert 反馈

- [ ] **Step 5: 最终 Commit（如有修复）**

```bash
git add -A
git commit -m "test: fix any remaining test or type issues"
```

---

## 实施完成摘要

### 预期结果

- ✅ **v2 组件使用率**：从 ~40% 提升到 85%+
- ✅ **消除重复代码**：约 500+ 行重复 UI 代码被组件化
- ✅ **用户体验提升**：Skeleton 加载状态、Alert 视觉反馈
- ✅ **代码质量**：所有测试通过，无类型错误，无 lint 警告
- ✅ **无功能变更**：所有业务逻辑保持原样

### 统计

| 指标 | 数值 |
|------|------|
| 修改文件 | 8 个页面 + 2 个组件文件 |
| 新增组件 | 1 个（StatsCard） |
| 增强组件 | 1 个（Empty chart icon） |
| 替换重复模式 | 15+ 处 |
| 预计开发时间 | 3-5 工作日 |
| 测试覆盖率 | 保持不变（新增组件有测试） |

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-27-v2-component-utilization-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
