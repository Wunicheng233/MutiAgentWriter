# 设置页面重设计 - MVP 设计文档

**日期：** 2026-05-05  
**作者：** StoryForge AI Team  
**状态：** 设计确认，待实现

---

## 概述

将设置页面从单页卡片布局重构为侧边栏分类导航，基于现有状态暴露更多可配置项，提升用户可定制性。

---

## 设计原则

 **只做现有状态支持的功能** - 不引入需要额外后端支持的功能  
 **最小增量改动** - 复用现有组件和状态管理  
 **渐进式增强** - 为未来可自定义快捷键预留架构空间  

---

## 整体架构

### 布局

```
┌─────────────────────────────────────────────────────────┐
│  设置                                                      │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│   外观主题  │  [ 分类内容区域 ]                      │
│  ⌨ 编辑器    │                                          │
│   快捷键    │  • 设置项卡片（Switch / Select / ...）   │
│   AI 偏好   │                                          │
│   布局      │  • 描述文字                              │
│   账户数据  │                                          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

### 导航实现

- 左侧垂直导航栏，6 个分类
- 选中分类高亮显示
- URL 带 query 参数（如 `?tab=editor`），支持直接跳转
- 移动端：顶部 Tab 切换

---

## 分类与设置项详情

### 1  外观主题

**设置项：**
- 主题选择（卡片式，3 个选项）
  - Warm Parchment（默认）
  - Clean Light
  - Deep Dark

**现有状态：** `useThemeStore` - 无需改动

---

### 2 ⌨ 编辑器模式

**设置项（均为 Switch 开关）：**

| 设置项 | 描述 | 状态来源 |
|--------|------|---------|
| **Typewriter 模式** | 光标保持在视口 1/3 处，平滑滚动 | `useLayoutStore.typewriterMode` |
| **Fade 模式** | 淡化非当前段落，聚焦当前编辑内容 | `useLayoutStore.fadeMode` |
| **Vim 模式** | 启用 Vim 键绑定，需刷新页面生效 | `useLayoutStore.vimMode` |

**UI 要求：**
- 每个开关下方有小字描述
- Vim 模式旁加警告提示："需刷新页面生效"

---

### 3  键盘快捷键

**功能：**
- 顶部搜索框，输入实时过滤快捷键
- 快捷键列表，分组展示：
  -  编辑器操作（保存、撤销等）
  -  模式切换（Typewriter / Fade / Focus / Vim）
  -  面板操作（打开/关闭 AI 面板、命令面板）
  -  导航操作（跳转到概览/章节/编辑器）
- 每项格式：`操作描述` + 右侧 `Cmd/Ctrl + 键`

**数据来源：**
- 新建静态常量文件 `src/utils/shortcuts.ts`，包含所有快捷键定义
- 无状态管理，纯展示

**快捷键列表定义：**
```typescript
export const SHORTCUTS = {
  editor: [
    { label: '保存', keys: 'Cmd + S' },
    { label: '撤销', keys: 'Cmd + Z' },
    { label: '重做', keys: 'Cmd + Shift + Z' },
  ],
  modes: [
    { label: '切换 Typewriter 模式', keys: 'Cmd + Shift + T' },
    { label: '切换 Fade 模式', keys: 'Cmd + Shift + G' },
    { label: '切换 Focus 模式', keys: 'Cmd + Shift + F' },
    { label: '切换 Vim 模式', keys: 'Cmd + Shift + V' },
  ],
  panels: [
    { label: '打开命令面板', keys: 'Cmd + K' },
    { label: '切换 AI 面板', keys: 'Cmd + \\' },
    { label: '打开 AI 面板', keys: 'Cmd + I' },
  ],
  navigation: [
    { label: '切换侧边栏', keys: 'Cmd + B' },
    { label: '切换顶栏', keys: 'Cmd + T' },
  ],
}
```

---

### 4  AI 助手偏好

**设置项：**

| 设置项 | 类型 | 选项 | 状态来源 |
|--------|------|------|---------|
| **选区 AI 默认重写模式** | Select / Dropdown | 润色、扩写、缩写、增强戏剧张力 | `useLayoutStore.defaultRewriteMode` (新增) |
| **API Key 设置** | Input + Button | 输入框 + 保存/清除按钮 | 现有（移至此处） |

---

### 5  布局设置

**设置项（均为 Switch 开关）：**

| 设置项 | 描述 | 状态来源 |
|--------|------|---------|
| **Focus 模式** | 隐藏非必要 UI 元素，聚焦写作 | `useLayoutStore.focusMode` |
| **右侧面板默认打开** | 进入项目时自动打开 AI 面板 | `useLayoutStore.defaultAIPanelOpen` |
| **顶栏自动展开** | 进入项目时自动展开顶部导航栏 | `useLayoutStore.autoExpandHeaderInProject` |

---

### 6  账户与数据

**设置项：**

| 设置项 | 类型 | 状态来源 |
|--------|------|---------|
| **账户信息** | 只读展示（用户名、邮箱） | 现有 |
| **本月使用统计** | 只读展示（有数据时显示） | 现有 |
| **清除本地缓存** | Button + 确认弹窗 | 新增（调用 zustand persist clear + localStorage.clear） |

**清除本地缓存流程：**
1. 点击按钮 → 显示确认弹窗
2. 确认 → 清除所有 zustand persist 状态 + localStorage
3. 显示 Toast："本地缓存已清除，请刷新页面"
4. 提供"立即刷新"按钮

---

## 状态管理变更

### useLayoutStore 扩展（已有基础上新增）

```typescript
interface LayoutState {
  // 已有状态
  navCollapsed: boolean
  rightPanelOpen: boolean
  rightPanelWidth: number
  rightPanelTab: RightPanelTab
  focusMode: boolean
  headerCollapsed: boolean
  autoExpandHeaderInProject: boolean
  defaultNavCollapsed: boolean
  defaultAIPanelOpen: boolean
  typewriterMode: boolean
  fadeMode: boolean
  vimMode: boolean
  commandPaletteOpen: boolean
  
  // 新增状态
  defaultRewriteMode: RewriteMode  // 选区 AI 默认模式
  
  // 新增 actions
  setDefaultRewriteMode: (mode: RewriteMode) => void
  clearAllLocalState: () => void
}
```

**持久化：** 所有状态自动通过现有 `persist` 中间件保存到 localStorage

---

## 新增文件

| 文件 | 说明 |
|------|------|
| `frontend/src/utils/shortcuts.ts` | 快捷键列表静态常量 |
| `frontend/src/components/settings/SettingsSidebar.tsx` | 设置页面侧边栏 |
| `frontend/src/components/settings/SettingsContent.tsx` | 设置内容渲染组件 |
| `frontend/src/components/settings/ShortcutList.tsx` | 快捷键列表（含搜索） |
| `frontend/src/tests/settings.test.tsx` | 新测试（替换/扩展现有） |

---

## 修改文件

| 文件 | 改动 |
|------|------|
| `frontend/src/pages/Settings.tsx` | 完整重构为侧边栏布局 |
| `frontend/src/store/useLayoutStore.ts` | 新增 `defaultRewriteMode` 和 `clearAllLocalState` |

---

## 验收标准

###  必须完成

- [ ] 设置页面采用侧边栏 + 内容区两栏布局
- [ ] 6 个分类完整实现，点击切换正确
- [ ] 每个分类下所有设置项正确渲染并可操作
- [ ] 所有设置项修改即时生效
- [ ] 状态持久化（刷新页面后保持）
- [ ] 快捷键列表可搜索过滤
- [ ] 清除本地缓存功能完整（确认弹窗 + 提示刷新）
- [ ] URL query 参数支持直接跳转到指定分类（`?tab=editor`）
- [ ] 所有现有测试通过 + 新增功能有对应测试

---

## 技术栈

- React 19 + TypeScript
- Zustand（状态管理 + persist）
- Tailwind CSS
- Vitest（测试）
