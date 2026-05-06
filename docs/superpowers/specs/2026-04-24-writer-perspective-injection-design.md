# 作家视角注入系统 (Writer Perspective Injection System)

**版本**：v1.0
**日期**：2026-04-24
**状态**：待评审 → 待实现

---

## 1. 项目背景与目标

### 1.1 背景

StoryForge AI 当前的多智能体创作系统中，每个智能体的提示词是固定写死的（`prompts/*.md`）。虽然系统已经具备了高质量的创作能力，但缺乏"人格化"和"风格化"的维度。

受到女娲造人（nuwa-skill）项目的启发，我们已经成功蒸馏出 12+ 位知名作家的思维框架（perspective skill），包括：
- 刘慈欣（科幻）
- 金庸、古龙（武侠）
- J.K.罗琳、乔治·R·R·马丁（奇幻）
- 余华、村上春树、海明威、纳博科夫、鲁迅（文学）
- 唐家三少、郁雨竹（网文）

每个 perspective skill 包含：
- 6个核心心智模型
- 7条创作启发式原则
- 完整的表达风格 DNA（句式、词汇、节奏感）
- 审美标准和自我审查原则

### 1.2 目标

将这些作家视角**无缝注入**到 StoryForge AI 的多智能体创作流程中，使 AI 能够以特定作家的心智模型、创作方法和表达风格来生成小说。

### 1.3 设计原则

| 原则 | 说明 |
|-----|------|
| **非破坏性** | 不修改现有 prompt 的核心逻辑，只做增量注入 |
| **分层注入** | 不同智能体注入不同维度的视角 |
| **可插拔** | 视角可以随时切换、组合、关闭 |
| **向后兼容** | 不选择视角时，系统回退到默认创作模式 |

---

## 2. 系统架构

### 2.1 总体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    StoryForge 创作工作流                          │
├──────────┬──────────┬──────────┬──────────┬─────────────────────┤
│  Planner │  Writer  │  Critic  │  Revise  │  Perspective Router  │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴─────────────────────┘
     │          │          │          │
     ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Perspective Injection Layer                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  心智模型注入 │  │  风格DNA注入  │  │   创作方法论注入        │  │
│  │  (Planner)   │  │   (Writer)   │  │  (Critic/Revise)      │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Perspective Skill 库  │
              │  (12+ 已蒸馏作家)      │
              └───────────────────────┘
```

### 2.2 分层注入策略

| 智能体 | 注入维度 | 注入内容 | 注入位置 |
|--------|---------|---------|---------|
| **Planner** | 心智模型层 | 世界观构建方法、情节构思原则 | system prompt **头部** |
| **Writer** | 表达风格层 | 句式偏好、词汇特征、节奏感 | system prompt **尾部** |
| **Critic** | 审美标准层 | 该作家的质量判断标准 | user input 注入 |
| **Revise** | 修改策略层 | 该作家的修改偏好 | user input 注入 |

---

## 3. 核心实现设计

### 3.1 Perspective Engine 核心类

**文件位置**：`core/perspective_engine.py`

```python
from pathlib import Path
from typing import Optional, Dict
import yaml


class PerspectiveEngine:
    """作家视角注入引擎

    负责：
    1. 加载/解析 perspective skill 文件
    2. 按智能体类型提取可注入片段
    3. 执行实际的 prompt 注入操作
    """

    # 内置视角库路径
    BUILTIN_PERSPECTIVES = Path(__file__).parent.parent / 'perspectives'

    def __init__(self, perspective_name: str = None):
        self.perspective_name = perspective_name
        self.perspective_data: Optional[Dict] = None

        if perspective_name:
            self.load(perspective_name)

    def load(self, name: str) -> None:
        """加载指定的 perspective skill

        优先级：
        1. 项目内置目录 → perspectives/
        2. 用户级技能目录 → ~/.claude/skills/
        """
        # 1. 先找内置的
        builtin_path = self.BUILTIN_PERSPECTIVES / f"{name}.yaml"
        if builtin_path.exists():
            with open(builtin_path, 'r', encoding='utf-8') as f:
                self.perspective_data = yaml.safe_load(f)
            return

        # 2. 再找 .claude/skills/ 中的（需要从 SKILL.md 解析）
        skill_path = self._find_skill_in_claude_dir(name)
        if skill_path:
            self.perspective_data = self._parse_skill_md(skill_path)
            return

        raise ValueError(f"Perspective '{name}' not found")

    def inject_for_planner(self, original_prompt: str, strength: float = 0.7) -> str:
        """为 Planner 注入心智模型

        注入位置：prompt 最开头
        注入内容：核心心智模型、世界观构建原则
        """
        if not self.perspective_data:
            return original_prompt

        injection = self._get_planner_injection(strength)

        return f"""
# 创作思维模式：{self.perspective_data['name']}

## 核心心智模型（请在构思时融入以下思维方式）
{injection['mental_models']}

## 世界观构建原则
{injection['worldview_principles']}

---

{original_prompt}
"""

    def inject_for_writer(self, original_prompt: str, strength: float = 0.7) -> str:
        """为 Writer 注入表达风格DNA

        注入位置：prompt 末尾（在所有硬性规则之后）
        注入内容：句式偏好、词汇特征、节奏感、经典句式参考
        """
        if not self.perspective_data:
            return original_prompt

        injection = self._get_writer_injection(strength)

        return f"""
{original_prompt}

---

## 表达风格适配：{self.perspective_data['name']} 模式

### 句式偏好
{injection['sentence_patterns']}

### 词汇特征
{injection['vocabulary_traits']}

### 节奏感
{injection['rhythm_principles']}

### 经典句式参考（可直接化用）
{injection['example_sentences']}
"""

    def inject_for_critic(self, original_input: str, strength: float = 0.7) -> str:
        """为 Critic 注入审美标准"""
        if not self.perspective_data:
            return original_input

        standards = self._get_critic_injection(strength)
        return f"""
{original_input}

---

## 评审视角：{self.perspective_data['name']} 的审美标准
{standards}
"""

    def inject_for_revise(self, original_input: str, strength: float = 0.7) -> str:
        """为 Revise 注入修改策略"""
        if not self.perspective_data:
            return original_input

        strategy = self._get_revise_injection(strength)
        return f"""
{original_input}

---

## 修改策略：{self.perspective_data['name']} 风格
{strategy}
"""

    def _get_planner_injection(self, strength: float) -> Dict[str, str]:
        """根据强度裁剪 Planner 注入内容"""
        data = self.perspective_data
        # strength 0.3 → 只取前2条心智模型
        # strength 0.7 → 取前4条 + 世界观原则
        # strength 1.0 → 全部
        # ... 实现省略

    @classmethod
    def list_available_perspectives(cls) -> list:
        """列出所有可用的作家视角"""
        perspectives = []

        # 内置视角
        if cls.BUILTIN_PERSPECTIVES.exists():
            for f in cls.BUILTIN_PERSPECTIVES.glob("*.yaml"):
                with open(f, 'r', encoding='utf-8') as fp:
                    data = yaml.safe_load(fp)
                    perspectives.append({
                        'id': f.stem,
                        'name': data['name'],
                        'genre': data['genre'],
                        'description': data['description'],
                        'strength_recommended': data['strength_recommended'],
                        'builtin': True,
                    })

        # 额外视角（~/.claude/skills/ 中找到的）
        # ...

        return sorted(perspectives, key=lambda x: x['genre'])
```

### 3.2 Prompt 加载系统改造

**修改文件**：`utils/file_utils.py` → `load_prompt()`

```python
def load_prompt(
    agent_name: str,
    content_type: str = None,
    context: dict = None,
    perspective: str = None,          # 新增：视角名称
    perspective_strength: float = 0.7, # 新增：视角强度
) -> str:
    """
    加载提示词，支持作家视角注入

    :param perspective: 作家视角名称（如 'liu-cixin', 'tangjiashao'）
    :param perspective_strength: 视角强度 (0.0-1.0)
    """
    # === 原有逻辑保持不变 ===
    if content_type:
        specific_prompt = PROMPTS_DIR / f"{agent_name}_{content_type}.md"
        if specific_prompt.exists():
            with open(specific_prompt, "r", encoding="utf-8") as f:
                content = f.read().strip()
        # ... 其他特定 prompt 逻辑
    else:
        prompt_file = PROMPTS_DIR / f"{agent_name}.md"
        if not prompt_file.exists():
            raise FileNotFoundError(f"提示词文件不存在：{prompt_file}")
        with open(prompt_file, "r", encoding="utf-8") as f:
            content = f.read().strip()

    # === 新增：视角注入逻辑 ===
    if perspective:
        from core.perspective_engine import PerspectiveEngine

        engine = PerspectiveEngine(perspective)

        if agent_name == 'planner':
            content = engine.inject_for_planner(content, perspective_strength)
        elif agent_name == 'writer':
            content = engine.inject_for_writer(content, perspective_strength)
        elif agent_name == 'critic':
            content = engine.inject_for_critic(content, perspective_strength)
        elif agent_name == 'revise':
            content = engine.inject_for_revise(content, perspective_strength)

    # === 原有占位符替换逻辑保持不变 ===
    if context:
        for key, value in context.items():
            content = content.replace(f"{{{{{key}}}}}", str(value))

    return content
```

### 3.3 智能体调用链改造

**修改文件**：`agents/writer_agent.py`, `agents/planner_agent.py` 等

```python
# 在 generate_chapter 函数签名中新增参数
def generate_chapter(
    setting_bible: str,
    plan: str,
    chapter_num: int,
    prev_chapter_end: str = "",
    related_content: str = "",
    constraints: dict = None,
    target_word_count: int = 2000,
    content_type: str = "full_novel",
    client: openai.OpenAI = None,
    perspective: str = None,           # 新增
    perspective_strength: float = 0.7, # 新增
) -> str:
    # ... 原有逻辑

    # 加载 prompt 时传入 perspective
    user_input = f"""
    ... 原有输入 ...
    """

    # perspective 会在 load_prompt 内部被注入
    return call_volc_api(
        'writer',
        user_input,
        content_type=content_type,
        context={
            # ... 原有 context
            'perspective': perspective,
            'perspective_strength': perspective_strength,
        },
        client=client,
    )
```

---

## 4. 后端数据模型与 API

### 4.1 数据库字段扩展

**修改文件**：`backend/models.py` → `Project` 表

```python
class Project(db.Model):
    # === 原有字段保持不变 ===
    # id, user_id, name, description, status, config, etc.

    # === 新增：创作风格配置 ===

    # 选定的作家视角 ID（如 'liu-cixin'），None 表示默认模式
    writer_perspective = db.Column(db.String(100), nullable=True)

    # 是否同时应用该视角的评审标准来做 Critic
    use_perspective_critic = db.Column(db.Boolean, default=True)

    # 视角强度 (0.0-1.0)
    # 0.3 = 轻微风格影响
    # 0.7 = 完整融入心智模型和表达风格（默认）
    # 1.0 = 完全按该作家模式创作
    perspective_strength = db.Column(db.Float, default=0.7)

    # 混合视角模式（可选）
    # 示例：[{"id": "jin-yong", "weight": 0.7}, {"id": "liu-cixin", "weight": 0.3}]
    perspective_mix = db.Column(db.JSON, nullable=True)
```

### 4.2 API 设计

**新增文件**：`backend/api/perspectives.py`

```python
from fastapi import APIRouter, Depends
from core.perspective_engine import PerspectiveEngine
from backend.deps import get_current_user

router = APIRouter(prefix="/perspectives", tags=["perspectives"])


@router.get("/")
async def list_perspectives(
    current_user = Depends(get_current_user),
):
    """列出所有可用的作家视角"""
    perspectives = PerspectiveEngine.list_available_perspectives()
    return {"perspectives": perspectives}


@router.get("/{perspective_id}")
async def get_perspective_detail(
    perspective_id: str,
    current_user = Depends(get_current_user),
):
    """获取特定视角的详细信息和预览"""
    engine = PerspectiveEngine(perspective_id)

    return {
        "id": perspective_id,
        "name": engine.perspective_data['name'],
        "genre": engine.perspective_data['genre'],
        "description": engine.perspective_data['description'],
        "strength_recommended": engine.perspective_data['strength_recommended'],
        "preview": {
            "planner_injection": engine._get_planner_injection(0.7),
            "writer_injection": engine._get_writer_injection(0.7),
            "critic_injection": engine._get_critic_injection(0.7),
        },
        "strengths": engine.perspective_data['strengths'],
        "weaknesses": engine.perspective_data['weaknesses'],
    }


@router.post("/{perspective_id}/preview-generation")
async def preview_generation(
    perspective_id: str,
    outline_sample: str,  # 用户输入的一小段大纲
    current_user = Depends(get_current_user),
):
    """生成本视角的风格预览

    用于用户选择视角时，快速看到不同风格的生成效果对比
    """
    engine = PerspectiveEngine(perspective_id)

    # 使用 writer 注入 + 简单 prompt 生成样本段落
    sample_content = generate_preview_sample(
        engine,
        outline_sample,
        strength=0.7,
    )

    return {
        "perspective_id": perspective_id,
        "sample_content": sample_content,
    }
```

**修改项目配置 API** (`backend/api/projects.py`)：

```python
@router.put("/{project_id}/perspective")
async def update_project_perspective(
    project_id: int,
    perspective: str | None = Body(...),
    perspective_strength: float = Body(0.7),
    use_perspective_critic: bool = Body(True),
    current_user = Depends(get_current_user),
):
    """更新项目的创作风格配置"""
    project = get_project_or_404(project_id, current_user.id)

    if perspective is not None:
        # 验证 perspective 是否存在
        try:
            PerspectiveEngine(perspective)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid perspective: {perspective}")

    project.writer_perspective = perspective
    project.perspective_strength = perspective_strength
    project.use_perspective_critic = use_perspective_critic

    db.commit()

    return {"status": "ok"}
```

---

## 5. 前端集成设计

### 5.1 创作风格选择器组件

**新组件**：`frontend/src/components/PerspectiveSelector.tsx`

```typescript
interface Perspective {
  id: string;
  name: string;
  genre: string;
  description: string;
  strength_recommended: number;
  strengths: string[];
  weaknesses: string[];
  builtin: boolean;
}

export const PerspectiveSelector: React.FC<{
  value: string | null;
  onChange: (id: string | null) => void;
  strength: number;
  onStrengthChange: (v: number) => void;
  useForCritic: boolean;
  onUseForCriticChange: (v: boolean) => void;
}> = ({ value, onChange, strength, onStrengthChange, useForCritic, onUseForCriticChange }) => {
  const [perspectives, setPerspectives] = useState<Perspective[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPerspectives().then(setPerspectives);
  }, []);

  // 按题材分组
  const grouped = groupBy(perspectives, p => p.genre);

  const genreIcons: Record<string, string> = {
    '科幻': '',
    '武侠': '',
    '奇幻': '',
    '文学': '',
    '网文': '',
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="搜索作家风格..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
      />

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {Object.entries(grouped).map(([genre, items]) => (
          <div key={genre}>
            <p className="text-sm font-medium text-secondary mb-2">
              {genreIcons[genre] || ''} {genre}
            </p>
            <div className="space-y-2">
              {items.map(p => (
                <label
                  key={p.id}
                  className={`
                    block p-3 rounded-standard border cursor-pointer transition-all
                    ${value === p.id
                      ? 'border-sage bg-sage/10'
                      : 'border-border hover:border-sage/40'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="perspective"
                      value={p.id}
                      checked={value === p.id}
                      onChange={() => onChange(p.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-secondary">{p.description}</p>
                      <div className="mt-1 flex gap-2">
                        {p.strengths.slice(0, 3).map(s => (
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
      <label className="block p-3 rounded-standard border cursor-pointer">
        <div className="flex items-center gap-3">
          <input
            type="radio"
            name="perspective"
            checked={value === null}
            onChange={() => onChange(null)}
          />
          <span>默认创作模式（无特定风格）</span>
        </div>
      </label>

      {/* 强度滑块 */}
      {value && (
        <div className="mt-4 p-4 rounded-standard border border-border">
          <p className="font-medium mb-3">风格融入强度</p>
          <input
            type="range"
            min="0"
            max="100"
            value={strength * 100}
            onChange={e => onStrengthChange(Number(e.target.value) / 100)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-secondary mt-1">
            <span>轻微影响</span>
            <span>平衡</span>
            <span>强烈风格</span>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useForCritic}
                onChange={e => onUseForCriticChange(e.target.checked)}
              />
              <span className="text-sm">同时使用该作家的审美标准来评审质量</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 5.2 项目配置页集成

**修改**：`frontend/src/pages/ProjectOverview.tsx` → "创作配置"标签页

```tsx
// 在创作配置表单中新增
<div className="mt-6">
  <p className="text-xs uppercase tracking-wider text-secondary mb-4">
     创作风格
  </p>
  <PerspectiveSelector
    value={project.writer_perspective}
    onChange={id => updatePerspective(id)}
    strength={project.perspective_strength ?? 0.7}
    onStrengthChange={v => updatePerspectiveStrength(v)}
    useForCritic={project.use_perspective_critic ?? true}
    onUseForCriticChange={v => updateUseForCritic(v)}
  />
</div>
```

### 5.3 写作工作台快速切换

在 Editor 页面侧边栏增加快速切换入口：

```tsx
// 侧边栏组件
<div className="p-4 rounded-standard border border-border">
  <p className="text-sm font-medium mb-2">
     当前风格：{currentPerspective?.name || '默认'}
  </p>
  <p className="text-xs text-secondary mb-3">
    {currentPerspective?.description || '无特定作家风格'}
  </p>
  <Button
    variant="secondary"
    size="sm"
    onClick={() => setShowPerspectiveSelector(true)}
  >
    切换风格
  </Button>
</div>
```

---

## 6. 内置 Perspective 库

### 6.1 文件格式

**位置**：`perspectives/` 目录

每个 perspective 是一个 YAML 文件，结构如下：

```yaml
# perspectives/liu-cixin.yaml
name: "刘慈欣"
genre: "科幻"
description: "思想实验公理框架、宏大宇宙叙事、冷峻理性表达"
strength_recommended: 0.8

# 擅长领域（用于推荐）
strengths:
  - 科幻世界观构建
  - 极端情境思想实验
  - 宏大叙事构思
  - 技术发展的宏观想象

# 不擅长领域（用于提示用户）
weaknesses:
  - 复杂细腻的人物心理描写
  - 日常生活、都市情感题材
  - 女性人物塑造

# Planner 注入内容
planner_injection:
  mental_models: |
    1. **思想实验公理框架**：好的科幻不是预测未来，而是设定几个不可动摇的公理，然后顺着逻辑推到极致。
       - 公理设定三原则：简洁（2-3个）、自洽、可推导
    2. **黑暗森林思维**：生存是文明的第一需要，文明不断扩张但宇宙物质总量保持不变。
       - 在设定冲突时，优先从生存公理推导，而非道德判断
    3. **技术爆炸思维**：技术发展不是线性的，而是指数级的。一个技术突破可能在短时间内彻底改变文明格局。
    4. **尺度叠加**：同时在微观（个人）、宏观（文明）、宇宙（时间/空间）三个尺度上叙事。
    5. **零视角俯瞰**：像上帝一样观察人类，不代入任何一方的道德立场，只呈现逻辑结果。
    6. **工程风险控制**：任何技术都有代价，任何选择都有阴影面。不要只写技术的光明面，也要写它带来的问题。

  worldview_principles: |
    1. **中国历史经验的宇宙化转译**：把中国历史上的大事件（王朝更替、农民起义、闭关锁国、文明碰撞）转译为宇宙尺度的情节。
    2. **极端情境道德悬置**：在生存面前，平时的道德标准可能不适用。探索"人在极端情况下会变成什么"。
    3. **科学硬伤最小化**：尽量使用现有科学理论作为设定基础，实在需要突破的地方，明确标注为"科幻延伸"。
    4. **日常事物的宏大比喻**：用灯泡、桌子、沙子这些日常事物来比喻宇宙尺度的问题（"灯光越亮，接触到的黑暗边界就越长"）。

# Writer 注入内容
writer_injection:
  sentence_patterns: |
    1. **短句为主**：少用长复合句，每句承载一个信息点。让句子像石头一样坚硬。
    2. **陈述句优先**：少用疑问句、感叹句，保持冷峻和客观的叙述语调。
    3. **名词密度高**：多用具体名词，少用抽象形容词。说"天空是铅灰色的"，不说"天空很阴沉"。
    4. **工程比喻**：用工程、物理、数学术语来比喻情感和社会现象。
    5. **冷静的恐怖**：描写最恐怖的场景时，用最平静的语气。不说"太可怕了！"，说"然后，太阳就消失了。"

  vocabulary_traits: |
    - 偏爱：光年、熵、奇点、维度、文明、公理、逻辑、推导、概率、边界、宇宙、星空、太阳、地球
    - 避免：很、非常、十分、极其（这类程度副词）
    - 避免：华丽的形容词堆砌
    - 避免：网络用语、现代梗

  rhythm_principles: |
    1. **匀速推进**：整体节奏偏慢，像地质年代一样稳定推进，不追求频繁的情节反转。
    2. **突然的信息释放**：前面铺陈大量看似无关的细节，最后一句话揭示真相，颠覆整个世界观。
    3. **留白**：重要的情感场景不直接描写，留给读者自己想象（如罗辑在墓碑前与三体人的对话）。
    4. **时间尺度切换**：在段落之间自由切换时间尺度（一秒钟 → 一千年），制造宏大感。

  example_sentences: |
    - "给岁月以文明，而不是给文明以岁月。"
    - "弱小和无知不是生存的障碍，傲慢才是。"
    - "宇宙就是一座黑暗森林，每个文明都是带枪的猎人。"
    - "太阳快落下去了，你们的孩子居然不害怕？"
    - "在宇宙中，你再快都有比你更快的，你再慢也有比你更慢的。"

# Critic 注入内容
critic_injection: |
  按刘慈欣的标准评审这一章：
  1. **设定硬度**：核心科幻设定是否有自洽的逻辑基础？有没有明显的科学硬伤？
  2. **思想实验纯度**：情节是否是从公理推导出来的必然结果？有没有为了戏剧性强行扭曲逻辑？
  3. **尺度感**：有没有体现出宇宙尺度的宏大感？还是只是披了科幻外衣的宫廷斗争？
  4. **人物功能**：人物是否是思想实验的载体？他们的选择是否从属于思想实验的逻辑？
  5. **冷静语调**：有没有过度煽情的地方？叙述是否保持了工程师般的克制？

# Revise 注入内容
revise_injection: |
  按刘慈欣的风格修改：
  1. 删去所有程度副词（很、非常、极其）
  2. 把抽象描述改为具体名词+动词
  3. 把长句拆成短句，每句一个信息点
  4. 把感叹句改为陈述句
  5. 删去所有直接的心理描写，用动作间接体现心理
```

### 6.2 内置 Perspective 清单

| 分类 | 作家 | ID | 核心特质 | 适用题材 |
|-----|------|----|---------|---------|
|  科幻 | 刘慈欣 | `liu-cixin` | 思想实验、宏大尺度、冷峻理性 | 硬科幻、太空歌剧 |
|  武侠 | 金庸 | `jin-yong` | 历史厚重、武学哲学、群像叙事 | 武侠、历史玄幻 |
|  武侠 | 古龙 | `gu-long` | 短句留白、意境优先、浪子情怀 | 武侠、悬疑 |
|  奇幻 | J.K.罗琳 | `jk-rowling` | 魔法亲和力、成长叙事、温暖底色 | 奇幻、青少年向 |
|  奇幻 | 乔治·R·R·马丁 | `george-rr-martin` | POV切换、灰色道德、残酷真实 | 史诗奇幻、政治斗争 |
|  文学 | 余华 | `yu-hua` | 冷峻暴力、生存叙事、小人物史诗 | 现实主义、苦难叙事 |
|  文学 | 村上春树 | `haruki-murakami` | 都市疏离、爵士乐氛围、超现实隐喻 | 都市、悬疑、文艺 |
|  文学 | 海明威 | `ernest-hemingway` | 冰山原则、极简主义、硬汉独白 | 战争、冒险、硬汉小说 |
|  文学 | 纳博科夫 | `vladimir-nabokov` | 文字游戏、不可靠叙事、元小说 | 后现代、实验文学 |
|  文学 | 鲁迅 | `lu-xun` | 国民性批判、冷峻讽刺、匕首投枪 | 社会批判、杂文风 |
|  网文 | 唐家三少 | `tangjiashao` | 等级清晰、爽点密集、稳定节奏 | 升级流、系统流 |
|  网文 | 郁雨竹 | `yuyuzhu` | 乡土温情、人物鲜活、日常流叙事 | 乡土、种田文 |

---

## 7. 高级功能设计（Phase 2+）

### 7.1 混合视角模式

允许用户选择 2-3 个作家进行"风格融合"：

```json
{
  "perspective_mix": [
    { "id": "jin-yong", "weight": 0.7 },
    { "id": "liu-cixin", "weight": 0.3 }
  ]
}
```

**效果**：金庸 (70%) + 刘慈欣 (30%) = 武侠宇宙中的科幻思想实验

**实现**：加权拼接不同 perspective 的注入片段，让 LLM 自行融合。

### 7.2 视角对比预览

在选择视角时，提供同一段大纲的不同风格生成对比：

```
┌─────────────────────────────────────────────────────────┐
│  风格预览                                              │
├───────────────┬─────────────────────────────────────────┤
│   刘慈欣      │  "太阳还有八十七分钟才会熄灭..."        │
│               │  冷静、技术细节、宇宙尺度感              │
├───────────────┼─────────────────────────────────────────┤
│   金庸        │  "那少年手握剑柄，只觉一股暖流从丹田     │
│               │  升起..."                               │
│               │  白描、动作优先、武学氛围                │
├───────────────┼─────────────────────────────────────────┤
│   余华        │  "福贵把牛牵到河边的时候，河水已经       │
│               │  冻住了..."                              │
│               │  冷峻、生存叙事、宿命感                  │
└───────────────┴─────────────────────────────────────────┘
```

### 7.3 视角自动推荐

根据用户输入的小说大纲、题材、核心设定，自动推荐最适合的 3 个作家视角。

---

## 8. 实现路线图

| 阶段 | 内容 | 预估时间 | 里程碑 |
|-----|------|---------|--------|
| **Phase 1** | 基础架构 | 1-2天 | Perspective Engine 可运行，prompt 注入工作 |
| **Phase 2** | 前端集成 | 1天 | 可以在项目配置中选择视角 |
| **Phase 3** | 内置视角库 | 2-3天 | 12+ 个作家视角内置完成 |
| **Phase 4** | 高级功能 | 2天 | 强度调节、混合视角、预览对比 |
| **Phase 5** | 测试与文档 | 1天 | 端到端测试，用户文档 |

**总计：约 1 周完成完整功能**

### Phase 1 任务分解（核心优先级）

- [ ] 创建 `core/perspective_engine.py` 骨架
- [ ] 实现 PerspectiveEngine.load() 基础功能
- [ ] 实现 Planner / Writer 注入方法
- [ ] 改造 `utils/file_utils.py` 的 `load_prompt()`
- [ ] 新增 1 个测试用 perspective（刘慈欣）
- [ ] 端到端测试：选择刘慈欣视角生成章节
- [ ] 验证：生成内容确实体现了刘慈欣风格

---

## 9. 质量保证策略

### 9.1 视角忠实度测试

为每个内置 perspective 建立自动化测试用例：

```python
def test_liu_cixin_perspective():
    """验证刘慈欣视角注入效果"""

    # 给定：刘慈欣视角 + 标准科幻大纲
    outline = "一个宇航员发现了一个奇怪的信号"

    # 当：生成章节内容
    content = generate_chapter_with_perspective(
        setting_bible="...",
        plan=outline,
        chapter_num=1,
        perspective="liu-cixin",
    )

    # 则：
    # 1. 应该包含技术细节描述（概率 > 80%）
    has_technical_details = detect_technical_terms(content)
    assert has_technical_details, "刘慈欣风格应该有技术细节描述"

    # 2. 应该使用冷静克制的陈述句
    exclamation_count = content.count('!')
    assert exclamation_count < len(content) / 500, "刘慈欣风格应该少用感叹句"

    # 3. 不应该有过度的情感宣泄
    emotion_words_count = count_emotion_words(content)
    assert emotion_words_count < len(content) / 100, "刘慈欣风格应该克制情感表达"
```

### 9.2 不破坏原有功能测试

- 不选择 perspective 时，生成质量与之前一致
- perspective 注入不会破坏原有 prompt 的硬性约束
  - 章节标题格式（第X章...）
  - 段落长度要求（每段 1-3 句话）
  - 对话单独成段

### 9.3 兼容性测试

- 已创建的项目可以平滑升级支持 perspective
- perspective 可以随时切换而不破坏已有内容
- perspective 为 None 时完全回退到默认行为

---

## 10. 后续扩展方向

1. **用户自定义视角**：允许用户上传/训练自己的作家视角
2. **视角迁移学习**：将已生成的小说整体转换为另一位作家的风格
3. **视角自动推荐**：根据小说题材和大纲，自动推荐最适合的作家视角
4. **多视角章节**：不同章节用不同作家风格来呈现不同叙事调性
5. **视角风格评分**：对生成内容做风格忠实度打分，指导用户调整强度

---

## 附录：文件变更清单

### 新增文件

```
core/
└── perspective_engine.py       # 视角注入引擎核心

perspectives/                   # 内置视角库
├── liu-cixin.yaml
├── jin-yong.yaml
├── gu-long.yaml
├── jk-rowling.yaml
├── george-rr-martin.yaml
├── yu-hua.yaml
├── haruki-murakami.yaml
├── ernest-hemingway.yaml
├── vladimir-nabokov.yaml
├── lu-xun.yaml
├── tangjiashao.yaml
└── yuyuzhu.yaml

backend/api/
└── perspectives.py             # 视角相关 API

frontend/src/components/
└── PerspectiveSelector.tsx     # 视角选择器组件
```

### 修改文件

```
utils/file_utils.py             # load_prompt 增加 perspective 参数
backend/models.py               # Project 表新增 perspective 字段
backend/api/projects.py         # 项目配置增加 perspective 接口
agents/writer_agent.py          # 透传 perspective 参数
agents/planner_agent.py         # 透传 perspective 参数
agents/critic_agent.py          # 透传 perspective 参数
agents/revise_agent.py          # 透传 perspective 参数
frontend/src/pages/ProjectOverview.tsx  # 集成到配置页
frontend/src/pages/Editor.tsx          # 集成到工作台侧边栏
```
