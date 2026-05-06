# 键盘快捷键与无干扰模式 - 设计文档

**日期：** 2026-05-05  
**作者：** StoryForge AI Team  
**状态：** 设计确认，待实现

---

## 概述

在现有基础快捷键系统上，扩展四种无干扰写作模式和命令面板，提供专业级写作体验。

---

## 功能范围

### ✅ MVP 实现内容

1. **Typewriter 模式**
   - 光标保持在视口上方 1/3 黄金分割点
   - 滚动页面而非移动光标
   - 快捷键：`Cmd/Ctrl + Shift + T`

2. **Fade 模式**
   - 当前段落 100% 不透明
   - 相邻段落 70% 不透明（柔和过渡）
   - 其他段落 50% 不透明
   - 快捷键：`Cmd/Ctrl + Shift + G`

3. **Vim 键绑定（可选）**
   - 使用 `@tiptap/extension-vim`
   - 默认关闭，设置页面可开关
   - 支持 Normal / Insert / Visual 模式
   - 快捷键：`Cmd/Ctrl + Shift + V`

4. **命令面板 (Cmd+K)**
   - 全局触发：`Cmd/Ctrl + K`
   - 居中模态框，搜索过滤
   - 键盘上下选择，回车执行
   - 包含所有模式切换和面板操作

5. **编辑器底部状态栏**
   - 显示当前模式状态（Typewriter / Fade / Focus / Vim）
   - 点击可切换
   - 右下角显示 `Cmd+K` 提示

---

## 状态架构

### Zustand Store 扩展

**`useLayoutStore.ts` 新增状态：**

```typescript
interface LayoutState {
  // 现有状态
  focusMode: boolean
  
  // 新增状态
  typewriterMode: boolean
  fadeMode: boolean
  vimMode: boolean
  commandPaletteOpen: boolean
  
  // 新增 actions
  toggleTypewriterMode: () => void
  toggleFadeMode: () => void
  toggleVimMode: () => void
  setCommandPaletteOpen: (open: boolean) => void
}
```

**持久化**：所有状态通过 `zustand/middleware/persist` 保存在 localStorage

---

## 组件结构

```
frontend/src/
├── hooks/
│   ├── useKeyboardShortcuts.ts    # 扩展 - 新增 Cmd+K 和模式快捷键
│   ├── useTypewriterMode.ts       # 新增 - 打字机模式逻辑
│   └── useFadeMode.ts             # 新增 - 淡化模式逻辑
│
├── components/
│   ├── CommandPalette/
│   │   └── CommandPalette.tsx     # 新增 - Cmd+K 命令面板
│   │
│   └── editor/
│       └── EditorStatusBar.tsx    # 新增 - 编辑器底部状态栏
│
└── pages/
    └── Editor.tsx                 # 修改 - 集成新功能
```

---

## 功能详细设计

### 1. Typewriter 模式

**实现原理：**
- TipTap Editor 的 `onUpdate` 回调监听光标变化
- 使用 `view.coordsAtPos()` 获取当前光标屏幕坐标
- 计算需要滚动的距离，使光标保持在视口上方 33%
- 使用 `window.scrollTo()` 或编辑器容器滚动

**边界处理：**
- 文档开头不滚动（避免顶部空白）
- 文档结尾不滚动（避免底部空白）
- 只在编辑器有焦点时生效

**快捷键：** `Cmd/Ctrl + Shift + T`

---

### 2. Fade 模式

**实现原理：**
- TipTap Plugin 监听 `selectionUpdate`
- 给当前段落添加 CSS 类 `is-active-paragraph`
- 给相邻段落添加 CSS 类 `is-adjacent-paragraph`
- CSS 控制透明度

**CSS 样式：**
```css
.fade-mode-active p {
  opacity: 0.5;
  transition: opacity 150ms ease-out;
}

.fade-mode-active p.is-adjacent-paragraph {
  opacity: 0.7;
}

.fade-mode-active p.is-active-paragraph {
  opacity: 1;
}
```

**快捷键：** `Cmd/Ctrl + Shift + G`

---

### 3. Vim 模式

**依赖：** `@tiptap/extension-vim`

**实现原理：**
- 编辑器 `extensions` 数组中条件加载 Vim 扩展
- 通过 `useLayoutStore` 的 `vimMode` 状态控制是否启用
- 底部状态栏显示当前模式（NORMAL / INSERT / VISUAL）

**冲突处理：**
- 编辑器有焦点时，Vim 单键优先
- 带修饰键的全局快捷键（`Cmd+K` 等）不受影响
- `Esc` 退出插入模式，不关闭弹窗（除非弹窗明确处理）

**快捷键切换：** `Cmd/Ctrl + Shift + V`

---

### 4. 命令面板

**触发方式：**
- 全局快捷键 `Cmd/Ctrl + K`
- 点击编辑器状态栏 `Cmd+K` 按钮

**命令列表：**
```typescript
const commands = [
  { id: 'typewriter', label: '切换 Typewriter 模式', shortcut: '⌘⇧T', action: toggleTypewriterMode },
  { id: 'fade', label: '切换 Fade 模式', shortcut: '⌘⇧G', action: toggleFadeMode },
  { id: 'focus', label: '切换 Focus 模式', shortcut: '⌘⇧F', action: toggleFocusMode },
  { id: 'vim', label: '切换 Vim 模式', shortcut: '⌘⇧V', action: toggleVimMode },
  { id: 'ai-panel', label: '打开/关闭 AI 面板', shortcut: '⌘I', action: toggleRightPanel },
]
```

**交互：**
- 打开时自动聚焦搜索框
- 键盘 `↑` `↓` 选择
- `Enter` 执行并关闭
- `Esc` 关闭
- 点击外部关闭

---

### 5. 编辑器底部状态栏

**UI 布局：**
```
┌─────────────────────────────────────────────────────────────┐
│  📠 Typewriter  |  👁️ Fade  |  🎯 Focus  |  🅥 Vim: OFF    │
│                                                         ⌘K  │
└─────────────────────────────────────────────────────────────┘
```

**交互：**
- 每个模式标签点击切换
- 激活状态高亮（文字颜色 + 背景色）
- Vim 模式显示当前子状态（NORMAL / INSERT / VISUAL）
- 右下角 `⌘K` 按钮打开命令面板

---

## 快捷键总表

| 快捷键 | 功能 | 作用域 |
|--------|------|--------|
| `Cmd/Ctrl + K` | 打开命令面板 | 全局 |
| `Cmd/Ctrl + Shift + T` | 切换 Typewriter 模式 | 全局 |
| `Cmd/Ctrl + Shift + G` | 切换 Fade 模式 | 全局 |
| `Cmd/Ctrl + Shift + F` | 切换 Focus 模式 | 全局（已有） |
| `Cmd/Ctrl + Shift + V` | 切换 Vim 模式 | 全局 |

---

## 验收标准

- [ ] Typewriter 模式：光标保持在视口上方 1/3，滚动平滑
- [ ] Fade 模式：当前段落高亮，其他段落淡化，过渡自然
- [ ] Vim 模式：可开关，Normal/Insert/Visual 模式正常工作
- [ ] 命令面板：`Cmd+K` 打开，可搜索选择执行命令
- [ ] 状态栏：显示所有模式状态，点击可切换
- [ ] 所有快捷键冲突处理正确（输入框内不触发）
- [ ] 模式状态持久化（刷新页面后保持）
- [ ] 所有新增功能有完整的单元测试
- [ ] 所有现有测试通过（381+）

---

## 技术栈

- **React 19** + **TypeScript**
- **TipTap** v2 + `@tiptap/extension-vim`
- **Zustand** 状态管理（persist 中间件）
- **Tailwind CSS**
- **Vitest** 测试框架
