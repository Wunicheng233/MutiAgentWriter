# StoryForge AI 组件库 v2 设计规范

**日期**: 2026-04-26  
**版本**: v2.0  
**状态**: 设计定稿  
**作者**: UI Design System Team

---

## 1. 项目背景

### 1.1 现状分析

StoryForge AI 当前有一套基础的组件系统，但存在以下问题：

- 组件状态覆盖不全（缺少 loading、error 等状态）
- 可配置性弱，多处硬编码样式
- 缺少高频基础组件（Modal、Tooltip、Checkbox、Skeleton 等）
- 动画缓动曲线和时长不统一，缺乏品牌感
- 无统一的组件文档和可视化预览

### 1.2 重构目标

-  **渐进式零风险重构**：新组件与旧组件并行，不做破坏性改动
-  **企业级可扩展架构**：支持未来 3-5 年的业务发展
-  **完整的Design Tokens系统**：统一所有视觉参数
-  **Storybook 可视化文档**：提升团队协作效率
-  **高测试覆盖率**：每个组件都有完整的测试保障

---

## 2. 架构设计

### 2.1 目录结构

```
frontend/src/components/
├── v2/                          # 新组件库（独立命名空间）
│   ├── themes/                  # Design Tokens
│   │   ├── tokens.css           # 全局设计变量
│   │   ├── animation.css        # 动画系统
│   │   └── elevation.css        # 阴影层级
│   ├── Button/
│   │   ├── Button.tsx           # 组件实现
│   │   ├── Button.test.tsx      # 单元测试
│   │   ├── Button.stories.tsx   # Storybook文档
│   │   └── index.ts             # 导出
│   ├── Card/
│   ├── Input/
│   ├── Modal/
│   ├── Tooltip/
│   ├── Checkbox/
│   ├── Radio/
│   ├── Badge/
│   ├── Progress/
│   └── Skeleton/
├── ...                          # 现有组件保持不变
└── layout/                      # 布局组件后续迁移
```

### 2.2 七层扩展架构

为了保障 3-5 年的可扩展性，采用七层扩展设计：

1. **Token层扩展**：新增主题仅需覆盖 CSS 变量
2. **变体扩展**：新增组件变体仅需加一行配置
3. **组合式API**：组件拆分为可独立替换的子部件
4. **Props透传**：自动支持所有原生HTML属性
5. **as Child模式**：与任意第三方组件无缝组合
6. **ClassName覆盖**：预留1%的逃生口给特殊场景
7. **Headless分离**：逻辑层与样式层完全解耦

---

## 3. Design Tokens 系统

### 3.1 间距系统（8px基准）

```css
--space-1: 4px    /* 微间距 - 图标内边距 */
--space-2: 8px    /* 小间距 - 标签内边距 */
--space-3: 12px   /* 中间距 - 按钮内边距 */
--space-4: 16px   /* 标准间距 - 卡片内边距 */
--space-5: 20px   /* 中等偏大 */
--space-6: 24px   /* 大间距 - 区块外边距 */
--space-8: 32px   /* 很大间距 */
--space-10: 40px  /* 超大间距 */
--space-12: 48px  /* 页头页脚 */
--space-16: 64px  /* 页面顶部留白 */
```

### 3.2 圆角系统

```css
--radius-sm: 4px     /* 复选框、小标签 */
--radius-md: 8px     /* 按钮、输入框 */
--radius-lg: 12px    /* 卡片、弹窗 */
--radius-xl: 16px    /* 大卡片、面板 */
--radius-2xl: 24px   /* 导航栏、特殊面板 */
--radius-full: 9999px /* 胶囊、圆形 */
```

### 3.3 阴影层级系统（6层级）

```css
--shadow-xs: 0 1px 2px rgba(60, 40, 20, 0.03)    /* 近地面层 */
--shadow-sm: 0 2px 8px rgba(60, 40, 20, 0.05)    /* 悬浮层 - 按钮默认 */
--shadow-md: 0 4px 16px rgba(60, 40, 20, 0.07)   /* 卡片层 - 普通卡片 */
--shadow-lg: 0 8px 24px rgba(60, 40, 20, 0.1)    /* 悬停层 - 卡片hover */
--shadow-xl: 0 12px 32px rgba(60, 40, 20, 0.14)  /* 弹出层 - 下拉/tooltip */
--shadow-2xl: 0 24px 48px rgba(60, 40, 20, 0.2)  /* 顶级层 - 模态框 */
```

### 3.4 动画系统

```css
/* 缓动曲线 */
--ease-linear: linear
--ease-in: cubic-bezier(0.4, 0, 1, 1)        /* 进入加速 */
--ease-out: cubic-bezier(0, 0, 0.2, 1)       /* 退出减速 (推荐) */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)  /* 标准过渡 */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)  /* 弹性回弹 */

/* 时长 */
--duration-fast: 150ms     /* 按钮按压、tooltip */
--duration-normal: 200ms   /* hover、颜色过渡 */
--duration-slow: 300ms     /* 页面过渡、模态框 */
--duration-slower: 400ms   /* 复杂动画、骨架屏闪烁 */
--duration-slowest: 500ms  /* 大尺寸元素过渡 */
```

### 3.5 排版系统

```css
--font-heading: 'Noto Serif SC', 'Crimson Pro', Georgia, serif
--font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif

--text-xs: 12px
--text-sm: 14px
--text-base: 16px
--text-lg: 18px
--text-xl: 20px
--text-2xl: 24px
--text-3xl: 32px

--leading-tight: 1.25
--leading-normal: 1.5
--leading-relaxed: 1.75
```

### 3.6 颜色系统

**沿用现有颜色方案，零改动迁移**：

- 温暖羊皮纸（默认）
- 简洁亮色
- 深色模式

---

## 4. 核心组件API规范

### 4.1 Button 按钮

```typescript
type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children: ReactNode
}
```

**交互状态**：
- Default → Hover（上移2px + 阴影增强）→ Active（回到原位）
- Focus（2px光晕）→ Disabled（opacity 50%）→ Loading（旋转Spinner）

---

### 4.2 Card 卡片

```typescript
type CardVariant = 'default' | 'outlined' | 'elevated'
type CardPadding = 'none' | 'sm' | 'md' | 'lg'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: CardPadding
  hoverable?: boolean
  onClick?: () => void
  children: ReactNode
}
```

**Hover动效**：上移4px + 阴影升级 + 边框色变化，200ms ease-out

---

### 4.3 Input 输入框

```typescript
type InputSize = 'sm' | 'md' | 'lg'
type InputStatus = 'default' | 'error' | 'success'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  placeholder?: string
  size?: InputSize
  status?: InputStatus
  errorMessage?: string
  prefix?: ReactNode
  suffix?: ReactNode
  disabled?: boolean
  fullWidth?: boolean
}
```

---

### 4.4 Modal 模态框（新增）

```typescript
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  maskClosable?: boolean
  closable?: boolean
  centered?: boolean
}
```

**动效**：250ms ease-out，背景淡入 + 弹窗缩放+位移组合动画

---

### 4.5 Tooltip 文字提示（新增）

```typescript
type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: string
  placement?: TooltipPlacement
  children: ReactElement
  delay?: number
}
```

---

### 4.6 Checkbox / Radio（新增）

```typescript
interface CheckboxProps {
  checked?: boolean
  disabled?: boolean
  indeterminate?: boolean
  onChange?: (checked: boolean) => void
  children?: ReactNode
}
```

---

### 4.7 Skeleton 骨架屏（新增）

```typescript
interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular'
  width?: number | string
  height?: number | string
  animation?: 'pulse' | 'wave' | false
  rows?: number
}
```

---

## 5. Storybook 配置

### 5.1 启用的Addon

- `@storybook/addon-controls` - 可视化Props编辑
- `@storybook/addon-actions` - 点击事件日志
- `@storybook/addon-a11y` - 无障碍检测
- `@storybook/addon-themes` - 3套主题一键切换
- `@storybook/addon-viewport` - 响应式预览

### 5.2 Story编写规范

每个组件至少包含：
- Default - 基础展示
- Variants - 所有变体一览
- States - 各种状态（禁用/加载等）
- Playground - 可交互演示

---

## 6. 测试策略

### 6.1 测试覆盖目标

| 指标 | 目标值 |
|------|-------|
| 语句覆盖率 | ≥ 90% |
| 分支覆盖率 | ≥ 85% |
| 函数覆盖率 | ≥ 95% |
| 行覆盖率 | ≥ 90% |

### 6.2 每个组件必须覆盖的场景

1. 渲染测试
2. Props应用测试
3. 各状态测试（loading/disabled等）
4. 交互测试（onClick/onChange）
5. 无障碍测试（axe）

---

## 7. 迁移策略

### 阶段一：基础建设（0风险）

1. 创建 `v2/` 目录，不影响现有代码
2. 实现Design Tokens CSS文件
3. 配置Storybook
4. 实现Button + Card + Input（3个最常用组件）

**预计工时**: 6小时

### 阶段二：补充完善（低风险）

1. 实现Modal/Tooltip/Checkbox/Radio/Skeleton/Badge
2. 每个组件完成后，可选地替换旧引用
3. 新旧组件并行可用

**预计工时**: 11小时

### 阶段三：全面切换（可控风险）

1. 提供codemod脚本自动批量替换
2. 按页面逐个迁移测试
3. 全部验证通过后删除旧组件

**预计工时**: 4小时

---

## 8. 组件优先级清单

| 优先级 | 组件 | 预计工时 | 阶段 |
|--------|------|---------|------|
|  P0 | Button | 2h | 阶段一 |
|  P0 | Card | 1.5h | 阶段一 |
|  P0 | Input/Textarea | 2.5h | 阶段一 |
|  P1 | Modal | 3h | 阶段二 |
|  P1 | Badge | 1h | 阶段二 |
|  P1 | Tooltip | 2h | 阶段二 |
|  P1 | Checkbox | 1.5h | 阶段二 |
|  P1 | Radio | 1.5h | 阶段二 |
|  P2 | Skeleton | 2h | 阶段二 |
|  P2 | Progress | 1h | 阶段二 |
|  P3 | Tabs | 2h | 后续 |
|  P3 | Select | 3h | 后续 |

---

## 9. 设计原则

所有v2组件必须遵守：

1.  **纯CSS动画**：不依赖JS，性能更好
2.  **硬件加速**：使用transform而非top/left
3.  **尊重用户偏好**：检测prefers-reduced-motion关闭动效
4.  **主题适配**：所有颜色100%使用CSS变量
5.  **无障碍**：完整ARIA标签 + keyboard导航
6.  **TypeScript优先**：严格类型，不使用any
7.  **向后兼容**：只做增量，不做破坏性改动
8.  **单一职责**：每个文件 ≤ 300行

---

## 10. 版本承诺

- v2.x 版本永远保持向后兼容
- 永远不删除已有的Props，只做新增
- 提供codemod脚本辅助大版本迁移
- 新旧组件长期并行，不设强制迁移deadline

---

## 附录

### A. 可视化预览

完整的Design Tokens可视化预览请查看：`frontend/tokens-preview.html`

### B. 参考资料

- [Radix UI 设计原则](https://www.radix-ui.com/)
- [MUI 组件库架构](https://mui.com/)
- [Ant Design 设计规范](https://ant.design/)
