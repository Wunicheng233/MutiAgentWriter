# 历史版本页面设计文档

**日期：** 2026-05-05  
**作者：** StoryForge AI Team  
**状态：** 设计确认，待实现

---

## 概述

将版本历史从编辑器 Inspector 面板迁移为独立的全局页面，通过左侧导航栏访问，提供更专业的版本管理和对比功能。

---

## 功能范围

###  实现内容

1. **新增导航项**
   - 左侧全局导航栏（NavRail）新增「历史版本」SVG 图标
   - 点击跳转到 `/projects/{id}/versions` 页面

2. **独立历史版本页面**
   - 章节选择下拉框
   - 版本卡片列表（按时间倒序）
   - 当前版本有  视觉标记
   - 每个版本显示：版本号、创建时间、字数、操作按钮
   - 恢复版本功能（带确认弹窗）
   - 对比版本功能

3. **双栏对比模态框**
   - 左右两侧独立的版本选择器
   - diff 差异高亮显示（绿色新增、红色删除）
   - 底部操作按钮：「恢复到旧版本」、「接受全部差异」

4. **清理旧代码**
   - 删除 Editor.tsx 中所有版本历史相关的 state 和 UI

---

## 页面设计

### URL 结构
```
/projects/{id}/versions
```

### 页面布局
```
┌─────────────────────────────────────────────────────────┐
│  历史版本                                                │
│                                                         │
│  选择章节：[ 第 1 章：xxx ▼]                           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │   V3 · 当前版本                               │   │
│  │     2026-05-05 15:30 · 2180 字 · 手动保存      │   │
│  │                                         [对比]  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │     V2                                          │   │
│  │     2026-05-05 12:15 · 2150 字 · AI 生成       │   │
│  │                     [恢复此版本]          [对比] │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 双栏对比模态框
```
┌─────────────────────────────────────────────────────────┐
│  版本对比                                   [×] 关闭  │
├───────────────────────────┬─────────────────────────────┤
│  旧版本：V2               │  新版本：V3 · 当前           │
│  [下拉选择版本]           │  [下拉选择版本]             │
├───────────────────────────┼─────────────────────────────┤
│                           │                             │
│  他用右手拔剑             │  他用**左手**拔剑           │
│  走向门口                 │  走向门口                    │
│                           │  心里默念咒语   新增       │
│  开门出去                 │  开门出去                    │
│                           │                             │
├───────────────────────────┴─────────────────────────────┤
│  [恢复到 V2]                          [接受全部差异]    │
└─────────────────────────────────────────────────────────┘
```

---

## 组件结构

```
frontend/src/
├── pages/
│   └── ProjectVersions.tsx          # 历史版本主页面
│
├── components/version/
│   ├── VersionCard.tsx              # 单个版本卡片
│   └── VersionCompareModal.tsx      # 双栏对比模态框
│
└── hooks/
    └── useVersions.ts               # 版本数据查询 Hook
```

---

## 需要删除的旧代码

**`Editor.tsx` 中删除：**
- `showVersionHistory` state
- `versions` state
- `loadVersions` 函数
- `handleRestore` 函数
- `toggleVersionHistory` 函数
- Inspector 面板中的版本历史按钮和卡片

---

## 数据 API（已存在）

```typescript
// utils/endpoints.ts
export async function listChapterVersions(
  projectId: number,
  chapterIndex: number
): Promise<{ versions: ChapterVersionInfo[] }>

export async function getChapterVersion(
  projectId: number,
  chapterIndex: number,
  versionId: number
): Promise<ChapterVersionDetail>

export async function restoreChapterVersion(
  projectId: number,
  chapterIndex: number,
  versionId: number
): Promise<Chapter>
```

---

## SVG 图标

**HistoryIcon（时钟/历史图标）**：
```svg
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <polyline points="12 6 12 12 16 14"/>
</svg>
```

---

## 验收标准

- [ ] 全局导航栏（NavRail）新增「历史版本」SVG 图标
- [ ] 点击图标跳转到 `/projects/{id}/versions` 页面
- [ ] 页面顶部有章节选择下拉框
- [ ] 当前版本有明显的视觉标记（ 或特殊样式）
- [ ] 点击「恢复此版本」有确认弹窗，恢复后显示成功提示
- [ ] 点击「对比」弹出双栏模态框，差异高亮显示
- [ ] 可以在对比视图中切换左右两个版本
- [ ] Editor 页面中所有旧的版本历史代码已删除
- [ ] 空状态、加载状态、错误状态完整处理
- [ ] 所有测试通过

---

## 技术栈

- React 19 + TypeScript
- TanStack Query（数据请求）
- Tailwind CSS
- Zustand（如需要状态管理）
- 使用现有 `textDiff.ts` 进行差异渲染
