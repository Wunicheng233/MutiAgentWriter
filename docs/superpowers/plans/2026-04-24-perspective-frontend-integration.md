# 作家视角 - 前端集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in your frontend environment. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 PerspectiveSelector 组件，并集成到项目配置页和写作工作台侧边栏，让用户可以选择和切换创作风格。

**Architecture:** 独立的 React 组件 PerspectiveSelector，通过 TanStack Query 与后端 API 通信。使用 Tailwind CSS 样式，与现有 UI 风格保持一致。

**Tech Stack:** React 18, TypeScript, Tailwind CSS, TanStack Query (React Query)

---

## 文件结构总览

| 操作 | 路径 | 职责 |
|-----|------|------|
| 创建 | `frontend/src/components/PerspectiveSelector.tsx` | 视角选择器组件 |
| 创建 | `frontend/src/components/PerspectiveSelector.test.tsx` | 组件测试 |
| 修改 | `frontend/src/pages/ProjectOverview.tsx` | 集成到项目配置页 |
| 修改 | `frontend/src/utils/endpoints.ts` | 添加视角 API 调用函数 |

---

## Task 1: API 端点封装

**Files:**
- Modify: `frontend/src/utils/endpoints.ts`

- [ ] **Step 1: 添加 perspective 相关的 API 函数**

在 `frontend/src/utils/endpoints.ts` 的末尾添加：

```typescript
// ==================== Perspectives API ====================

export interface Perspective {
  id: string;
  name: string;
  genre: string;
  description: string;
  strength_recommended: number;
  builtin: boolean;
  strengths: string[];
  weaknesses: string[];
}

export interface PerspectiveDetail extends Perspective {
  preview: {
    planner_injection: string;
    writer_injection: string;
    critic_injection: string;
  };
}

export interface UpdateProjectPerspectiveRequest {
  perspective: string | null;
  perspective_strength: number;
  use_perspective_critic: boolean;
}

export async function listPerspectives(): Promise<{ perspectives: Perspective[] }> {
  const response = await fetch('/perspectives/');
  if (!response.ok) {
    throw new Error(`Failed to list perspectives: ${response.status}`);
  }
  return response.json();
}

export async function getPerspectiveDetail(perspectiveId: string): Promise<PerspectiveDetail> {
  const response = await fetch(`/perspectives/${perspectiveId}`);
  if (!response.ok) {
    throw new Error(`Failed to get perspective detail: ${response.status}`);
  }
  return response.json();
}

export async function updateProjectPerspective(
  projectId: number,
  data: UpdateProjectPerspectiveRequest
): Promise<{
  status: string;
  writer_perspective: string | null;
  perspective_strength: number;
  use_perspective_critic: boolean;
}> {
  const response = await fetch(`/perspectives/project/${projectId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to update project perspective: ${response.status}`);
  }
  return response.json();
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx tsc --noEmit --skipLibCheck src/utils/endpoints.ts
```
Expected: No TypeScript errors

- [ ] **Step 3: 提交**

```bash
git add frontend/src/utils/endpoints.ts
git commit -m "feat: add perspective API endpoints to frontend"
```

---

## Task 2: PerspectiveSelector 组件实现

**Files:**
- Create: `frontend/src/components/PerspectiveSelector.tsx`

- [ ] **Step 1: 创建组件骨架**

```tsx
// frontend/src/components/PerspectiveSelector.tsx
import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from './Card';
import { Badge } from './Badge';
import { Input } from './Input';
import { Button } from './Button';
import {
  listPerspectives,
  updateProjectPerspective,
  Perspective,
  UpdateProjectPerspectiveRequest,
} from '../utils/endpoints';
import { useToast } from '../components/toastContext';

export interface PerspectiveSelectorProps {
  projectId: number;
  value: string | null;
  onChange?: (perspectiveId: string | null) => void;
  initialStrength?: number;
  initialUseForCritic?: boolean;
  compact?: boolean; // 紧凑模式（用于侧边栏）
}

const genreIcons: Record<string, string> = {
  '科幻': '',
  '武侠': '',
  '奇幻': '',
  '文学': '',
  '网文': '',
};

export const PerspectiveSelector: React.FC<PerspectiveSelectorProps> = ({
  projectId,
  value,
  onChange,
  initialStrength = 0.7,
  initialUseForCritic = true,
  compact = false,
}) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [strength, setStrength] = useState(initialStrength);
  const [useForCritic, setUseForCritic] = useState(initialUseForCritic);

  // 获取视角列表
  const { data: perspectivesData, isLoading } = useQuery({
    queryKey: ['perspectives'],
    queryFn: listPerspectives,
    staleTime: 1000 * 60 * 60, // 缓存 1 小时
  });

  const perspectives = perspectivesData?.perspectives || [];

  // 更新项目视角配置
  const updateMutation = useMutation({
    mutationFn: (data: UpdateProjectPerspectiveRequest) =>
      updateProjectPerspective(projectId, data),
    onSuccess: () => {
      showToast('视角配置已更新', 'success');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: () => {
      showToast('更新失败，请重试', 'error');
    },
  });

  // 选择视角
  const handleSelect = (perspectiveId: string | null) => {
    updateMutation.mutate({
      perspective: perspectiveId,
      perspective_strength: strength,
      use_perspective_critic: useForCritic,
    });
    onChange?.(perspectiveId);
  };

  // 强度变化时自动保存
  const handleStrengthChange = (newStrength: number) => {
    setStrength(newStrength);
    if (value) {
      updateMutation.mutate({
        perspective: value,
        perspective_strength: newStrength,
        use_perspective_critic: useForCritic,
      });
    }
  };

  // Critic 开关变化时自动保存
  const handleUseForCriticChange = (checked: boolean) => {
    setUseForCritic(checked);
    if (value) {
      updateMutation.mutate({
        perspective: value,
        perspective_strength: strength,
        use_perspective_critic: checked,
      });
    }
  };

  // 按题材分组并过滤搜索
  const filteredPerspectives = perspectives.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.genre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedPerspectives = filteredPerspectives.reduce((acc, p) => {
    if (!acc[p.genre]) {
      acc[p.genre] = [];
    }
    acc[p.genre].push(p);
    return acc;
  }, {} as Record<string, Perspective[]>);

  if (isLoading) {
    return (
      <div className="p-4 text-secondary text-center">
        正在加载视角列表...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <Input
          placeholder="搜索作家风格..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      )}

      <div className="space-y-6">
        {Object.entries(groupedPerspectives).map(([genre, items]) => (
          <div key={genre}>
            <p className="text-sm font-medium text-secondary mb-3 flex items-center gap-2">
              <span>{genreIcons[genre] || ''}</span>
              <span>{genre}</span>
              <span className="text-xs">({items.length})</span>
            </p>
            <div className="space-y-2">
              {items.map((p) => (
                <label
                  key={p.id}
                  className={`
                    block p-4 rounded-standard border cursor-pointer transition-all
                    ${value === p.id
                      ? 'border-sage bg-sage/10 shadow-sm'
                      : 'border-border hover:border-sage/40 hover:bg-white/50'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="perspective"
                      value={p.id}
                      checked={value === p.id}
                      onChange={() => handleSelect(p.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-secondary mt-1">{p.description}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.strengths.slice(0, 3).map((s) => (
                          <Badge key={s} variant="secondary" size="sm">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 不使用特定风格选项 */}
      <label className="block p-4 rounded-standard border border-border cursor-pointer hover:bg-white/50 transition-all">
        <div className="flex items-center gap-3">
          <input
            type="radio"
            name="perspective"
            checked={value === null}
            onChange={() => handleSelect(null)}
          />
          <span>默认创作模式（无特定风格）</span>
        </div>
      </label>

      {/* 强度滑块和配置 */}
      {value && !compact && (
        <Card className="p-5 mt-6">
          <p className="font-medium mb-4">风格融入强度</p>
          <div className="space-y-4">
            <div>
              <input
                type="range"
                min="0"
                max="100"
                value={strength * 100}
                onChange={(e) => handleStrengthChange(Number(e.target.value) / 100)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-secondary mt-1">
                <span>轻微影响</span>
                <span>平衡</span>
                <span>强烈风格</span>
              </div>
              <p className="text-center text-sm mt-2 text-secondary">
                当前强度: {Math.round(strength * 100)}%
                {strength <= 0.3 && '（仅影响句式和词汇）'}
                {strength > 0.3 && strength <= 0.7 && '（完整融入心智模型）'}
                {strength > 0.7 && '（完全遵循该作家风格）'}
              </p>
            </div>

            <div className="pt-2 border-t border-border">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useForCritic}
                  onChange={(e) => handleUseForCriticChange(e.target.checked)}
                />
                <span className="text-sm">
                  同时使用该作家的审美标准来评审质量
                </span>
              </label>
              <p className="text-xs text-secondary mt-1 ml-6">
                启用后，Critic 会按照该作家的创作标准来评估章节质量
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PerspectiveSelector;
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx tsc --noEmit --skipLibCheck src/components/PerspectiveSelector.tsx
```
Expected: No TypeScript errors (fix any import/type issues)

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/PerspectiveSelector.tsx
git commit -m "feat: add PerspectiveSelector component"
```

---

## Task 3: 集成到项目配置页 (ProjectOverview)

**Files:**
- Modify: `frontend/src/pages/ProjectOverview.tsx`

- [ ] **Step 1: 导入组件**

在文件开头导入：

```tsx
import PerspectiveSelector from '../components/PerspectiveSelector';
```

- [ ] **Step 2: 在"创作配置"标签页中添加选择器**

找到 ProjectOverview 组件中 `activeTab === 'setup'` 显示的内容部分（大约在 setup 卡片的末尾），添加：

```tsx
{/* 在创作配置卡片中，找到合适位置添加 */}
<div className="mt-8 pt-6 border-t border-border">
  <div className="mb-4 flex items-center justify-between">
    <div>
      <p className="text-xs uppercase tracking-wider text-secondary">
         创作风格
      </p>
      <h3 className="mt-1 text-lg font-medium">选择作家视角</h3>
    </div>
  </div>
  <p className="text-sm text-secondary mb-6">
    选择一位作家的思维方式和表达风格来创作小说。
    系统会在策划、写作、评审等环节融入该作家的创作理念。
  </p>
  <PerspectiveSelector
    projectId={projectId}
    value={data?.writer_perspective || null}
    initialStrength={data?.perspective_strength || 0.7}
    initialUseForCritic={data?.use_perspective_critic ?? true}
  />
</div>
```

- [ ] **Step 3: 确保 Project 类型包含新增字段**

检查 `frontend/src/types/api.ts` 中的 `Project` 类型定义，如果缺少以下字段则添加：

```tsx
interface Project {
  // ... 原有字段 ...

  // 视角配置
  writer_perspective: string | null;
  perspective_strength: number;
  use_perspective_critic: boolean;
}
```

- [ ] **Step 4: 编译验证**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run build 2>&1 | tail -30
```
Expected: Build completes successfully (or fix any errors)

- [ ] **Step 5: 手动测试（可选）**

启动开发服务器访问项目配置页，验证视角选择器正确显示、可以选择视角、可以调节强度。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/pages/ProjectOverview.tsx frontend/src/types/api.ts
git commit -m "feat: integrate PerspectiveSelector into ProjectOverview page"
```

---

## Task 4: 集成到写作工作台侧边栏（紧凑模式）

**Files:**
- Modify: `frontend/src/pages/Editor.tsx` (或对应的写作页面)

- [ ] **Step 1: 在编辑器页面侧边栏添加快速切换**

找到 Editor 页面的侧边栏组件（或页面右侧边栏区域），添加：

```tsx
// 导入组件
import PerspectiveSelector from '../components/PerspectiveSelector';

// 在侧边栏合适位置添加：
<div className="p-4 rounded-standard border border-border bg-white/50">
  <p className="text-sm font-medium mb-2 flex items-center gap-2">
    <span></span>
    <span>当前风格</span>
  </p>
  {project?.writer_perspective ? (
    <div>
      <p className="font-medium">{perspectiveName}</p>
      <p className="text-xs text-secondary mt-1">{perspectiveDescription}</p>
      <p className="text-xs text-secondary mt-1">
        强度: {Math.round((project.perspective_strength || 0.7) * 100)}%
      </p>
      <Button
        variant="tertiary"
        size="sm"
        className="mt-3 w-full"
        onClick={() => setShowPerspectiveModal(true)}
      >
        切换风格
      </Button>
    </div>
  ) : (
    <div>
      <p className="text-sm text-secondary">默认创作模式</p>
      <Button
        variant="tertiary"
        size="sm"
        className="mt-3 w-full"
        onClick={() => setShowPerspectiveModal(true)}
      >
        选择作家风格
      </Button>
    </div>
  )}
</div>
```

注意：如果 Editor 页面比较复杂，可以先实现简单的显示，不一定要实现完整的 modal 切换功能。这一步的优先级可以根据项目实际情况调整。

---

## Task 5: 组件测试

**Files:**
- Create: `frontend/src/components/PerspectiveSelector.test.tsx`

- [ ] **Step 1: 写基础组件测试**

```tsx
// frontend/src/components/PerspectiveSelector.test.tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, describe, test, vi } from 'vitest';
import React from 'react';
import PerspectiveSelector from './PerspectiveSelector';

// Mock API
vi.mock('../utils/endpoints', () => ({
  listPerspectives: vi.fn().mockResolvedValue({
    perspectives: [
      {
        id: 'liu-cixin',
        name: '刘慈欣',
        genre: '科幻',
        description: '思想实验公理框架',
        strength_recommended: 0.8,
        builtin: true,
        strengths: ['科幻世界观', '宏大叙事'],
        weaknesses: ['细腻人物描写'],
      },
      {
        id: 'jin-yong',
        name: '金庸',
        genre: '武侠',
        description: '历史厚重感',
        strength_recommended: 0.7,
        builtin: true,
        strengths: ['武侠世界观', '武学哲学'],
        weaknesses: [],
      },
    ],
  }),
  updateProjectPerspective: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

vi.mock('../components/toastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('PerspectiveSelector', () => {
  test('renders with null value initially', () => {
    renderWithProviders(
      <PerspectiveSelector
        projectId={1}
        value={null}
      />
    );

    expect(screen.getByText('默认创作模式')).toBeInTheDocument();
  });

  test('displays perspective options from API', async () => {
    renderWithProviders(
      <PerspectiveSelector
        projectId={1}
        value={null}
      />
    );

    // 等待加载完成
    const liuCixin = await screen.findByText('刘慈欣');
    const jinYong = await screen.findByText('金庸');

    expect(liuCixin).toBeInTheDocument();
    expect(jinYong).toBeInTheDocument();
  });

  test('groups perspectives by genre', async () => {
    renderWithProviders(
      <PerspectiveSelector
        projectId={1}
        value={null}
      />
    );

    const sciFi = await screen.findByText('科幻');
    const wuxia = await screen.findByText('武侠');

    expect(sciFi).toBeInTheDocument();
    expect(wuxia).toBeInTheDocument();
  });

  test('shows strength slider when perspective selected', async () => {
    renderWithProviders(
      <PerspectiveSelector
        projectId={1}
        value="liu-cixin"
      />
    );

    const strengthSlider = await screen.findByText('风格融入强度');
    expect(strengthSlider).toBeInTheDocument();
  });

  test('does not show strength slider in compact mode', async () => {
    renderWithProviders(
      <PerspectiveSelector
        projectId={1}
        value="liu-cixin"
        compact={true}
      />
    );

    // 紧凑模式不应该显示强度滑块
    await screen.findByText('刘慈欣');
    expect(screen.queryByText('风格融入强度')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm test -- PerspectiveSelector.test.tsx --run
```
Expected: All tests pass (fix any issues)

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/PerspectiveSelector.test.tsx
git commit -m "test: add PerspectiveSelector component tests"
```

---

## Task 6: 运行完整测试套件

- [ ] **Step 1: 运行所有前端测试**

```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run
```

- [ ] **Step 2: 运行所有后端测试**

```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest discover tests -v 2>&1 | tail -40
```

Expected: All tests pass

---

## 计划自检

### Spec 覆盖检查

对照规格文档，本计划覆盖了：
-  PerspectiveSelector 组件实现
-  视角列表 API 集成
-  视角配置更新 API 集成
-  按题材分组显示
-  搜索过滤功能
-  强度滑块调节
-  Critic 开关配置
-  紧凑模式支持（用于侧边栏）
-  ProjectOverview 页面集成
-  组件单元测试

### 待完成的功能（后续迭代）

以下内容可以在 v1.0 之后继续完善：
- 视角详情预览弹窗
- 混合视角模式 UI
- 不同风格生成效果对比预览
- 视角收藏/常用视角
- 用户自定义视角上传

---

**所有计划已完成！**

三个子系统的实现计划都已完成：

1.  `perspective-engine-core.md` - 核心注入引擎
2.  `perspective-backend-api.md` - 后端 API 与数据模型
3.  `perspective-frontend-integration.md` - 前端组件集成

**现在可以开始执行了。你希望使用哪种执行方式？**

**1. Subagent-Driven (推荐)** - 每个 task 独立子 agent 执行，严格 review，并行执行
**2. Inline Execution** - 在当前会话按顺序执行，适合快速迭代

**或者你想先从哪个子系统开始？**
- 建议先执行 Perspective Engine 核心（最小可用系统）
- 然后是后端 API
- 最后是前端集成
