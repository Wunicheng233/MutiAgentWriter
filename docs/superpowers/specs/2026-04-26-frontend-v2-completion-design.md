# StoryForge AI - v2 组件库完整化设计文档

> 日期: 2026-04-26
> 目标: 完成 v2 组件库全量建设和前端页面完整迁移，确保设计系统统一、所有功能可用、工程化完备。

## 背景与现状

### 当前状态
-  v2 组件库已包含 19 个基础组件 + 2 个 hooks
-  所有主要页面已完成 v2 组件 import 迁移
-  203 个测试全部通过
-  Toast 导出链修复完成
-  Badge 向后兼容变体已添加
-  Button/Checkbox 代码质量问题已修复

### 遗留问题
1. 未进行实际浏览器视觉验证
2. 缺失 Slider/Table/Pagination/Empty 等通用组件
3. AgentCard/SkillSelector/ThemeSelector 尚未迁移到 v2
4. Storybook stories 部分缺失
5. 组件动画和无障碍支持尚不完善

## 总体架构

### 执行策略
**方案 1：自下而上，组件优先**
- Phase 0: 视觉验证 + 快速修复 → 建立基线
- Phase 1: 缺失组件补全 → 完善组件库
- Phase 2: 组件库增强 → 提升体验
- Phase 3: 特殊页面组件重构 → 统一设计语言
- Phase 4: 工程化 & 文档 → 可维护性

### 设计原则
1. **设计令牌驱动**：所有样式从 CSS 变量派生 (`--bg-primary`, `--accent-primary` 等)
2. **TypeScript 优先**：完整类型定义，不使用 `any`
3. **无障碍友好**：ARIA 属性 + 键盘导航 + 焦点管理
4. **测试覆盖**：每个组件至少 3 个测试用例
5. **YAGNI**：不做过度设计，只实现当前需求

---

## Phase 0: 视觉验证 & 快速修复

### 目标
确保开发服务器能正常启动，所有页面能打开，基础交互可用，修复明显的视觉问题。

### 检查清单
| 页面 | 检查项 |
|------|--------|
| **Login / Register** | Card 边框、Input 聚焦状态、Button hover 效果、字体层级 |
| **Dashboard** | 项目卡片间距、Badge 颜色匹配、Progress 高度、整体网格对齐 |
| **Create Project** | Step 按钮激活态、Form label 对齐、Content 边距 |
| **Project Overview** | AgentCard 徽章、Tabs 下划线、工作流进度条 |
| **Settings** | ThemeSelector 按钮样式、API Key Input 状态 |
| **Editor** | 工具栏对齐、右侧面板卡片、编辑区字体 |
| **Quality Dashboard** | 图表卡片内边距、统计数字字体大小 |

### 修复原则
- **快速修复**：10分钟内能解决的问题 → 直接修复
- **记录延后**：超过10分钟 → 创建 issue，后续阶段统一处理
- **不碰业务逻辑**：只修改样式和布局相关代码

### 验收标准
- [ ] `npm run dev` 启动无报错
- [ ] 所有页面正常打开无白屏
- [ ] 无明显 CSS 崩坏（样式完全错乱、布局溢出等）
- [ ] 基础交互可用：按钮点击、Input 输入、Tab 切换
- [ ] 203 个测试保持全通过

---

## Phase 1: 缺失组件补全

### 1. Slider 滑块组件

#### 功能需求
- 基础范围选择：min = 0, max = 100
- 支持 `step` 属性（精度 0.1）
- 左侧显示 label，右侧显示当前 value
- Disabled 状态（透明度 0.5，不可交互）
- 支持受控模式 (`value` + `onChange`)

#### 视觉规范
```css
/* 轨道 */
height: 4px;
border-radius: 2px;
background: var(--bg-tertiary);

/* 激活部分 */
background: var(--accent-primary);

/* 滑块 */
width: 16px;
height: 16px;
border-radius: 50%;
background: var(--accent-primary);
box-shadow: 0 2px 4px rgba(0,0,0,0.2);
transition: transform 0.1s ease-out;

/* 滑块悬停 */
transform: scale(1.2);
```

#### API 设计
```tsx
interface SliderProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange?: (value: number) => void;
  label?: string;
  showValue?: boolean;
  className?: string;
}
```

### 2. Table 数据表格组件

#### 功能需求
- 基础结构：thead + tbody
- 斑马纹（可选，默认关闭）
- Hover 行高亮
- 支持自定义单元格渲染（允许传入任意 ReactNode）
- 空状态兜底（配合 Empty 组件）

#### 视觉规范
```css
/* 表头 */
background: var(--bg-secondary);
font-weight: 500;
padding: 12px 16px;
border-bottom: 2px solid var(--border-default);

/* 单元格 */
padding: 12px 16px;
border-bottom: 1px solid var(--border-default);

/* Hover 行 */
background: var(--bg-tertiary);
```

#### API 设计
```tsx
interface Column<T> {
  key: string;
  title: React.ReactNode;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  columns: Column<T>[];
  dataSource: T[];
  rowKey?: string;
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

### 3. Pagination 分页组件

#### 功能需求
- 上一页/下一页按钮
- 页码按钮（最多显示 5 个，超出用 "..." 代替）
- 当前页高亮
- Disabled 状态（第一页时左箭头禁用，最后一页时右箭头禁用）

#### 视觉规范
- 按钮：圆角 `var(--radius-sm)`，高度 32px，宽度 32px
- 默认态：透明背景，`var(--text-body)`
- Hover：`var(--bg-tertiary)`
- 当前页：`var(--accent-primary)` 背景 + 白色文字
- Disabled：透明度 0.4，无光标

#### API 设计
```tsx
interface PaginationProps {
  current: number;
  total: number;
  pageSize?: number;
  onChange?: (page: number) => void;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  className?: string;
}
```

### 4. Empty 空状态组件

#### 功能需求
- SVG 简约图标（文档/文件夹/列表三种可选）
- 主标题 + 副标题
- 可选操作按钮（如"创建项目"）

#### 视觉规范
- 垂直居中布局，最大宽度 320px
- 图标颜色：`var(--text-muted)`，大小 64px × 64px
- 主标题：18px，medium weight，`var(--text-primary)`
- 副标题：14px，`var(--text-secondary)`
- 按钮：`margin-top: 24px`

#### API 设计
```tsx
interface EmptyProps {
  icon?: 'document' | 'folder' | 'list' | React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}
```

### Phase 1 验收标准
- [ ] 4 个组件全部实现
- [ ] 每个组件至少 3 个测试用例
- [ ] 每个组件至少 1 个 Storybook story
- [ ] 正确导出到 `v2/index.ts`
- [ ] TypeScript 类型完整无报错
- [ ] 所有 203+ 测试保持通过

---

## Phase 2: 组件库增强

### 动画增强
为下列浮层组件添加进入/退出过渡动画：
- **Modal**：淡入淡出 + 垂直位移（0 → -8px → 0）
- **Dropdown Menu**：同上，但位移 4px
- **Tooltip / Popover**：同上
- 使用 CSS `transition` + `opacity` + `transform`
- 时长：150ms，缓动：ease-out

### 无障碍优化
- **ARIA 属性**：补全 `aria-label`, `aria-expanded`, `aria-hidden`
- **键盘导航**：Tab/Shift+Tab 顺序正确，Enter/Space 触发，Esc 关闭浮层
- **焦点管理**：Modal 打开时焦点锁定，关闭后焦点返回触发元素
- **焦点可见性**：键盘导航时显示 focus ring，鼠标操作不显示

### Dark Mode 完善
- 检查所有组件在暗色模式下的对比度
- 确保满足 WCAG 2.1 AA（文字对比度 ≥ 4.5:1）
- 为暗色模式优化阴影（降低不透明度）

### 响应式变体
- 移动端断点：768px
- Input 最小高度：48px
- Button 最小点击区域：44px × 44px
- Card padding：水平方向适当缩减

### Loading 统一规范
- 所有支持 loading 状态的组件使用统一 spinner：
  - 大小：16px × 16px
  - 边框：2px，`currentColor`
  - 动画：1s 线性旋转无限循环

---

## Phase 3: 页面深度重构

### AgentCard 重构
- 容器：`v2/Card`，padding: 16px
- 状态：`v2/Badge` + 左侧小圆点
- 状态颜色映射：idle(灰色), running(琥珀), done(绿色), error(红色)
- 动画：状态变化时有 300ms 颜色过渡

### SkillSelector 重构
- 使用 `v2/CheckboxGroup` 渲染技能列表
- 强度调节：`v2/Slider`
- 分组标题：14px，`var(--text-secondary)`，字重 500
- 技能卡片间距：gap = 12px

### ThemeSelector 重构
- 三种主题选项并排显示
- 每个选项：颜色预览圆 + 文字标签
- 选中态：边框高亮 + Check 图标
- 使用 `v2/Button` 的变体模式

### NavRail 增强
- 菜单项 hover：轻微放大（1.05 倍），背景色变浅
- 激活项：平滑高亮过渡
- 展开/收起：宽度 200ms ease-out 过渡

---

## Phase 4: 工程化 & 文档

### Storybook 补全
- 每个 v2 组件至少 1 个基础 story
- 关键状态 variants 展示（如 disabled, loading）
- 复杂交互组件（如 Modal, Select）展示完整流程

### 组件文档
创建 `frontend/src/components/v2/README.md`，包含：
- 安装与引入方式
- 设计系统概览（CSS 变量说明）
- 每个组件的 API 表
- 最佳实践（组合模式、受控 vs 非受控）

### E2E 测试
Playwright 覆盖 3 个关键流程：
1. 登录流程 → 进入 Dashboard
2. 创建项目 → 填写表单 → 提交成功
3. 项目概览 → 切换 Tabs → 触发生成

---

## 整体验收标准

### 完成度
- [ ] Phase 0 - Phase 4 全部执行完毕
- [ ] 所有组件在 light/dark 模式下视觉一致
- [ ] 无 TypeScript 类型错误
- [ ] 所有测试通过（≥ 220 个）

### 质量标准
- 代码风格与现有 v2 组件保持一致
- 无 `any` 类型使用
- 无 `eslint-disable-next-line` 注释
- 新增组件有完整 JSDoc 注释

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Phase 0 发现大量视觉问题 | 中 | 高 | 先记录，筛选高优先级修复，其余后续阶段分批处理 |
| Table 组件复杂度超出预期 | 低 | 中 | 第一版只实现基础功能，高级特性（排序、固定列等）后续按需添加 |
| 重构 AgentCard 影响业务逻辑 | 中 | 中 | 先保留原组件，新组件命名为 `AgentCardV2`，稳定后替换 |

---

## 阶段依赖关系

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4
   │         │
   ▼         ▼
  基线     组件库
  确认      完整
```

- Phase 0 是所有后续工作的前提（必须确认当前基线状态）
- Phase 1 组件库完整是 Phase 3 页面重构的依赖
- Phase 2 与 Phase 3 可以部分并行（先做动画，无障碍可以延后）
