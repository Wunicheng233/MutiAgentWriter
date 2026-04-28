# 人机接口（策划确认/章节确认）修复设计文档

**日期：** 2026-04-28
**状态：** 待实现
**优先级：** 🔴 P0 - 阻塞核心流程

## 1. 问题背景

### 1.1 用户反馈

> "策划确认触发但没有弹窗导致项目卡死"

### 1.2 根本原因分析

经过完整代码审计，发现 4 个相互关联的问题：

| 问题编号 | 问题描述 | 影响范围 | 严重程度 |
|---------|---------|---------|---------|
| P0-1 | 策划确认 (chapter=0) 跳转到 `/write/1`，但第1章内容为空 | 所有新用户首次体验 | 🔴 致命 |
| P0-2 | ProjectOverview 页面没有状态轮询，任务进入等待确认状态后页面不刷新 | 用户不知道需要确认，以为"卡死" | 🔴 严重 |
| P1-3 | 缺少全局通知机制，用户在其他页面时完全不知道有任务待确认 | 所有页面 | 🟡 中等 |
| P1-4 | WorkflowRunDetail 页面策划确认只显示"返回概览"，不显示"处理确认"按钮 | 调试流程 | 🟡 中等 |

### 1.3 现象复现路径

```
用户点击"开始生成"
    ↓
停留在 ProjectOverview 页面，进度条显示"Planner正在运行"
    ↓
后台 Planner 完成，抛出 WaitingForConfirmationError (chapter=0)
    ↓
任务状态变为 waiting_confirm
    ↓
⏳ 前端页面【不刷新】，用户以为还在生成中
    ↓
用户手动刷新页面
    ↓
看到"策划方案正在等待人工确认"
    ↓
点击"进入写作台" → 跳转到 /write/1
    ↓
第1章内容为空，编辑器报错"章节不存在"
    ↓
用户感知："卡死了"、"没有弹窗"
```

## 2. 修复方案

### 2.1 P0 - 核心修复（解决"卡死"问题）

#### 修复 1.1：策划确认跳转 URL

**文件：** `frontend/src/pages/ProjectOverview.tsx:164`

**修改前：**
```javascript
if (workflow?.current_chapter === 0) {
  return {
    headline: '策划方案正在等待人工确认',
    ctaHref: `/projects/${project.id}/write/1`,  // ← 错误
  }
}
```

**修改后：**
```javascript
if (workflow?.current_chapter === 0) {
  return {
    headline: '策划方案正在等待人工确认',
    ctaHref: `/projects/${project.id}/overview?confirm-plan=true`,  // ← 正确
  }
}
```

**原理：** 在 ProjectOverview 页面直接处理策划确认，不需要跳转到 Editor 页面。

---

#### 修复 1.2：在 ProjectOverview 页面添加状态轮询

**文件：** `frontend/src/pages/ProjectOverview.tsx`

新增轮询逻辑：
- 当 `project.status === 'generating'` 时，每 3 秒轮询项目状态
- 当检测到 `task.status === 'waiting_confirm'` 时：
  1. 自动停止轮询
  2. 自动刷新页面数据
  3. （可选）显示 Toast 通知"策划方案已完成，等待你的确认"

**新增依赖：**
```javascript
const queryClient = useQueryClient()

// 自动刷新任务状态
useEffect(() => {
  if (project?.status !== 'generating') return
  
  const interval = setInterval(async () => {
    await queryClient.invalidateQueries({ queryKey: ['project', project.id] })
  }, 3000)
  
  return () => clearInterval(interval)
}, [project?.id, project?.status, queryClient])
```

---

#### 修复 1.3：在 ProjectOverview 页面直接显示策划确认弹窗

**文件：** `frontend/src/pages/ProjectOverview.tsx`

新增功能：
1. 检测 URL 参数 `?confirm-plan=true`，自动打开确认弹窗
2. 使用与 Editor 页面相同的确认逻辑
3. 确认通过后，自动跳转到写作台第1章（此时第1章开始生成）

新增组件：
```javascript
const [showPlanConfirmDialog, setShowPlanConfirmDialog] = useState(false)
const [planPreview, setPlanPreview] = useState('')
const [feedbackText, setFeedbackText] = useState('')

// URL 参数触发弹窗
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  if (params.get('confirm-plan') === 'true') {
    setShowPlanConfirmDialog(true)
    // 加载策划预览
    api.get(`/projects/${projectId}/plan-preview`).then(res => {
      setPlanPreview(res.data.preview)
    })
  }
}, [projectId])
```

---

### 2.2 P1 - 体验优化

#### 优化 2.1：全局通知条（可选）

在全局布局中增加顶部通知：
- 当有 `waiting_confirm` 状态的任务时，所有页面顶部都显示通知条
- 点击直接跳转到确认位置

**位置：** `frontend/src/components/AppLayout.tsx` 或类似全局组件

---

#### 优化 2.2：WorkflowRunDetail 页面确认入口

**文件：** `frontend/src/pages/WorkflowRunDetail.tsx:433-443`

**修改前：**
```javascript
{run.status === 'waiting_confirm' && hasRelatedChapter && (
  <Link to={`/projects/${projectId}/write/${run.current_chapter}`}>
    <Button variant="primary">处理确认</Button>
  </Link>
)}

{run.status === 'waiting_confirm' && run.current_chapter === 0 && (
  <Link to={`/projects/${projectId}/overview`}>
    <Button variant="primary">返回概览</Button>
  </Link>
)}
```

**修改后：**
```javascript
{run.status === 'waiting_confirm' && run.current_chapter === 0 && (
  <Link to={`/projects/${projectId}/overview?confirm-plan=true`}>
    <Button variant="primary">处理策划确认</Button>
  </Link>
)}

{run.status === 'waiting_confirm' && hasRelatedChapter && run.current_chapter !== 0 && (
  <Link to={`/projects/${projectId}/write/${run.current_chapter}`}>
    <Button variant="primary">处理章节确认</Button>
  </Link>
)}
```

---

## 3. 验收标准

### 3.1 P0 修复验证

- [ ] 点击"开始生成"后，概览页面自动刷新任务状态
- [ ] Planner 完成后，概览页面自动显示"策划方案正在等待人工确认"
- [ ] 点击"进入写作台"跳转到正确的确认位置（概览页弹窗，不是 /write/1）
- [ ] 策划确认弹窗正确显示预览内容
- [ ] 确认通过后，任务继续执行，跳转到写作台开始生成第1章
- [ ] 确认不通过后，正确重新优化策划

### 3.2 P1 优化验证

- [ ] WorkflowRunDetail 页面策划确认状态正确显示"处理策划确认"按钮
- [ ] 点击按钮跳转到正确的确认位置
- [ ] （可选）所有页面顶部都能看到确认通知

## 4. 风险评估

| 风险项 | 影响 | 概率 | 缓解措施 |
|--------|------|------|----------|
| URL 参数冲突 | 低 | 低 | 使用明确的参数名 `confirm-plan=true` |
| 轮询导致服务器压力增加 | 低 | 极低 | 3秒间隔，且检测到 `waiting_confirm` 后立即停止 |
| 确认弹窗状态不同步 | 低 | 低 | 确认后调用 `invalidateQueries` 刷新所有相关数据 |

**总体风险等级：** 低风险，高收益
