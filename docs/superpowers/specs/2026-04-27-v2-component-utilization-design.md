# v2 组件库充分利用设计规范

> **Status**: Draft  
> **Created**: 2026-04-27  
> **Author**: Claude Code  
> **For**: StoryForge AI 前端重构

## 概览

### 问题陈述

StoryForge AI 的 v2 组件库包含 20+ 精心设计的 UI 组件，但当前前端页面只使用了其中约 40%。大量重复的、手动实现的 UI 模式导致：

1. **UI 不一致性** - 相同模式在不同页面有细微差异
2. **代码重复** - 至少 7 个页面重复实现了相同的信息卡片、空状态、分隔线
3. **维护成本高** - 修改样式需要在多处同步
4. **用户体验下降** - 缺少 Skeleton、Alert 等反馈组件

### 目标

- ✅ 100% 利用现有 v2 组件能力
- ✅ 消除重复 UI 模式代码（>80%）
- ✅ 提升用户体验（加载状态、错误提示）
- ✅ 不改变任何业务逻辑行为
- ✅ 5 个工作日内完成

### 范围

**包含：**
- 5 个核心页面的组件化重构
- 1 个新增业务组件（StatsCard）
- 现有组件增强（Empty、Alert 属性扩展）

**不包含：**
- 新功能开发
- 业务逻辑变更
- 性能优化
- 样式主题调整

---

## 设计详情

### 1. Divider 组件统一

#### 问题
7 个文件中出现 14+ 次重复的手动分隔线代码：
```tsx
<div className="mt-6 pt-6 border-t border-[var(--border-default)]">
```

#### 解决方案
直接使用现有 `Divider` 组件，支持可选的间距属性：

```tsx
// 替换前
<div className="mt-6 pt-6 border-t border-[var(--border-default)]">
  {/* content */}
</div>

// 替换后
<Divider className="my-6" />
{/* content */}
```

#### 影响文件
- `ProjectOverview.tsx` - 3 处
- `CreateProject.tsx` - 2 处  
- `ChapterList.tsx` - 2 处
- `QualityDashboard.tsx` - 1 处
- `Settings.tsx` - 1 处

#### 验收标准
- 所有手动 `border-t` 都替换为 Divider
- 视觉上与原设计一致

---

### 2. Empty 组件统一与增强

#### 问题
3 个页面独立实现几乎相同的空状态 UI，样式和文案不一致。

#### 解决方案
**步骤 1：增强 Empty 组件**
```tsx
// frontend/src/components/v2/Empty/Empty.tsx
export interface EmptyProps {
  icon?: React.ReactNode | 'book' | 'list' | 'search' | 'chart'
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export const Empty: React.FC<EmptyProps> = ({
  icon,
  title,
  description,
  action,
  className
}) => {
  // 内置 icon 映射
  const iconMap = {
    book: <svg />, // 书籍图标
    list: <svg />, // 列表图标
    search: <svg />, // 搜索图标
    chart: <svg />, // 图表图标
  }

  return (
    <div className={cn(
      "rounded-standard border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-tertiary)] p-12 text-center",
      className
    )}>
      {icon && (
        <div className="mb-4 text-[var(--text-muted)]">
          {typeof icon === 'string' ? iconMap[icon] : icon}
        </div>
      )}
      <p className="text-[var(--text-primary)] font-medium mb-2">{title}</p>
      {description && (
        <p className="text-[var(--text-secondary)] text-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
```

**步骤 2：在各页面使用**
```tsx
// Dashboard.tsx - 空项目
<Empty
  icon="book"
  title="还没有项目"
  description="创建第一个项目开始创作吧"
  action={
    <Link to="/projects/new">
      <Button variant="primary">创建新项目</Button>
    </Link>
  }
/>

// ChapterList.tsx - 空章节
<Empty
  icon="list"
  title="还没有章节"
  description="开始生成后，章节会在这里出现。你可以随时编辑和润色。"
/>

// QualityDashboard.tsx - 无数据
<Empty
  icon="chart"
  title="暂无分析数据"
  description="先生成章节并运行质量分析后再来查看"
/>
```

#### 影响文件
- `Dashboard.tsx`
- `ChapterList.tsx`
- `QualityDashboard.tsx`

#### 验收标准
- 所有空状态统一使用 Empty 组件
- 内置 icon 渲染正确
- 支持自定义 icon 和 action

---

### 3. Alert 组件集成

#### 问题
错误消息、警告提示、成功消息都用内联样式处理，没有统一设计。

#### 解决方案
在所有需要用户注意的地方使用 Alert 组件：

```tsx
// 错误提示 - QualityDashboard.tsx
<Alert variant="error" title="加载分析数据失败">
  {error instanceof Error ? error.message : '请稍后重试'}
</Alert>

// 成功提示 - ProjectOutline.tsx
{showSuccess && (
  <Alert variant="success" title="配置已更新" />
)}

// 警告提示 - CreateProject.tsx
{chapterMismatch && (
  <Alert variant="warning" title="章节范围冲突">
    结束章节不能小于起始章节，请检查输入
  </Alert>
)}

// 信息提示 - ProjectOverview.tsx
{project.status === 'draft' && (
  <Alert variant="info" title="项目准备就绪">
    配置已完成，点击"开始生成"进入创作流程
  </Alert>
)}
```

#### 影响文件
- `QualityDashboard.tsx`
- `ProjectOutline.tsx`
- `CreateProject.tsx`
- `Settings.tsx`
- `Login.tsx`
- `Register.tsx`

#### 验收标准
- 所有表单错误、操作反馈都使用 Alert
- Alert 四个变体样式正确（error, success, warning, info）
- 支持 title 和 children 内容

---

### 4. Switch 替换 Checkbox（布尔设置）

#### 问题
Settings 页面的布尔偏好选项更适合用 Switch 组件，Checkbox 多用于多选项表单。

#### 解决方案
```tsx
// Settings.tsx - 布局偏好设置
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

#### 影响文件
- `Settings.tsx`

#### 验收标准
- Switch 样式与设计系统一致
- 状态切换正常工作
- 无障碍标签正确

---

### 5. StatsCard 新增组件（模式抽象）

#### 问题
所有数据展示页面都重复实现了"标签 + 值"的统计卡片模式，至少出现 15 次。

#### 解决方案
**新增组件：**
```tsx
// frontend/src/components/v2/StatsCard/StatsCard.tsx
export interface StatsCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  variant?: 'default' | 'primary' | 'success' | 'warning'
  className?: string
}

export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  icon,
  variant = 'default',
  className
}) => {
  const variantClasses = {
    default: 'bg-[var(--bg-secondary)]',
    primary: 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/20',
    success: 'bg-[var(--accent-success)]/10 border-[var(--accent-success)]/20',
    warning: 'bg-[var(--accent-warm)]/10 border-[var(--accent-warm)]/20',
  }

  return (
    <div className={cn(
      "rounded-standard border border-[var(--border-default)] px-4 py-3 text-center transition-all hover:border-[var(--border-strong)]",
      variantClasses[variant],
      className
    )}>
      {icon && <div className="mb-1">{icon}</div>}
      <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 text-[var(--text-primary)] font-medium">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  )
}
```

**使用示例 - ChapterList.tsx：**
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

#### 影响文件
- 新建 `StatsCard` 组件文件
- `ChapterList.tsx` - 4 处
- `QualityDashboard.tsx` - 4 处
- `ProjectOverview.tsx` - 2 处

#### 验收标准
- StatsCard 组件支持所有属性
- 所有统计卡片替换完成
- 视觉与原设计一致

---

### 6. Skeleton 加载状态

#### 问题
所有加载状态只有简单的"加载中..."文本，用户体验差。

#### 解决方案
```tsx
// 替换前
{isLoading && <p className="text-[var(--text-secondary)]">加载中...</p>}

// 替换后 - Dashboard 项目列表
{isLoading && (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[1, 2, 3].map(i => (
      <Skeleton key={i} className="h-32" />
    ))}
  </div>
)}

// 替换后 - ChapterList
{isLoading && (
  <div className="space-y-3">
    <Skeleton className="h-20" />
    <Skeleton className="h-20" />
    <Skeleton className="h-20" />
  </div>
)}
```

#### 影响文件
- `Dashboard.tsx`
- `ChapterList.tsx`
- `QualityDashboard.tsx`
- `ProjectOverview.tsx`

#### 验收标准
- 所有数据加载场景都有 Skeleton
- Skeleton 形状匹配实际内容布局
- 动画效果流畅

---

### 7. Select 组件统一单选选项

#### 问题
CreateProject 中的内容类型选择是自定义实现，没有复用 Select 组件。

#### 解决方案
```tsx
// CreateProject.tsx
<div className="space-y-3">
  <label className="text-body text-sm font-medium">内容类型</label>
  <Select
    value={formData.content_type}
    onChange={(value) => updateForm({ content_type: value as ContentType })}
    options={[
      { value: 'full_novel', label: '长篇小说' },
      { value: 'short_story', label: '短篇小说' },
      { value: 'script', label: '剧本' },
    ]}
    placeholder="选择内容类型"
  />
</div>
```

#### 影响文件
- `CreateProject.tsx`

#### 验收标准
- Select 组件功能完整
- 样式与设计系统一致
- 无障碍标签正确

---

### 8. Table + Pagination 重构数据展示（P2）

#### 问题
QualityDashboard 章节明细、ChapterList 运行历史用 div 手动排列，缺少排序、分页等表格能力。

#### 解决方案
```tsx
// QualityDashboard.tsx - 章节明细表格
<Table
  columns={[
    {
      key: 'title',
      header: '章节',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">
            {row.title || `第${row.chapter_index}章`}
          </span>
          <Badge variant="secondary">{row.status}</Badge>
        </div>
      )
    },
    {
      key: 'score',
      header: '评分',
      render: (row) => (
        <div className="w-32">
          <Progress value={row.quality_score * 10} />
          <div className="mt-1 text-sm text-right">
            {row.quality_score.toFixed(1)}
          </div>
        </div>
      )
    },
    {
      key: 'wordCount',
      header: '字数',
      render: (row) => row.word_count?.toLocaleString() || '-'
    },
    {
      key: 'createdAt',
      header: '创建时间',
      render: (row) => formatDateTime(row.created_at)
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      render: (row) => (
        <Link to={`/projects/${projectId}/write/${row.chapter_index}`}>
          <Button variant="tertiary" size="sm">编辑</Button>
        </Link>
      )
    }
  ]}
  data={chapterScores}
/>

{chapterScores.length > 10 && (
  <div className="mt-4 flex justify-end">
    <Pagination
      current={page}
      total={chapterScores.length}
      pageSize={10}
      onChange={setPage}
    />
  </div>
)}
```

#### 影响文件
- `QualityDashboard.tsx`
- `ChapterList.tsx`（运行历史表格）

#### 验收标准
- Table 组件支持 columns 配置和 render 函数
- 支持列对齐配置
- Pagination 组件工作正常

---

### 9. AgentCard 组件化智能体状态（P2）

#### 问题
ProjectOverview 中智能体状态用自定义 div 实现，AgentCard 组件未被使用。

#### 解决方案
```tsx
// ProjectOverview.tsx
<Card className="border-[var(--border-default)] p-6">
  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">智能体状态</h2>
  <div className="grid gap-4 md:grid-cols-4">
    {agentCards.map(agent => (
      <AgentCard
        key={agent.key}
        name={agent.title}
        status={agentStates[agent.key]}
        description={agent.subtitle}
      />
    ))}
  </div>
</Card>
```

#### 影响文件
- `ProjectOverview.tsx`

#### 验收标准
- AgentCard 支持 status 属性（done/running/waiting）
- 状态徽章样式与设计系统一致

---

## 组件增强摘要

| 组件 | 变更类型 | 变更内容 |
|------|---------|---------|
| Empty | 增强 | 新增 icon, title, description, action 属性 |
| Alert | 新增使用 | 在所有页面集成错误/成功/警告/信息提示 |
| Switch | 新增使用 | Settings 页面布尔设置 |
| StatsCard | 新增 | 抽象"标签+值"统计卡片模式 |
| Select | 新增使用 | CreateProject 内容类型选择 |
| Table | 新增使用 | 章节明细、运行历史表格化 |
| Pagination | 新增使用 | 表格数据分页 |
| Skeleton | 新增使用 | 所有数据加载场景 |
| Divider | 新增使用 | 替换所有手动 border-t |
| AgentCard | 新增使用 | 智能体状态展示 |

---

## 实施计划

### 任务分解（共 5 天）

**Day 1：基础组件增强**
- [ ] Empty 组件属性扩展 + 单元测试
- [ ] Divider 组件全面替换
- [ ] StatsCard 新组件开发 + 单元测试

**Day 2：反馈组件集成**
- [ ] Alert 组件在所有页面集成
- [ ] Switch 组件替换 Settings Checkbox
- [ ] Skeleton 加载状态全面应用

**Day 3：表单和数据展示**
- [ ] Select 组件替换 CreateProject 自定义单选
- [ ] Table 组件验证和增强
- [ ] Pagination 组件集成

**Day 4：组件化收尾**
- [ ] AgentCard 在 ProjectOverview 应用
- [ ] 所有 StatsCard 替换完成
- [ ] 视觉回归检查

**Day 5：测试和验证**
- [ ] 所有组件单元测试
- [ ] 页面功能冒烟测试
- [ ] 无障碍检查
- [ ] 文档更新

---

## 风险和依赖

### 风险
| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| Table 重构可能破坏现有交互 | 中 | 中 | 保持点击跳转逻辑不变，只改展示层 |
| StatsCard 样式偏差 | 低 | 低 | Storybook 截图对比 |
| 开发时间超过预期 | 中 | 低 | P2 项可延后，不阻塞发布 |

### 依赖
- 现有 v2 组件库已完整
- 所有组件已有基础 Storybook 和测试

---

## 验收标准

### 功能验收
1. ✅ 所有页面功能与重构前完全一致
2. ✅ 所有表单提交正常工作
3. ✅ 所有链接和导航正常

### 组件利用验收
4. ✅ Divider 使用率 100%（无手动 border-t）
5. ✅ Empty 组件使用率 100%（无自定义空状态）
6. ✅ Alert 覆盖所有用户反馈场景
7. ✅ Skeleton 覆盖所有数据加载场景
8. ✅ StatsCard 覆盖所有统计卡片

### 质量验收
9. ✅ 新增/修改组件的单元测试覆盖率 ≥ 90%
10. ✅ 所有测试通过
11. ✅ ESLint 无警告
12. ✅ 无障碍标签完整

---

## 后续优化（Out of Scope）

本次不包含但可后续规划：
- Tabs 组件用于内容组织
- Popover 组件用于上下文提示
- Avatar 组件用户头像展示
- 更多业务特定组件抽象（ChapterCard, WorkflowRunCard）
- 拖拽排序功能

---

## 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-04-27 | v1.0 | 初始设计文档 | Claude Code |
