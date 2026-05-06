# 代码质量批量修复设计文档

> **日期**: 2026-04-28
> **范围**: 体检发现的代码质量问题批量修复
> **排除项**: 大文件拆分、Storybook/Tailwind 大版本迁移

---

## 1. 问题总览

根据 2026-04-28 全方位项目大体检，共发现 **32 个可立即修复的问题**，分 3 个阶段集中修复。

---

## 2. 修复策略

**三阶段集中修复策略**：
- 同类型问题一起修复，上下文切换少，效率高
- 每个阶段独立验证，确保修复不引入新问题
- 坚持 TDD 原则：测试先行，验证后置

---

## Phase 1：Git 同步 + 依赖清理

### 2.1 问题清单（5 个）

| # | 优先级 | 问题描述 | 修复方案 |
|---|--------|---------|---------|
| 1 |  高 | 本地 27 个提交未推送 origin/main | `git push` |
| 2 |  中 | `useKeyboardNavigation.ts` 文件移动未完成提交 | git add + git rm + commit |
| 3 |  中 | 4 个修改文件未提交 | 分配合适的 commit message |
| 4 |  中 | `@tiptap/extension-image` 已安装但未使用 | `npm uninstall` |
| 5 |  高 | `.env` 文件暴露风险 | 确认 .gitignore 生效且文件未被跟踪 |

### 2.2 验证标准

- `git status` 显示工作区干净（除未跟踪的文档文件）
- `npm ls @tiptap/extension-image` 返回空
- `git ls-files .env` 返回空

---

## Phase 2：后端代码质量修复

### 3.1 问题清单（约 44+ 处）

#### 3.1.1 f-string 缺少占位符（9 处）

| 文件路径 | 行号 | 修复 |
|---------|------|------|
| `backend/tasks/writing_tasks.py` | 79, 538 | 移除 `f` 前缀 |
| `backend/core/orchestrator.py` | 415, 435, 444, 942 | 移除 `f` 前缀 |
| `backend/core/system_guardrails.py` | 99 | 移除 `f` 前缀 |
| `backend/agents/critic_agent.py` | 79 | 移除 `f` 前缀 |
| `backend/api/tasks.py` | 144 | 移除 `f` 前缀 |
| `backend/api/projects.py` | 700 | 移除 `f` 前缀 |

#### 3.1.2 未使用变量（4 处）

| 文件路径 | 行号 | 修复 |
|---------|------|------|
| `backend/api/projects.py` | 453 | 删除未使用的异常变量 `e` |
| `backend/core/orchestrator.py` | 689 | 删除不必要的 `nonlocal repair_trace` 声明 |
| `backend/core/repair_manager.py` | 75 | 删除未使用的 `used_local_repair` 变量 |
| `backend/utils/file_utils.py` | 131 | 删除未使用的 `skill_injected` 变量 |

#### 3.1.3 重复导入（2 处）

| 文件路径 | 行号 | 修复 |
|---------|------|------|
| `backend/utils/volc_engine.py` | 12, 46 | 清理重复导入 `API_KEYS, BASE_URL` |

#### 3.1.4 未使用导入（30+ 处）

| 文件路径 | 未使用导入 |
|---------|-----------|
| `backend/auth.py` | `os` |
| `backend/deps.py` | `typing.Generator` |
| `backend/core/config.py` | `typing.Optional` |
| `backend/core/repair_strategy_router.py` | `typing.Optional` |
| `backend/core/agent_pool.py` | `backend.agents.critic_agent.critic_chapter` |
| `backend/core/orchestrator.py` | `.agent_pool.agent_pool` |
| `backend/core/system_guardrails.py` | `pathlib.Path` |
| `backend/core/chapter_context.py` | `typing.Optional` |
| `backend/agents/critic_agent.py` | `backend.config.CRITIC_PASS_SCORE` |
| `backend/utils/yaml_utils.py` | `pathlib.Path` |
| `backend/api/chapters.py` | `os`, `Project`, `settings` |
| `backend/api/auth.py` | `Request`, `and_`, `extract` |
| `backend/api/tasks.py` | `Chapter`, `GenerationTaskResponse` |
| `backend/api/share.py` | `desc`, `Project` |
| `backend/api/projects.py` | `Request`, `AsyncResult`, 重复导入 |

### 3.2 验证标准

- 后端测试 173 个全部通过
- `flake8 backend --count --select=F401,F841 --max-line-length=120` 返回 0 错误

---

## Phase 3：前端代码 + 测试修复

### 4.1 问题清单（8 个问题 + 16 处 any 类型）

#### 4.1.1 生产代码 any 类型修复（1 处）

| 文件路径 | 行号 | 修复方案 |
|---------|------|---------|
| `src/pages/Editor.tsx` | 102 | 定义 `ApiError` 接口替代 `any` |

```typescript
interface ApiError {
  response?: { status: number }
}
const chapterNotFound = error && (error as ApiError)?.response?.status === 404
```

#### 4.1.2 useKeyboardNavigation 依赖优化（1 处）

| 文件路径 | 行号 | 修复方案 |
|---------|------|---------|
| `src/components/v2/hooks/useKeyboardNavigation.ts` | 52 | 移除不必要的 `isOpen` 依赖，改用 `ref` 存储最新值或确认逻辑不需要 |

#### 4.1.3 Toast 组件单元测试补充（1 项）

**缺失文件**: `src/components/v2/Toast/Toast.test.tsx`

**测试覆盖项**：
- `render(<Toast />)` 基础渲染
- 不同 variant 渲染（info/success/warning/error）
- 自动关闭功能
- onClose 回调
- duration 自定义
- 关闭按钮点击

**TDD 流程**：先写失败测试 → 实现代码 → 验证通过

#### 4.1.4 Skip 测试处理（2 处）

| 文件路径 | 行号 | 测试名称 | 处理方案 |
|---------|------|---------|---------|
| `src/pages/ProjectOverview.test.tsx` | 101 | "Flow Story 描述应该精简，不应该有长段落说明" | 实现或删除 |
| `src/pages/ProjectOverview.test.tsx` | 108 | "卡片应该有足够的内边距保证呼吸感" | 实现或删除 |

#### 4.1.5 测试文件 any 类型清理（16 处）

**目标文件**：
- `src/hooks/useKeyboardShortcuts.test.ts`
- `src/pages/*.test.tsx`（多个页面测试文件）

**修复方案**：
- 使用 `vi.Mock` 替代 mock 函数的 any
- 使用 `vi.mocked()` 进行类型安全的 mock
- 定义 Mock 类型接口

#### 4.1.6 覆盖率工具安装（1 项）

```bash
npm install -D @vitest/coverage-v8
```

在 `vite.config.ts` 或 `vitest.config.ts` 中配置：
```typescript
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 70,
    },
  },
}
```

#### 4.1.7 hooks 单元测试补充（1 项）

为 `src/components/v2/hooks/useKeyboardNavigation.ts` 添加单元测试：
- 测试键盘事件处理
- 测试 Enter/Escape 键行为
- 测试 ArrowUp/ArrowDown 导航

#### 4.1.8 pip-audit 安装与运行（1 项）

```bash
source ~/miniconda3/etc/profile.d/conda.sh && conda activate novel_agent
pip install pip-audit
pip-audit
```

### 4.2 验证标准

- 前端测试 304 个全部通过
- `npx tsc --noEmit` 无类型错误
- `npm run lint` 无 ESLint 错误
- 覆盖率报告可生成

---

## 5. 验收标准

 **Phase 1 验收**：工作区整洁，Git 状态干净，依赖清理完成

 **Phase 2 验收**：后端测试全部通过，无未使用导入/变量警告

 **Phase 3 验收**：前端测试全部通过，零类型错误，覆盖率工具可用

---

## 6. 明确排除项

以下问题不在本次修复范围内，需单独规划：
1. `backend/core/orchestrator.py` (1433行) 文件模块化拆分
2. `backend/api/projects.py` (1299行) 路由拆分
3. Storybook v8 → v10 跨版本迁移
4. Tailwind CSS v3 → v4 迁移
5. Editor.tsx (704行)、WorkflowRunDetail.tsx (677行) 页面组件拆分
6. 通用工具函数迁移到 `src/utils/`
7. 自定义错误子类重构

---

## 7. 下一步

- 确认本设计文档
- 进入 writing-plans 阶段生成详细实施计划
- 按 Phase 1 → Phase 2 → Phase 3 顺序执行
