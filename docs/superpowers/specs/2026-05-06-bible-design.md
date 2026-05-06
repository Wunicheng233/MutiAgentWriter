# 模块 3：角色与设定 Bible 设计文档

**日期：** 2026-05-06
**状态：** 设计确认，待实现
**版本：** 1.0

---

## 一、概述

### 功能定位
独立的角色、世界观、情节设定管理页面，与正文编辑器深度联动，支持从策划文档自动提取设定，提供快速操作入口。

### 设计原则
1. **独立页面** — 通过 NavRail 导航进入，不占用编辑器空间
2. **自动解析 + 手动编辑** — AI 从策划文档提取设定，用户可自由修改
3. **Phase 1 最小可用** — 先实现核心管理功能，高亮和一致性检测 Phase 2 再做
4. **编辑器联动** — 在 Bible 操作后自动跳转到编辑器执行 AI 改写

---

## 二、信息架构

### 2.1 页面结构
```
Bible 独立页面
├── 顶部导航
│   ├── 🔍 全局搜索框
│   └── ➕ 快速新增按钮
├── 标签页切换
│   ├── 👤 角色设定
│   ├── 🌍 世界观设定
│   ├── 📝 情节设定
│   └── ❓ 待办事项
└── 底部固定区域
    └── ⚠️ 一致性提醒 (Phase 2)
```

### 2.2 数据流
```
Project.bible (后端存储)
    ↓
useBibleStore (Zustand 状态管理)
    ↓
BiblePage (页面容器)
    ├─ CharactersTab (角色列表 + 编辑)
    ├─ WorldTab (世界观设置)
    ├─ PlotTab (情节设定)
    └─ TodosTab (待办列表)
    ↓
    └─→ Editor 跳转 (点击"用此角色重写" → SelectionAI)
```

---

## 三、数据结构

### 3.1 Bible 主结构
```typescript
interface Bible {
  version: 1                      // 版本号，便于未来数据迁移
  characters: Character[]         // 角色列表
  world: WorldSetting             // 世界观设定
  plot: PlotSetting               // 情节设定
  todos: TodoItem[]               // 待办事项
}
```

### 3.2 角色设定
```typescript
interface Character {
  id: string
  name: string
  alias?: string[]                  // 别名/昵称
  role: CharacterRole               // 角色定位
  personality?: string              // 性格描述
  appearance?: string               // 外貌描述
  background?: string               // 背景故事
  catchphrase?: string              // 口头禅
  goals?: string                    // 目标/动机
  conflicts?: string                // 内心冲突
  relationships?: Relationship[]    // 人物关系
  tags?: string[]                   // 标签（用于筛选）
  isMainCharacter?: boolean         // 是否主角
  createdAt: string
  updatedAt: string
}

type CharacterRole = 
  | 'protagonist'    // 主角
  | 'deuteragonist'  // 重要配角
  | 'antagonist'     // 反派
  | 'support'        // 次要配角
  | 'npc'            // 路人角色

interface Relationship {
  characterId: string
  type: 'friend' | 'lover' | 'enemy' | 'family' | 'mentor' | 'other'
  description: string
}
```

### 3.3 世界观设定
```typescript
interface WorldSetting {
  powerSystem?: string              // 力量体系描述
  locations?: Location[]            // 地理设定
  timeline?: TimelineEvent[]        // 关键时间线
  rules?: string                    // 世界运行规则
  culture?: string                  // 文化风俗设定
}

interface Location {
  id: string
  name: string
  description: string
  type: 'city' | 'mountain' | 'forest' | 'dungeon' | 'other'
}

interface TimelineEvent {
  id: string
  time: string                      // 时间描述（如"三百年前"）
  event: string                     // 事件描述
  importance: 'low' | 'medium' | 'high'
}
```

### 3.4 情节设定
```typescript
interface PlotSetting {
  arcs?: PlotArc[]                  // 故事线/支线
  foreshadowing?: Foreshadowing[]   // 伏笔
  keyScenes?: KeyScene[]            // 关键场景
}

interface PlotArc {
  id: string
  name: string
  description: string
  status: 'planning' | 'in-progress' | 'completed'
}

interface Foreshadowing {
  id: string
  hint: string                      // 伏笔内容
  payoffChapter?: number            // 回收章节
  resolved: boolean
}

interface KeyScene {
  id: string
  name: string
  description: string
  chapterNumber?: number
}
```

### 3.5 待办事项
```typescript
interface TodoItem {
  id: string
  content: string
  type: 'consistency' | 'reminder' | 'plot' | 'other'
  chapterReference?: number         // 关联章节
  completed: boolean
  createdAt: string
}
```

---

## 四、功能详情

### 4.1 角色标签页

#### 角色卡片视图
```
┌─────────────────────────────────────────┐
│ 👤 李逍遥 (主角)                    [编辑] │
│    乐观开朗的蜀山弟子                      │
│    🏷️ 主角  🏷️ 蜀山                      │
│                                           │
│ ✨ 用此角色视角重写选区                    │
│ 🎯 优化选区台词风格                        │
└─────────────────────────────────────────┘
```

#### 快速操作联动（核心功能）
1. 用户在编辑器中选中文本（自动存入 SelectionStore）
2. 用户切换到 Bible 页面 → 点击角色卡片的"用此角色视角重写选区"
3. 自动跳转到编辑器页面
4. 调用 SelectionAI 的 prompt 构建逻辑，使用该角色设定
5. 打开右侧 SelectionAIPanel 执行 AI 改写

#### 角色编辑表单
- 分区域表单：基本信息、性格外貌、背景故事、人物关系
- 支持 Markdown 格式的描述字段
- 自动保存（防抖 1s）
- 提供角色模板快速填充

### 4.2 世界观标签页
- 力量体系：大文本编辑器（支持 Markdown）
- 地点管理：可折叠的卡片列表，支持新增/编辑/删除
- 时间线：按时间排序的事件列表，可拖拽调整顺序

### 4.3 情节标签页
- 故事线管理：状态标记（规划中/进行中/已完成）
- 伏笔追踪：标记已回收/待回收，关联章节号
- 关键场景：故事 beats 列表

### 4.4 待办标签页
- 从正文中自动提取 `[TODO: xxx]` 标记（Phase 2）
- 手动添加待办
- 按类型筛选
- 点击跳转到对应章节（Phase 2）

---

## 五、组件结构

```
frontend/src/components/bible/
├── BiblePage.tsx              # 主页面容器
├── BibleTabs.tsx              # 标签页切换
├── CharacterCard.tsx          # 角色卡片
├── CharacterForm.tsx          # 角色编辑表单
├── CharacterList.tsx          # 角色列表
├── WorldSettingsForm.tsx      # 世界观设置表单
├── PlotSettingsForm.tsx       # 情节设置表单
├── TodoList.tsx               # 待办列表
├── ConsistencyAlert.tsx       # 一致性提醒区域
└── BibleSearchBar.tsx         # 搜索栏

frontend/src/store/
└── useBibleStore.ts           # Bible 状态管理

frontend/src/utils/
└── bibleParser.ts             # 策划文档解析器
```

---

## 六、状态管理 (useBibleStore)

```typescript
interface BibleState {
  bible: Bible | null
  isLoading: boolean
  error: string | null
  
  // ========== 角色操作 ==========
  addCharacter: (char: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateCharacter: (id: string, updates: Partial<Character>) => void
  deleteCharacter: (id: string) => void
  
  // ========== 待办操作 ==========
  addTodo: (todo: Omit<TodoItem, 'id' | 'createdAt'>) => void
  updateTodo: (id: string, updates: Partial<TodoItem>) => void
  deleteTodo: (id: string) => void
  
  // ========== 世界观/情节操作 ==========
  updateWorldSetting: (updates: Partial<WorldSetting>) => void
  updatePlotSetting: (updates: Partial<PlotSetting>) => void
  
  // ========== 持久化 ==========
  saveToProject: (projectId: number) => Promise<void>
  loadFromProject: (projectId: number) => Promise<void>
  
  // ========== AI 辅助 ==========
  parseFromPlan: (planText: string) => Promise<Partial<Bible>>
}
```

---

## 七、API 接口

### 现有接口（无需修改）
- `GET /projects/:id` - 读取 bible 字段
- `PUT /projects/:id` - 保存 bible 字段

### Phase 2 新增接口
- `POST /projects/:id/bible/parse` - AI 解析策划文档生成设定
- `POST /projects/:id/bible/check-consistency` - 检测内容与设定一致性

---

## 八、Phase 1 / Phase 2 边界

### Phase 1（本期实现）
✅ Bible 页面基础框架（4 个标签页）
✅ 角色 CRUD（增删改查）
✅ 世界观设定编辑
✅ 情节设定编辑
✅ 待办事项管理
✅ 从策划文档自动解析设定（前端正则提取）
✅ 快速操作跳转到编辑器改写
✅ 数据持久化到 Project.bible 字段

### Phase 2（后续实现）
❌ 编辑器内角色名高亮 + Tooltip
❌ AI 一致性检测
❌ 从正文中自动提取 TODO 标记
❌ 点击待办跳转到对应章节位置
❌ 更智能的 AI 设定解析

---

## 九、验收标准

1. 页面可通过 NavRail 正常访问
2. 可以新增、编辑、删除角色，数据正确保存到后端
3. 世界观、情节、待办标签页功能完整
4. 点击"用此角色视角重写选区"可以正确跳转到编辑器并执行 AI 改写
5. 所有现有测试通过，不破坏已有功能
6. 响应式布局，在不同屏幕尺寸下正常显示

---

## 十、文件清单

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 修改 | `frontend/src/components/layout/NavRail.tsx` | 添加 Bible 导航项 |
| 新增 | `frontend/src/pages/Bible.tsx` | Bible 主页面 |
| 新增 | `frontend/src/components/bible/` | 所有 Bible 子组件 |
| 新增 | `frontend/src/store/useBibleStore.ts` | 状态管理 |
| 新增 | `frontend/src/utils/bibleParser.ts` | 策划文档解析器 |
| 修改 | `frontend/src/types/api.ts` | 添加 Bible 类型定义 |
| 修改 | `frontend/src/utils/selectionAI.ts` | 扩展支持 Character 上下文 |
| 新增 | `frontend/src/tests/Bible.test.tsx` | 页面测试 |
| 新增 | `frontend/src/tests/useBibleStore.test.ts` | Store 测试 |
