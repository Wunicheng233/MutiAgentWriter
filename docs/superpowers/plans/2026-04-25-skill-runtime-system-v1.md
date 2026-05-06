# Skill 运行时系统 v1.0 实现计划

> **文档类型**: 实现计划
> **版本**: v1.0
> **创建日期**: 2026-04-25
> **预期完成时间**: 1 个开发日
> **依赖**: 无（完全向后兼容）

---

## 一、设计目标与核心理念

### 1.1 问题背景

当前系统的能力是"硬编码"在 Prompt 模板里的：
- 要加一种新的写作风格，必须改 `prompts/writer.md`
- 无法精确控制某种能力只作用于某个特定 Agent
- 用户看不到系统有哪些能力，也无法开关
- 无法组合多种能力（比如科幻世界观 + 武侠文风）
- 没有生态扩展性

### 1.2 解决方案：Skill 运行时系统

我们要做的不是"作家风格注入"，而是**小说创作领域的通用 Skill 插件系统**，类似于 Claude Code 的技能系统。

**核心设计哲学：**
```
Agent = 基础能力（大脑）
Skill = 可插拔能力插件（安装包）
用户 = 系统管理员，可以选择给哪个大脑安装什么技能
```

### 1.3 设计原则

| 原则 | 说明 |
|------|------|
| **最小侵入** | 只在 Prompt 渲染层注入，不改 Agent 业务逻辑 |
| **精确匹配** | Skill 可以精确选择作用于哪个 Agent |
| **可组合** | 多个 Skill 可以叠加使用，优先级控制顺序 |
| **可观测** | 每个 Skill 注入有清晰标记，便于调试 |
| **安全优先** | 默认安全模式，敏感内容不注入 |
| **向后兼容** | 不启用任何 Skill 时，系统行为与原来完全一致 |

---

## 二、核心概念定义

### 2.1 Skill

**Skill 是一个可插拔的能力单元**，包含：
- 元数据声明（id、名称、描述、版本）
- 适用范围声明（适用于哪些 Agent）
- 优先级（决定注入顺序）
- Prompt 注入文本
- 配置 Schema（前端自动生成 UI）
- 依赖声明（预留）

### 2.2 Skill Registry（Skill 注册表）

系统启动时自动扫描 `skills/` 目录，加载所有 Skill，形成注册表。

### 2.3 Skill Assembler（Skill 装配器）

运行时根据当前 Agent 类型和项目配置，筛选出应该注入的 Skill，排序并组装。

### 2.4 Skill Injector（Skill 注入引擎）

将组装好的 Skill 层注入到 Prompt 模板的指定位置。

---

## 三、三层系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│  第一层：项目配置层 (Project Config Layer)                        │
│                                                                   │
│  用户视角：在项目设置里勾选"启用哪些 Skill"                        │
│                                                                   │
│  Project.config.skills.enabled = [                                │
│    {                                                              │
│      skill_id: "author-jk-rowling",                               │
│      applies_to_override: ["writer", "revise"],  // 用户选择     │
│      config: {strength: 0.7}                                      │
│    },                                                             │
│    {skill_id: "foreshadowing-tracker", applies_to: ["critic"]}    │
│  ]                                                                │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  第二层：Skill 运行时层 (Skill Runtime Layer)                      │
│                                                                   │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │ Skill 注册表  │───▶│  Skill 装配器     │───▶│  注入引擎    │  │
│  │ 扫描目录     │    │  过滤 + 排序      │    │  文本拼接    │  │
│  └──────────────┘    └────────┬─────────┘    └──────┬───────┘  │
│                               │                       │          │
│  Skill 加载                  匹配算法               优先级排序   │
│  Frontmatter 解析            用户配置覆盖           冲突检测     │
└───────────────────────────────┼───────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  第三层：多智能体层 (Multi-Agent Layer)                           │
│                                                                   │
│     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│     │   Planner    │  │    Writer    │  │    Revise    │        │
│     │  故事架构师   │  │   叙事作家    │  │  内容修订师   │        │
│     │              │  │              │  │              │        │
│     │ [Skill A]    │  │ [Skill A]    │  │ [Skill A]    │        │
│     │ [Skill B]    │  │ [Skill C]    │  │ [Skill D]    │        │
│     │              │  │              │  │              │        │
│     └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                   │
│                      ┌──────────────────┐                         │
│                      │      Critic      │                         │
│                      │   章节评审员      │                         │
│                      │                  │                         │
│                      │    隔离层       │                         │
│                      │  不注入任何 Skill │                         │
│                      └──────────────────┘                         │
└───────────────────────────────────────────────────────────────────┘
```

---

## 四、Skill 目录结构与文件规范

### 4.1 目录结构

```
skills/
├── _registry.json      // 自动生成的注册表缓存
│
├── author-jk-rowling/  // Skill ID = 目录名
│   ├── skill.json      //  元数据声明（必选）
│   ├── injection.md    //  Prompt 注入文本（必选）
│   ├── config.json     // 可选：默认配置
│   ├── hooks.py        // 可选：可执行钩子（预留）
│   └── README.md       // 可选：人读说明
│
├── author-liu-cixin/
│   ├── skill.json
│   ├── injection.md
│   └── README.md
│
├── author-jin-yong/
│   └── ...
│
└── foreshadowing-tracker/  // 非作家风格的 Skill 示例
    ├── skill.json
    ├── injection.md
    └── README.md
```

### 4.2 skill.json - Skill 元数据声明（完整 Schema）

```json
{
  // ===== 基础标识 =====
  "id": "author-jk-rowling",
  "name": "J.K. 罗琳 写作系统",
  "description": "奇幻世界观构建、人物成长弧线、伏笔回收大师",
  "version": "1.0",
  "author": "女娲造人术",
  "created_date": "2026-04-23",

  // ===== 核心：适用范围声明 =====
  // 这个 Skill 适用于哪些 Agent
  "applies_to": ["planner", "writer", "revise"],

  // 优先级：数字越小越先注入，数字越大越靠后（影响越大）
  // 约定：
  //   0-50: 基础能力、工程质量类
  //   50-150: 作家风格类
  //   150+: 特殊定制、实验性 Skill
  "priority": 100,

  // 分类标签（便于 UI 分组展示）
  "tags": ["author-style", "fantasy", "worldbuilding"],

  // ===== 配置 Schema（前端自动生成 UI）=====
  "config_schema": {
    "strength": {
      "type": "float",
      "default": 0.7,
      "min": 0.0,
      "max": 1.0,
      "label": "注入强度",
      "description": "数值越高，风格影响越明显"
    },
    "mode": {
      "type": "string",
      "enum": ["style_only", "full"],
      "default": "style_only",
      "label": "注入模式",
      "description": "style_only 只注入写作技巧，full 包含角色扮演"
    }
  },

  // ===== 安全标签 =====
  "safety_tags": [
    "safe_for_all",  // 安全，无争议内容
    // "controversial"  // 有争议，需要用户确认才能启用
  ],

  // ===== 依赖（预留）=====
  "dependencies": []
}
```

### 4.3 injection.md - Prompt 注入文本

```markdown
---
# 可选：按 Agent 区分注入内容
# 如果不指定，所有 Agent 用同一份
target: all
# 也可以分别指定：
# planner: |
#   仅给 Planner 注入的内容
# writer: |
#   仅给 Writer 注入的内容
---

## J.K. 罗琳 写作操作系统

### 核心心智模型

#### 1. 契诃夫之枪原则
所有在第一幕出现的枪，第三幕必须开火。
伏笔必须回收，没有无意义的细节。

#### 2. 人物成长弧线设计
主角必须经历三次重大转变：天真 → 幻灭 → 重生。
每个配角也有自己的完整弧线，不是工具人。

### 表达 DNA 约束

#### 词汇特征
- 偏爱：古老、神秘、阴影、秘密、传说、命运
- 避免：现代网络用语、过于口语化的表达

#### 句式特征
- 长句与短句交替，制造节奏感
- 环境描写与心理描写穿插进行
```

---

## 五、Skill → Agent 匹配机制详解

### 5.1 三层匹配规则

```
1. Skill 默认声明 → 2. 用户配置覆盖 → 3. 运行时白名单检查
         ↓                    ↓                    ↓
   applies_to          applies_to_override     系统安全白名单
```

### 5.2 匹配算法伪代码

```python
def should_apply_skill(skill: Skill, agent_name: str, project_config: dict) -> bool:
    """
    判断一个 Skill 是否应该注入到指定的 Agent

    优先级：用户覆盖 > Skill 默认声明 > 系统安全白名单
    """

    # Step 1: 系统安全白名单检查（最高优先级）
    # Critic 永远不注入任何 Skill（保持中立质量标尺）
    if agent_name == "critic":
        return False

    # Step 2: 检查用户是否有覆盖配置
    user_override = project_config.get("skills", {}).get("enabled", [])
    for skill_config in user_override:
        if skill_config["skill_id"] == skill.id:
            if "applies_to_override" in skill_config:
                # 用户明确指定了适用范围，直接用这个
                return agent_name in skill_config["applies_to_override"]

    # Step 3: 没有用户覆盖，用 Skill 默认声明
    return agent_name in skill.applies_to
```

### 5.3 示例：一个混合风格项目的配置

```python
# Project.config
{
  "skills": {
    "enabled": [
      # Skill 1: 刘慈欣 - 只给 Planner 用（构建科幻世界观）
      {
        "skill_id": "author-liu-cixin",
        "applies_to_override": ["planner"],
        "config": {"strength": 0.9}
      },

      # Skill 2: 金庸 - 只给 Writer 用（武侠文风）
      {
        "skill_id": "author-jin-yong",
        "applies_to_override": ["writer"],
        "config": {"strength": 0.7}
      },

      # Skill 3: 伏笔追踪器 - 只给 Critic 用
      {
        "skill_id": "foreshadowing-tracker",
        "applies_to_override": ["critic"],  // 注意：系统会拦截，因为 Critic 在白名单外
        "config": {"strictness": "high"}
      },

      # Skill 4: 一致性检查 - 给所有人用
      {
        "skill_id": "consistency-checker",
        "applies_to_override": ["planner", "writer", "revise"]
      }
    ]
  }
}
```

**最终各 Agent 获得的 Skill 组合：**

| Agent | 注入的 Skill | 实际效果 |
|-------|-------------|---------|
| **Planner** | 刘慈欣 + 一致性检查 | 世界观是科幻硬核风 |
| **Writer** | 金庸 + 一致性检查 | 文字是武侠文风，但世界观是科幻的 |
| **Revise** | 一致性检查 | 只关注一致性，不改文风 |
| **Critic** |  无 | 保持中立质量标尺 |

---

## 六、完整运行时注入流程

### 6.1 流程图

```
用户点击"生成下一章"
        │
        ▼
┌─────────────────────────────────────────────────┐
│  1. Orchestrator 读取项目配置                    │
│     - 读取 Project.config.skills.enabled        │
│     - 得到启用的 Skill ID 列表                   │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  2. Skill 注册表加载                            │
│     - 从 skills/{id}/skill.json 加载完整对象    │
│     - 从 skills/{id}/injection.md 加载注入文本  │
│     - 验证 Skill 完整性与版本                   │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  3. Skill 装配器过滤                            │
│     对每个 Skill：                              │
│     ├─  匹配算法：这个 Skill 适用于当前 Agent? │
│     ├─  强度裁剪：根据 strength 裁剪内容      │
│     ├─  安全过滤：提取 style_only 内容        │
│     └─  不通过的 Skill 直接丢弃               │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  4. 按优先级排序                                │
│     - priority 小的在前（先注入）               │
│     - priority 大的在后（后注入，影响力更大）   │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  5. Skill 冲突检测（可选）                      │
│     - 检测是否有明显矛盾的指令                  │
│     - 记录警告日志，但不阻断流程                │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  6. Skill 层组装                                │
│     - 每个 Skill 加上分隔标记                    │
│     - 加上 Skill ID 和优先级                    │
│     - 拼接成完整的 skill_layer 文本             │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  7. Prompt 渲染层注入                           │
│     load_prompt()                               │
│     ├─ 加载基础 Prompt 模板                     │
│     ├─ 替换其他占位符（world_bible 等）        │
│     └─ 追加 {{skill_layer}} 到 Prompt 末尾      │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  8. LLM 调用                                    │
│     - 注入的 Skill 成为系统 Prompt 的一部分     │
│     - LLM 自然遵循所有 Skill 的指令             │
└─────────────────────────────────────────────────┘
```

### 6.2 注入结果示例

**假设启用了 3 个 Skill，最终注入到 Writer 的 Prompt 末尾：**

```markdown
---

## ════════════════════════════════════
## Skill Layer Start (3 skills enabled)
## ════════════════════════════════════

## Skill: consistency-checker (priority: 50)
### 一致性检查系统
确保：
- 人物名字前后一致
- 时间线不出现矛盾
- 地理设定保持统一

---

## Skill: author-liu-cixin (priority: 100)
### 刘慈欣写作操作系统
#### 核心心智模型
1. 思想实验公理框架：设定几个不可动摇的公理...
2. 技术爆炸思维：技术发展是指数级的...

#### 表达DNA
- 短句为主，少用形容词
- 偏爱尺度词汇：光年、维度、熵、奇点

---

## Skill: author-jin-yong (priority: 200)
### 金庸写作操作系统
#### 叙事节奏
- 张弛有度，打斗与文戏交替
- 人物出场先声夺人

## ════════════════════════════════════
## Skill Layer End
## ════════════════════════════════════

请在创作中遵循以上所有 Skill 的原则。
```

**关键设计点：**
- 清晰的分隔标记，便于调试时定位问题来源
- 优先级数字明确标注
- Skill ID 明确，便于禁用有问题的 Skill

---

## 七、多 Skill 组合与冲突解决

### 7.1 优先级叠加原则

```
Skill Priority 决定注入顺序
后注入的内容（数字大）影响力更大

priority: 50   → 先注入，基础层
priority: 100  → 在上面叠加
priority: 200  → 最后注入，影响最大（LLM 对末尾内容记忆更深）
```

### 7.2 冲突解决策略

**当前策略（V1）：不做自动解决，只做检测告警**

```python
# Skill 冲突检测器
class SkillConflictDetector:
    CONFLICT_PATTERNS = {
        "对话风格": {
            "书面化": ["书面语", "正式", "避免口语"],
            "口语化": ["口语", "接地气", "民间"],
        },
        "句子长度": {
            "短句优先": ["短句", "简短", "简洁"],
            "长句优先": ["长句", "复杂句", "修辞"],
        },
    }

    def detect(self, skills: List[Skill]) -> List[ConflictWarning]:
        """检测冲突，返回警告列表，不阻断执行"""
        # ... 检测逻辑
```

**未来策略（V2）：**
- 用户可以手动调整优先级顺序
- 支持 Skill 权重配置
- 自动合并相似指令

---

## 八、与现有系统的集成点

### 8.1 新增文件清单

```
# ===== 核心运行时 =====
core/skill_runtime/
├── __init__.py
├── skill_registry.py       # Skill 注册表：扫描目录、加载 Skill
├── skill_assembler.py      # Skill 装配器：过滤、排序、冲突检测
├── skill_injector.py       # Skill 注入引擎：文本拼接、渲染
└── safety_filter.py        # 安全过滤器：敏感内容过滤

# ===== 新增目录 =====
skills/                     # Skill 仓库目录
├── author-jk-rowling/      # J.K. 罗琳
├── author-liu-cixin/       # 刘慈欣
└── ...

# ===== 测试 =====
tests/test_skill_runtime/
├── test_skill_registry.py
├── test_skill_assembler.py
├── test_skill_injector.py
└── test_safety_filter.py
```

### 8.2 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `utils/file_utils.py` | `load_prompt()` 新增 Skill 注入逻辑 |
| `core/orchestrator.py` | 读取 Skill 配置、传递给调用链 |
| `utils/volc_engine.py` | 透传 Skill 相关参数给 `load_prompt()` |
| `backend/api/skills.py` | 新增 Skill 列表 API |
| `prompts/*.md` | 末尾加上 `{{skill_layer}}` 占位符 |

### 8.3 调用链修改

```python
# 调用链只新增 2 个参数，不改变其他逻辑
call_volc_api(
    agent_name: str,
    user_input: str,
    # ... 现有参数 ...

    # 新增：Skill 相关
    skill_ids: List[str] = None,           # 启用的 Skill ID 列表
    skill_configs: Dict[str, Dict] = None,  # 每个 Skill 的配置
)
```

---

## 九、实现路线图与任务分解

### Phase 1: 基础运行时（预计 4 小时）

- [ ] 目录结构创建：`core/skill_runtime/` + `skills/`
- [ ] `SkillRegistry` 实现：目录扫描、JSON 解析、injection.md 加载
- [ ] 把 `liu-cixin-perspective` 转换成 Skill 格式放入 `skills/`
- [ ] 把 `jk-rowling-perspective` 转换成 Skill 格式放入 `skills/`

### Phase 2: 装配器与注入引擎（预计 3 小时）

- [ ] `SkillAssembler` 实现：匹配算法、过滤、排序
- [ ] `SkillInjector` 实现：文本拼接、标记插入
- [ ] `SafetyFilter` 实现：黑名单关键词过滤
- [ ] `StrengthTrimmer` 实现：按强度裁剪内容

### Phase 3: 系统集成（预计 2 小时）

- [ ] 集成到 `load_prompt()`
- [ ] Orchestrator 配置读取
- [ ] 调用链参数透传
- [ ] 所有 Prompt 模板加 `{{skill_layer}}` 占位符

### Phase 4: API 与前端（预计 2 小时）

- [ ] `GET /api/skills` - 列出可用 Skill
- [ ] `POST /api/projects/{id}/skills` - 更新项目 Skill 配置
- [ ] 前端项目设置页：Skill 选择器 UI

### Phase 5: 测试（预计 3 小时）

- [ ] SkillRegistry 单元测试
- [ ] SkillAssembler 单元测试
- [ ] SkillInjector 单元测试
- [ ] SafetyFilter 单元测试
- [ ] 集成测试：端到端 Skill 注入验证

**总计：约 14 小时开发工作量**

---

## 十、测试覆盖要求

### 10.1 单元测试矩阵

| 模块 | 测试用例 |
|------|---------|
| **SkillRegistry** | `test_scan_skills_directory()` |
| | `test_load_skill_success()` |
| | `test_load_nonexistent_skill_returns_none()` |
| | `test_parse_skill_json_success()` |
| | `test_parse_injection_md_success()` |
| | `test_missing_required_fields_raises_error()` |
| **SkillAssembler** | `test_applies_to_matches_correctly()` |
| | `test_applies_to_override_takes_priority()` |
| | `test_critic_never_receives_skills()` |
| | `test_priority_sorting_is_correct()` |
| | `test_empty_skill_list_returns_empty_layer()` |
| **SkillInjector** | `test_skills_are_concatenated()` |
| | `test_skill_markers_are_added()` |
| | `test_inject_into_prompt_appends_to_end()` |
| | `test_placeholder_not_present_automatically_appends()` |
| **SafetyFilter** | `test_blocked_keywords_are_removed()` |
| | `test_roleplay_content_is_removed_in_safe_mode()` |
| | `test_safe_content_passes_unchanged()` |
| **StrengthTrimmer** | `test_zero_strength_removes_skill()` |
| | `test_low_strength_keeps_only_core()` |
| | `test_high_strength_keeps_everything()` |

### 10.2 集成测试

```python
# tests/test_skill_integration.py
def test_skill_injected_into_planner():
    """Planner 应该收到 Skill 注入"""

def test_skill_injected_into_writer():
    """Writer 应该收到 Skill 注入"""

def test_skill_injected_into_revise():
    """Revise 应该收到 Skill 注入"""

def test_no_skill_injected_into_critic():
    """Critic 永远不应该收到 Skill 注入"""

def test_multiple_skills_composed_correctly():
    """多个 Skill 应该正确组合注入"""

def test_disabled_skill_not_injected():
    """禁用的 Skill 不应该注入"""
```

---

## 十一、安全策略

### 11.1 默认安全原则

| 策略 | 说明 |
|------|------|
| **默认关闭** | 新项目默认不启用任何 Skill，行为与原系统一致 |
| **安全模式默认开启** | 所有 Skill 默认用 `style_only` 模式注入 |
| **Critic 隔离** | Critic 永远不注入任何 Skill，保持中立 |
| **黑名单过滤** | 注入前扫描内容，移除敏感关键词 |
| **可审计** | 注入的完整 Skill layer 会被记录到日志 |

### 11.2 内容安全过滤器

```python
BLOCKED_PATTERNS = {
    # 角色扮演相关
    "你是", "我是", "扮演", "身份是", "请你作为",
    # 争议内容相关
    "政治", "意识形态", "价值观", "立场",
    # 诚实边界相关（系统层面处理，不注入）
    "我不擅长", "我的局限", "我不会",
}
```

---

## 十二、向后兼容性保证

### 12.1 无 Skill 时系统行为不变

```python
# 如果项目没有启用任何 Skill
if not skill_ids:
    skill_layer = ""  # 注入空字符串

# 效果：Prompt 与原来完全一样，LLM 输出也完全一样
```

### 12.2 旧的 perspective 参数继续工作

```python
# 为了向后兼容，旧的 perspective 参数映射成一个内置 Skill
LEGACY_PERSPECTIVE_MAPPING = {
    "liu-cixin": "builtin:author-liu-cixin",
    "jk-rowling": "builtin:author-jk-rowling",
}

# 如果用户传了旧的 perspective 参数，自动转换
if perspective and not skill_ids:
    skill_ids = [LEGACY_PERSPECTIVE_MAPPING.get(perspective)]
```

### 12.3 数据库迁移：零成本

不需要数据库迁移，直接利用现有的 `Project.config` JSON 字段增量扩展。

---

## 十三、未来扩展方向

### V1.1 规划（Skill 增强）

- [ ] Skill 依赖管理
- [ ] Skill 版本锁定
- [ ] Skill 配置的前端表单自动生成

### V2 规划（高级特性）

- [ ] 结构化参数注入（不只是文本，还能改 Agent 行为参数）
- [ ] Skill Hook 系统：Skill 可以在生成前后执行代码
- [ ] Skill 市场：用户可以上传、分享、下载 Skill

### V3 规划（生态）

- [ ] Skill 评分系统
- [ ] Skill 效果定量评估
- [ ] 社区贡献与审核机制

---

## 十四、核心代码位置速查

| 模块 | 文件路径 | 核心职责 |
|------|---------|---------|
| Skill 注册表 | `core/skill_runtime/skill_registry.py` | 目录扫描、加载、缓存 |
| Skill 装配器 | `core/skill_runtime/skill_assembler.py` | 匹配、过滤、排序、冲突检测 |
| Skill 注入引擎 | `core/skill_runtime/skill_injector.py` | 文本拼接、Prompt 注入 |
| 安全过滤器 | `core/skill_runtime/safety_filter.py` | 敏感内容过滤、安全模式 |
| 强度裁剪器 | `core/skill_runtime/strength_trimmer.py` | 按强度裁剪内容 |
| Skill 资产 | `skills/*/` | 所有 Skill 的存储目录 |
| 集成点 | `utils/file_utils.py:load_prompt()` | Prompt 渲染层注入 |
| 配置入口 | `core/orchestrator.py` | 读取项目 Skill 配置 |

---

**计划完成日期**: 2026-04-25
**计划评审状态**: 待实现
**预计开发时间**: 14 小时
