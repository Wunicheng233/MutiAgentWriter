# 作家 Skill 注入系统设计规范（第一阶段）

> **状态**: 待实现
> **版本**: v1.0
> **创建日期**: 2026-04-25
> **适用范围**: StoryForge AI 全系统

---

## 一、设计目标与原则

### 1.1 目标

将 **女娲造人术（Nuwa Skill Distillation System）** 蒸馏生成的高质量作家 skill，无缝注入到现有 LLM 生成管线中，实现从**策划→创作→修订**全流程的风格一致性控制。

### 1.2 核心原则

| 原则 | 说明 |
|------|------|
| **最小侵入** | 不改动现有 Agent 业务逻辑，只在 Prompt 渲染层注入 |
| **项目全局** | 同一项目固定一个 skill，保证长篇连贯性 |
| **安全优先** | 默认 `style_only` 模式，只注入写作技巧，不注入争议内容 |
| **可回滚** | skill 注入是可插拔的增强层，不注入系统正常工作 |
| **可扩展** | 为未来 skill 混搭、权重调节、结构化升级预留接口 |

---

## 二、注入范围与策略（方案 B）

### 2.1 注入 Agent 选择

| Agent | 是否注入 | 注入目的 | 理由 |
|-------|----------|----------|------|
| **Planner** |  注入 | 世界观构建、叙事结构、思想实验设计 | 从源头决定故事的灵魂气质 |
| **Writer** |  注入 | 文风、句式、词汇、节奏、表达 DNA | 最核心的风格注入点 |
| **Revise** |  注入 | 修订时遵循同一风格规则 | 避免修订"写坏"风格 |
| **Critic** |  不注入 | 保持通用质量标尺 | **关键设计决策**：避免 Critic 被作家个人偏好带偏，质量标准保持中立 |

### 2.2 注入位置统一约定

所有 Agent 的注入位置统一为：**Prompt 末尾，在所有硬性规则之后**

```
┌─────────────────────────────────────────┐
│ 【Base Prompt】 现有 Agent Prompt        │
│ 1. 身份定义                              │
│ 2. 输出格式要求（如 JSON）               │
│ 3. 业务规则（字数、剧情连贯性等）        │
│ ...                                      │
│                                          │
│ --- 分隔线 ---                           │
│                                          │
│ 【Style Layer】 作家 Skill 注入层        │ ← 新增
│ ## 写作风格约束：{作家名}                 │ ← 新增
│                                          │
│ ### 核心心智模型                         │ ← 新增
│ ...                                      │ ← 新增
│                                          │
│ ### 表达 DNA 约束                        │ ← 新增
│ ...                                      │ ← 新增
└─────────────────────────────────────────┘
```

---

## 三、Skill 资产组织方式（Vendored）

### 3.1 目录结构

```
skills/
└── authors/              # 作家 skill 目录
    ├── __init__.py
    ├── jk-rowling.md     # J.K. 罗琳
    ├── liu-cixin.md      # 刘慈欣
    ├── jin-yong.md       # 金庸
    └── ... 其他作家
```

### 3.2 Skill 文件格式约定

**必须带 YAML Frontmatter**，后跟 Markdown 正文：

```markdown
---
name: "J.K. 罗琳"
description: "奇幻世界观构建、人物成长弧线、伏笔回收大师"
version: "1.0"
created_date: "2026-04-23"
activation_pattern: ["罗琳", "哈利波特", "奇幻", "伏笔"]
safety_tags: []
genre: "fantasy"
strength_recommended: 0.7
---

# J.K. 罗琳 写作操作系统

## 核心心智模型

### 1. 契诃夫之枪原则
所有在第一幕出现的枪，第三幕必须开火。
伏笔必须回收，没有无意义的细节。

### 2. 人物成长弧线设计
主角必须经历三次重大转变：天真 → 幻灭 → 重生。
每个配角也有自己的完整弧线，不是工具人。

...（完整 skill 正文）

## 表达 DNA

### 词汇特征
- 偏爱：古老、神秘、阴影、秘密、传说、命运
- 避免：现代网络用语、过于口语化的表达

### 句式特征
- 长句与短句交替，制造节奏感
- 环境描写与心理描写穿插进行
...
```

### 3.3 Frontmatter 字段规范

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string |  | 作家中文名称 |
| `description` | string |  | 一句话简介（UI 展示用） |
| `version` | string |  | 语义化版本号 |
| `created_date` | string |  | 创建日期 |
| `activation_pattern` | string[] |  | 触发关键词数组 |
| `safety_tags` | string[] |  | 安全标签（如 `controversy`） |
| `genre` | string |  | 题材分类 |
| `strength_recommended` | float |  | 推荐注入强度 0.0-1.0 |

---

## 四、项目级配置落点

### 4.1 数据库字段扩展

利用现有的 `Project.config` JSON 字段，增量扩展：

```python
# Project.config 新增字段（无需数据库迁移）
{
  # ... 现有配置

  # ===== 作家 Skill 配置 =====
  "author_skill_id": "jk-rowling",      # null = 不使用特定作家
  "author_skill_version": "1.0",         # 可选，锁版本
  "author_skill_mode": "style_only",     # style_only | roleplay（预留）
  "author_skill_strength": 0.7,          # 注入强度 0.0-1.0
}
```

### 4.2 配置默认值

```python
DEFAULT_AUTHOR_SKILL_CONFIG = {
    "author_skill_id": None,              # 默认不启用
    "author_skill_mode": "style_only",    # 默认安全模式
    "author_skill_strength": 0.7,         # 默认平衡强度
}
```

---

## 五、核心实现：StyleLayer 注入机制

### 5.1 整体流程图

```
Orchestrator 初始化
        ↓
读取 Project.config 的 author_skill_id
        ↓
SkillLoader 加载 skills/authors/{id}.md
        ↓
SkillParser 解析 Frontmatter + 正文
        ↓
StyleExtractor 提取安全的写作相关段落（过滤争议内容）
        ↓
StrengthTrimmer 根据强度裁剪内容
        ↓
生成最终的 author_style_layer 文本
        ↓
通过 context 传递给 load_prompt()
        ↓
在 Prompt 末尾注入 {{author_style_layer}} 占位符
```

### 5.2 核心模块设计

#### 5.2.1 SkillLoader - Skill 加载器

**文件**: `core/skill_runtime/skill_loader.py`

```python
from pathlib import Path
from typing import Optional, Dict, List
import yaml
import markdown

class SkillLoader:
    """作家 Skill 加载器

    负责从 skills/authors/*.md 加载并解析作家 skill
    """

    SKILL_DIR = Path(__file__).parent.parent.parent / "skills" / "authors"

    @classmethod
    def list_available_skills(cls) -> List[Dict]:
        """列出所有可用作家 skill（用于前端下拉选择）"""
        skills = []
        for f in cls.SKILL_DIR.glob("*.md"):
            if f.stem.startswith("_"):
                continue
            frontmatter, _ = cls._parse_file(f)
            skills.append({
                "id": f.stem,
                "name": frontmatter.get("name", f.stem),
                "description": frontmatter.get("description", ""),
                "genre": frontmatter.get("genre", "other"),
                "strength_recommended": frontmatter.get("strength_recommended", 0.7),
            })
        return sorted(skills, key=lambda x: x["genre"])

    @classmethod
    def load_skill(cls, skill_id: str) -> Optional[Dict]:
        """加载指定 skill

        Returns:
            {
                "id": "jk-rowling",
                "frontmatter": {...},
                "raw_content": "完整 markdown 正文",
                "sections": {  # 按二级标题分块
                    "核心心智模型": "...",
                    "表达 DNA": "...",
                    ...
                }
            }
        """
        skill_file = cls.SKILL_DIR / f"{skill_id}.md"
        if not skill_file.exists():
            return None

        frontmatter, content = cls._parse_file(skill_file)
        sections = cls._split_into_sections(content)

        return {
            "id": skill_id,
            "frontmatter": frontmatter,
            "raw_content": content,
            "sections": sections,
        }

    @classmethod
    def _parse_file(cls, file_path: Path) -> tuple[Dict, str]:
        """解析带 YAML frontmatter 的 markdown 文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 提取 frontmatter
        if content.startswith('---\n'):
            end = content.find('\n---\n', 4)
            if end != -1:
                frontmatter = yaml.safe_load(content[4:end])
                body = content[end + 5:].strip()
                return frontmatter or {}, body

        return {}, content

    @classmethod
    def _split_into_sections(cls, content: str) -> Dict[str, str]:
        """按二级标题（## xxx）将内容分块"""
        sections = {}
        current_section = "default"
        current_content = []

        for line in content.split('\n'):
            if line.startswith('## '):
                if current_content:
                    sections[current_section] = '\n'.join(current_content).strip()
                current_section = line[3:].strip()
                current_content = []
            else:
                current_content.append(line)

        if current_content:
            sections[current_section] = '\n'.join(current_content).strip()

        return sections
```

#### 5.2.2 StyleExtractor - 安全内容提取器

**文件**: `core/skill_runtime/style_extractor.py`

```python
from typing import Dict

class StyleExtractor:
    """从完整 skill 中安全提取写作相关内容

    核心职责：过滤掉争议内容、角色扮演规则，只保留写作技巧
    """

    # 允许提取的章节标题关键词（白名单）
    ALLOWED_SECTION_KEYWORDS = {
        # 心智模型类
        "心智模型", "思维框架", "创作原则", "写作哲学",
        # 结构类
        "结构", "叙事", "情节", "伏笔", "世界观", "人物",
        # 表达类
        "表达", "文风", "句式", "词汇", "语言", "节奏", "描写",
        "表达 DNA", "写作技巧", "创作方法",
        # 规则类
        "禁忌", "注意事项", "Do's and Don'ts", "Dos and Don'ts",
    }

    # 需要过滤的关键词（黑名单）
    BLOCKED_KEYWORDS = {
        # 争议内容
        "争议", "立场", "价值观", "政治", "性别", "女权",
        # 角色扮演相关
        "第一人称", "角色扮演", "身份", "你是谁", "我是谁",
        # 社会议题
        "社会", "现实", "批判",
        # 诚实边界（系统层面处理，不注入）
        "诚实边界", "局限", "缺点", "不擅长",
    }

    @classmethod
    def extract_style_layer(cls, skill_data: Dict, mode: str = "style_only") -> str:
        """提取安全的风格层内容

        Args:
            skill_data: SkillLoader.load_skill() 返回的数据
            mode: "style_only"（默认）或 "roleplay"（慎用）

        Returns:
            可直接注入 prompt 的风格层文本
        """
        sections = skill_data.get("sections", {})
        skill_name = skill_data.get("frontmatter", {}).get("name", skill_data["id"])

        style_parts = []

        # 1. 只提取白名单章节
        for section_title, section_content in sections.items():
            if cls._is_section_allowed(section_title, mode):
                cleaned_content = cls._clean_content(section_content)
                if cleaned_content.strip():
                    style_parts.append(f"### {section_title}\n\n{cleaned_content}")

        if not style_parts:
            return ""

        # 2. 组装成统一格式
        layer_header = f"---\n\n## 写作风格约束：{skill_name}\n\n"
        layer_footer = "\n\n请在创作中遵循以上风格原则。\n"

        return layer_header + "\n\n".join(style_parts) + layer_footer

    @classmethod
    def _is_section_allowed(cls, section_title: str, mode: str) -> bool:
        """判断章节是否允许提取"""
        title_lower = section_title.lower()

        # 黑名单优先：包含任何禁止关键词的章节直接排除
        for keyword in cls.BLOCKED_KEYWORDS:
            if keyword in title_lower:
                return False

        # style_only 模式：只允许白名单章节
        if mode == "style_only":
            for keyword in cls.ALLOWED_SECTION_KEYWORDS:
                if keyword in section_title:
                    return True
            return False

        # roleplay 模式：宽松一些（但仍过滤黑名单）
        return True

    @classmethod
    def _clean_content(cls, content: str) -> str:
        """清理内容中的敏感/争议句子"""
        lines = content.split('\n')
        cleaned_lines = []

        for line in lines:
            # 包含黑名单关键词的行直接删除
            if any(keyword in line for keyword in cls.BLOCKED_KEYWORDS):
                continue
            cleaned_lines.append(line)

        return '\n'.join(cleaned_lines)
```

#### 5.2.3 StrengthTrimmer - 强度裁剪器

**文件**: `core/skill_runtime/strength_trimmer.py`

```python
class StrengthTrimmer:
    """根据注入强度裁剪风格层内容

    三级裁剪策略：
    - 低强度 (≤0.3)：只保留核心规则（禁忌 + 词汇）
    - 中强度 (≤0.7)：保留表达 DNA + 结构原则
    - 高强度 (>0.7)：完整注入（心智模型 + 一切）
    """

    @classmethod
    def trim(cls, style_layer: str, strength: float) -> str:
        """根据强度裁剪内容"""
        if strength <= 0:
            return ""

        # 按段落拆分
        sections = style_layer.split("\n\n### ")

        if strength <= 0.3:
            #  低强度：只保留词汇、禁忌、句式
            allowed_keywords = {"词汇", "禁忌", "句式", "语言", "Do", "DON'T"}
            filtered = [s for s in sections if any(k in s for k in allowed_keywords)]
            return "\n\n### ".join(filtered)

        elif strength <= 0.7:
            #  中强度：保留表达类 + 结构类
            blocked_keywords = {"心智模型", "思维框架", "创作哲学"}
            filtered = [s for s in sections if not any(k in s for k in blocked_keywords)]
            return "\n\n### ".join(filtered)

        else:
            #  高强度：完整注入
            return style_layer
```

### 5.3 Prompt 模板改造

在所有 Agent 的 prompt 模板末尾统一添加占位符：

```markdown
{# ... 现有 prompt 内容 ... #}

{{author_style_layer}}
```

### 5.4 load_prompt 集成

**文件**: `utils/file_utils.py`，改造 `load_prompt()` 函数：

```python
def load_prompt(
    agent_name: str,
    content_type: str = None,
    context: dict = None,
    perspective: str = None,              # 保留旧参数，向后兼容
    perspective_strength: float = None,   # 保留旧参数
    author_skill_id: str = None,          # 新：作家 skill id
    author_skill_strength: float = 0.7,   # 新：注入强度
) -> str:
    # ... 现有逻辑 ...

    # ===== 新增：作家 Skill 风格层注入 =====
    if author_skill_id:
        from core.skill_runtime import get_style_layer
        style_layer = get_style_layer(author_skill_id, author_skill_strength)
        if style_layer:
            content = content + "\n\n" + style_layer

    # ... 后续占位符替换逻辑 ...
```

---

## 六、Orchestrator 集成点

### 6.1 初始化时读取配置

```python
# core/orchestrator.py __init__

class NovelGenerationOrchestrator:
    def __init__(self, ..., author_skill_id: str = None, ...):
        # ... 现有初始化 ...

        # 作家 Skill 配置
        self.author_skill_id = author_skill_id
        self.author_skill_strength = project_config.get("author_skill_strength", 0.7)
        self.author_skill_mode = project_config.get("author_skill_mode", "style_only")
```

### 6.2 调用链传递

只需要在调用 `call_volc_api` 时额外传两个参数：

```python
# Planner 调用
call_volc_api(
    "planner",
    ...,
    author_skill_id=self.author_skill_id,
    author_skill_strength=self.author_skill_strength,
)

# Writer 调用
call_volc_api(
    "writer",
    ...,
    author_skill_id=self.author_skill_id,
    author_skill_strength=self.author_skill_strength,
)

# Revise 调用
call_volc_api(
    "revise",
    ...,
    author_skill_id=self.author_skill_id,
    author_skill_strength=self.author_skill_strength,
)
```

**注意**：Critic 调用**不传递** author_skill_id。

---

## 七、前端改动

### 7.1 API 新增

```python
# GET /api/author-skills
# 返回可用作家 skill 列表
Response:
{
  "skills": [
    {
      "id": "jk-rowling",
      "name": "J.K. 罗琳",
      "description": "奇幻世界观构建、人物成长弧线...",
      "genre": "fantasy",
      "strength_recommended": 0.7
    }
  ]
}
```

### 7.2 UI 改动

在**项目设置页面**新增一个下拉选择框：

```
┌─────────────────────────────────────────┐
│  作家风格                                │
│  ┌─────────────────────────────────┐   │
│  │  无特定风格（默认）           ▼ │   │
│  ├─────────────────────────────────┤   │
│  │  J.K. 罗琳 - 奇幻世界观大师     │   │
│  │  刘慈欣 - 思想实验与宏大叙事   │   │
│  │  金庸 - 武侠史诗与人物群像     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  风格强度：████████░░ 70%              │
│  (影响越大幅度越高)                     │
└─────────────────────────────────────────┘
```

---

## 八、安全与一致性策略

### 8.1 安全策略

| 策略 | 说明 |
|------|------|
| **默认 style_only** | 只提取写作技巧，不注入身份、价值观、争议内容 |
| **白名单机制** | 只有明确在白名单的章节标题才会被提取 |
| **黑名单过滤** | 内容行级别的敏感关键词过滤 |
| **可审计** | 注入到 prompt 的完整 style_layer 会被记录到 log |

### 8.2 一致性策略

| 策略 | 说明 |
|------|------|
| **项目全局固定** | 同一项目生成周期内 skill 不应变化 |
| **变更提示** | 用户修改 skill 时提示"将从下一次生成生效" |
| **版本锁定** | 生成记录中保存 author_skill_version，可复现 |

---

## 九、测试覆盖要求

### 9.1 单元测试

```
tests/test_skill_runtime/
├── test_skill_loader.py
│   ├── test_parse_frontmatter()
│   ├── test_split_sections()
│   ├── test_list_available_skills()
│   └── test_load_nonexistent_skill_returns_none()
├── test_style_extractor.py
│   ├── test_style_only_mode_extracts_only_whitelist()
│   ├── test_blocked_keywords_are_removed()
│   ├── test_empty_skill_returns_empty_layer()
│   └── test_roleplay_mode_is_more_permissive()
└── test_strength_trimmer.py
    ├── test_low_strength_keeps_only_core_rules()
    ├── test_medium_strength_keeps_expression()
    ├── test_high_strength_keeps_everything()
    └── test_zero_strength_returns_empty()
```

### 9.2 集成测试

```
tests/test_author_skill_integration.py
    ├── test_load_prompt_injects_style_layer()
    ├── test_planner_receives_style_layer()
    ├── test_writer_receives_style_layer()
    ├── test_revise_receives_style_layer()
    └── test_critic_does_not_receive_style_layer()
```

---

## 十、迭代路线图

### Phase 1 （本规范）：基础 Skill 注入

- [ ] SkillLoader / StyleExtractor / StrengthTrimmer 实现
- [ ] 集成到 load_prompt()
- [ ] 前端选择器 + API
- [ ] style_only 安全模式

### Phase 2 （规划中）：结构化 StyleProfile

- [ ] 将 skill 从 Markdown 编译成结构化 JSON
- [ ] StyleProfile schema：voice / lexicon / dos_donts / rhythm / metaphor
- [ ] Prompt 拼装只引用 JSON 字段，更可控
- [ ] 支持 skill 混搭（60% 罗琳 + 40% 刘慈欣）

### Phase 3 （构想中）：高级特性

- [ ] Agent-specific skill：不同 Agent 用不同 skill（Writer 文风，Critic 该作家式审美）
- [ ] 风格一致性评分模型：定量评估输出与目标风格的匹配度
- [ ] Skill 热插拔：生成过程中动态调整风格强度
- [ ] 自定义 Skill 上传：用户上传自己的作家 Skill

---

## 十一、核心改动文件清单

| 位置 | 改动类型 | 说明 |
|------|----------|------|
| `skills/authors/*.md` |  新增 | 作家 skill 资产目录 |
| `core/skill_runtime/__init__.py` |  新增 | 运行时模块入口 |
| `core/skill_runtime/skill_loader.py` |  新增 | Skill 加载解析 |
| `core/skill_runtime/style_extractor.py` |  新增 | 安全内容提取 |
| `core/skill_runtime/strength_trimmer.py` |  新增 | 强度裁剪 |
| `utils/file_utils.py` |  修改 | load_prompt 集成 style layer |
| `core/orchestrator.py` |  修改 | 读取 skill 配置并传递 |
| `backend/api/author_skills.py` |  新增 | Skill 列表 API |
| `frontend/src/pages/ProjectSettings.tsx` |  修改 | 新增风格选择下拉框 |
| `tests/test_skill_runtime/` |  新增 | 运行时单元测试 |

---

## 十二、向后兼容性说明

1. **无 Skill 时系统正常工作**：author_skill_id 为 null 时，style_layer 为空，不影响任何现有逻辑
2. **旧的 perspective 参数保留**：现有的 perspective/perspective_strength 参数仍可工作（未来可逐步迁移）
3. **Prompt 模板兼容**：如果模板中没有 `{{author_style_layer}}` 占位符，注入的内容会自动追加到末尾

---

**设计完成日期**: 2026-04-25
**设计评审状态**: 待实现
