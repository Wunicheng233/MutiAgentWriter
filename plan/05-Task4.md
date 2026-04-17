# Task 4: 前端现代化与设计系统落地

## 一、任务目标

将现有的 Flask 模板渲染式前端彻底重构为**前后端分离的单页应用（SPA）**，并完整落地上一轮定义的《书香气设计系统》（DESIGN.md）。用户将通过一个专业、舒适、沉浸式的界面完成从项目创建到章节精修的完整创作流程。

**核心产出**：
1. 基于 React + TypeScript 的前端项目骨架
2. 完整映射 DESIGN.md 的 Tailwind 主题配置
3. 核心页面：书架、创作向导、写作编辑器、质量仪表盘
4. 与 Task 3 FastAPI 后端的对接（API 调用、JWT 鉴权、进度轮询）

## 二、技术选型

| 类别 | 选型 | 理由 |
|------|------|------|
| 框架 | React 18 + TypeScript | 生态成熟、类型安全、适合复杂交互 |
| 构建工具 | Vite | 启动快、配置简单 |
| 样式 | Tailwind CSS | 与 DESIGN.md 的原子化映射天然契合 |
| 路由 | React Router v6 | 标准 SPA 路由 |
| 状态管理 | Zustand | 轻量、无模板代码，适合中小型应用 |
| 服务端状态 | TanStack Query | 管理 API 缓存、加载状态、自动重试 |
| 图表 | ECharts | 百度开源，文档详尽，支持雷达图/折线图 |
| 富文本编辑 | TipTap (ProseMirror) | 支持 Markdown 快捷输入，易于扩展 |
| HTTP 客户端 | Axios | 拦截器支持 JWT 注入 |

## 三、页面结构与路由规划

```
/ (重定向到 /dashboard)

├── /login                # 登录页（朴素，仅表单）
├── /register             # 注册页

├── /dashboard            # 书架（项目卡片网格）
├── /projects/new         # 创作向导（4 步表单）
├── /projects/:id
│   ├── /overview         # 项目概览（大纲、设定、进度）
│   ├── /chapters         # 章节列表与阅读
│   ├── /write/:chapterId # 写作编辑器（核心页面）
│   └── /analytics        # 质量仪表盘（雷达图、趋势图）

├── /settings             # 用户设置（API Key、偏好）
└── /share/:token         # 只读分享页（可选，后期）
```

## 四、设计系统落地策略

### 4.1 Tailwind 主题扩展

在 `tailwind.config.js` 中完整定义 DESIGN.md 的变量：

- **颜色**：`parchment`、`inkwell`、`sage`、`terracotta`、`faded-rose`、`muted-gold` 等。
- **字体**：`font-serif: ["Crimson Pro", "Georgia", "serif"]`，`font-sans: ["Inter", ...]`。
- **阴影**：`shadow-ambient`、`shadow-standard`、`shadow-elevated` 等，使用 `rgba(60,40,20,x)`。
- **圆角**：`radius-card`、`radius-button` 等。

### 4.2 基础组件封装

在开始页面开发前，先封装以下与设计系统绑定的组件：

| 组件 | 说明 |
|------|------|
| `Button` | 支持 `variant="primary"|"secondary"|"ghost"`，自动应用 sage 配色与圆角 |
| `Card` | 半透明白色背景、软阴影、16px 圆角、边框 `#e8ddd0` |
| `Badge` | 用于 Agent 标签、状态标记，支持颜色变体 |
| `Input` / `Textarea` | 符合设计规范的输入框样式 |
| `NavBar` | 顶部导航，毛玻璃效果，包含用户菜单 |
| `ProgressBar` | 自定义样式，使用 terracotta 填充色 |
| `Modal` | 软阴影对话框 |

### 4.3 字体加载策略

- 通过 `@font-face` 或 Google Fonts 引入 Crimson Pro 和 Inter。
- 全局 CSS 设定 `body` 使用 `font-sans`，叙事文本容器使用 `font-serif`。

## 五、关键页面实现要点

### 5.1 书架页 (`/dashboard`)

- 网格布局展示项目卡片。
- 卡片内容：封面占位图、书名、最后编辑时间、进度条、质量分徽章。
- 顶部有“新建项目”按钮（sage 色）。
- 使用 TanStack Query 获取 `/api/projects` 列表，支持刷新。

### 5.2 创作向导 (`/projects/new`)

- 4 步表单：
  1. 选择内容类型（长篇/短篇/剧本）
  2. 基本信息（书名、一句话简介、目标字数）
  3. 详细需求（世界观、风格、特殊要求）
  4. 参数确认（章节数、模型选择等）
- 步骤间状态用 Zustand 暂存，最后一步提交 POST `/api/projects`。
- 创建成功后跳转至项目概览页。

### 5.3 写作编辑器 (`/projects/:id/write/:chapterId`) —— 核心

**布局**：左右分栏（Flex/Grid）
- **左侧面板（宽约 320px）**：纵向排列 8 个 Agent 卡片。
  - 每张卡片可折叠，显示 Agent 名称、状态（等待/执行中/完成/警告）。
  - 在生成过程中，状态通过 WebSocket 或进度接口实时更新。
  - 点击卡片可展开查看该 Agent 的输出摘要或详细日志。
- **右侧画布（固定宽度 720px，居中）**：
  - 使用 TipTap 编辑器，配置为 Markdown 友好模式。
  - 背景色 `parchment`，字体 `Crimson Pro`，字号 16px，行高 1.6。
  - 底部悬浮工具栏：保存状态、字数统计、请求 AI 建议、检查一致性等。

**交互细节**：
- 自动保存：内容变更后 2 秒防抖调用 PUT `/api/projects/{id}/chapters/{index}`。
- AI 辅助：选中文本后出现浮动菜单，可调用特定 Agent（如“润色选中段落”）。
- 生成进度：若章节正在生成，编辑器上方显示进度条与当前步骤文案。

### 5.4 质量仪表盘 (`/projects/:id/analytics`)

- 顶部显示总体质量评分（大数字，sage 或 terracotta 色）。
- 雷达图：展示剧情、人设、吸引力、文笔、设定 5 个维度的平均分。
- 折线图：章节评分趋势。
- 下方列表：逐章问题详情，每条包含 Critic 评语。
- 使用 ECharts 绘制，配色使用设计系统变量（通过 CSS 变量注入）。

## 六、与后端 API 对接规范

### 6.1 请求封装

- 创建 `api/client.ts`，配置 Axios 实例，`baseURL` 指向 FastAPI 地址。
- 请求拦截器：自动添加 `Authorization: Bearer {token}`。
- 响应拦截器：处理 401 跳转登录、统一错误提示。

### 6.2 JWT 存储与刷新

- 登录后 JWT 存储在 `localStorage` 或 `sessionStorage`（根据“记住我”）。
- 在 Zustand 中维护用户状态（`user` 对象、`isAuthenticated`）。
- 路由守卫：未登录访问需登录页面时重定向到 `/login`。

### 6.3 生成任务进度处理

- 触发生成后，从响应获取 `task_id`。
- 启动轮询（每 2 秒）调用 `GET /api/tasks/{task_id}`。
- 根据返回的 `progress` 和 `step` 更新 UI。
- 任务完成后，停止轮询，刷新项目章节列表。

## 七、注意事项与风险提示

1. **设计系统严格遵循**：
   - 任何自定义 CSS 都应优先考虑是否能用 Tailwind 工具类实现。
   - 确保所有颜色、阴影、圆角与 DESIGN.md 保持一致。

2. **编辑器性能**：
   - TipTap 在长文本（>5 万字）下可能存在性能问题。需测试并考虑分页加载或虚拟滚动。
   - 自动保存应避免频繁请求，使用防抖。

3. **跨域问题**：
   - 开发环境使用 Vite 代理解决 CORS。
   - 生产环境确保 FastAPI 正确配置 CORS 中间件（已在 Task 3 中要求）。

4. **响应式与移动端**：
   - 书架、设置页需适配移动布局（网格变列表，导航变汉堡菜单）。
   - 写作编辑器在移动端可考虑切换为纯阅读/简单编辑模式（高级编辑需桌面）。

5. **错误处理与加载状态**：
   - 所有 API 请求应有 loading 状态展示（骨架屏或进度条）。
   - 网络错误、服务端错误应有 Toast 提示，避免静默失败。

## 八、验收标准

- [ ] 启动前端开发服务器，可通过 `/login` 登录，跳转至 `/dashboard`。
- [ ] 书架页能正确展示从后端获取的项目列表，卡片样式符合设计规范。
- [ ] 新建项目向导 4 步走通，成功创建项目并跳转。
- [ ] 进入写作编辑器，左右布局正确，编辑器可输入并自动保存。
- [ ] 触发生成任务后，左侧 Agent 卡片状态随进度更新，右侧编辑器展示生成内容。
- [ ] 质量仪表盘雷达图、折线图正常渲染，数据与后端一致。
- [ ] 页面在桌面端（>1280px）视觉效果与设计稿高度吻合。
- [ ] 使用浏览器开发者工具模拟移动设备，书架和设置页布局自适应良好。

## 九、后续依赖

- Task 5 导出功能将基于前端增加“导出”按钮，调用后端导出 API。
- 分享功能将依赖前端只读页面 (`/share/:token`) 的实现。