# StoryForge AI - 详细工作流与Agent职责定义

本文档详细描述了多智能体协作小说生成系统的完整工作流程，以及每个Agent的职责、输入、输出定义。

---

## 目录

1. [整体架构概览](#整体架构概览)
2. [Agent 职责与输入输出明细](#agent-职责与输入输出明细)
3. [完整创作流程](#完整创作流程)
4. [数据流向图](#数据流向图)

---

## 整体架构概览

**核心设计原则**：单一职责，每个Agent只做一件事；流水线作业，前一步输出是后一步输入；可迭代优化，质量不达标自动回退修复。

```
用户创建项目
    ↓
Planner：生成整体大纲
    ↓
Guardian：生成设定圣经（原子化人设世界观）
    ↓
逐章生成循环 {
    Writer：生成本章初稿
    ↓
[系统硬伤检查] (标题格式/字数偏差/段落长度)
    ↓ (不通过)
Polish 精修 → 返回硬伤检查
    ↓ (通过)
Critic 深度评审
    ↓ (不通过)
Editor 修改 → 返回 Critic 复评
    ↓ (通过)
Quality 终评打分 → 保存评分
    ↓
Compliance 合规检查
    ↓ (不通过)
Editor 修正 → 返回 Compliance
    ↓ (通过)
Guardian 设定一致性终检
    ↓
保存章节，更新世界观状态
}
    ↓
全部完成 → 可导出
```

**错误处理**：任何 Agent 输出格式解析失败 → 触发 Fix Agent 修复格式 → 返回重新检查

---

## Agent 职责与输入输出明细

### 1. Planner - 顶层策划师

**职责**：根据用户需求和设定圣经，生成整体情节框架、分卷分章大纲。

**对应 Prompt**：
- `planner.md` - 默认（长篇小说）
- `planner_short_story.md` - 短篇小说
- `planner_script.md` - 剧本/短剧

**占位符（代码层面自动替换）**：

| 占位符 | 说明 | 来源 |
|--------|------|------|
| `{{world_bible}}` | 完整设定圣经 | 项目目录已生成的 `setting_bible.md` |
| `{{genre}}` | 小说题材（如：都市重生、玄幻穿越） | 用户输入 `user_requirements` |
| `{{platform}}` | 目标平台（番茄/起点/知乎） | 用户输入 |
| `{{total_words}}` | 目标总字数 | 用户输入 |
| `{{core_hook}}` | 核心卖点/高概念 | 用户输入 |

**输入**（代码层面）：
```python
generate_plan(
    core_requirement: str,      # 用户核心创作需求描述
    target_platform: str,       # 目标平台
    chapter_word_count: str,    # 单章目标字数
    content_type: str,          # 内容类型 full_novel/short_story/script
    world_bible: str = "",      # 已存在的设定圣经（若有）
    genre: str = "",            # 题材
    total_words: str = "",      # 总字数
    core_hook: str = "",        # 核心钩子
) -> str
```

**输出**：
- 完整的 Markdown 格式策划案，包含：
  - 题材定位与核心卖点
  - 核心人物锚点
  - 世界观背景规则
  - 全书爽点/钩子体系
  - 分卷分章剧情节点卡（每章包含：开篇钩子、剧情推进、爽点爆发、结尾悬念）

---

### 2. Guardian - 设定圣经守护者

**职责**：
1. **模式 A：生成设定圣经** - 将 Planner 的宏观策划转化为**原子级、不可违背**的设定条款
2. **模式 B：校验内容一致性** - 检查新生成章节是否与已有设定冲突

**对应 Prompt**：`guardian.md`

**占位符**：

| 占位符 | 说明 |
|--------|------|
| `{{action}}` | `generate_bible` / `validate_content` |
| `{{planner_output}}` | Planner 生成的完整策划案 |
| `{{user_preferences}}` | 用户额外设定要求 |
| `{{project_name}}` | 项目/小说名称 |
| `{{content_to_check}}` | 待校验的章节正文 |
| `{{context_chapter_num}}` | 当前章节号 |
| `{{established_lore}}` | 数据库中的设定圣经全文 |

**输入**：

```python
# 模式 A
generate_setting_bible(
    plan: str,                       # Planner 输出的策划案
    project_name: str = "未命名项目",
    user_preferences: str = "",
) -> str

# 模式 B
check_setting_consistency(
    setting_bible: str,              # 完整设定圣经
    draft: str,                      # 待检查章节
    chapter_num: int = 0,            # 章节号
) -> str
```

**输出**：
- **模式 A**：Markdown 格式 `setting_bible.md`，包含：
  - 人物谱系与档案（每个角色有精确能力/性格/目标）
  - 世界观底层规则（时代科技对照表）
  - 人物关系图谱
- **模式 B**：文本格式，列出所有违规项，说明问题在哪、应如何修改

---

### 世界观状态管理器 (Worldview Manager) - 系统模块

**职责**：在每章定稿后，解析章节内容，提取时间推进、新登场角色、新埋设伏笔，更新 `worldview_state.json`。

**功能**：
- 跟踪整个故事的时间线演进
- 记录所有已登场角色的关键信息
- 管理所有伏笔的埋设与回收状态
- 为后续章节生成提供全局约束（避免设定冲突和伏笔烂尾）

**实现方式**：
- 调用轻量级 LLM 做结构化提取
- 更新后的状态持久化到项目目录，供后续章节生成时检索参考

**输出**：更新后的 `worldview_state.json` 包含：
- `timeline`: 时间线演进记录
- `characters`: 所有已登场角色信息
- `foreshadows`: 所有伏笔的状态追踪

---

### 3. Writer - 正文作家

**职责**：根据大纲、设定、上一章结尾，生成本章正文。

**对应 Prompt**：
- `writer.md` - 默认（长篇小说）
- `writer_script.md` - 剧本/短剧

**占位符**：

| 占位符 | 说明 |
|--------|------|
| `{{world_bible}}` | 完整设定圣经 |
| `{{chapter_outline}}` | 本章来自 Planner 的剧情节点卡 |
| `{{previous_chapter_ending}}` | 上一章结尾内容 |
| `{{target_word_count}}` | 本章目标字数 |
| `{{chapter_title}}` | 本章标题（最终生成标题后填入） |

**输入**：

```python
generate_chapter(
    setting_bible: str,              # 设定圣经全文
    plan: str,                       # 全书大纲
    chapter_num: int,                # 当前章节号
    prev_chapter_end: str = "",      # 上一章结尾内容
    related_content: str = "",       # 向量检索出的相关历史内容
    constraints: dict = None,        # 世界观全局约束（来自 worldview_manager）
    target_word_count: int = 2000,   # 目标字数
    content_type: str = "full_novel",
) -> str
```

**输出**：
- 完整章节正文，格式要求：
  - 第一行：`第X章 章节标题`
  - 短段落（每段1-3句话）
  - 对话单独成段
  - 结尾留下悬念钩子

---

### 4. Quality - 质量评分员

**职责**：对已通过系统硬伤检查的章节进行多维度量化评分，输出 JSON 供系统判断是否需要优化。

**前置依赖**：系统已完成硬性格式检查（章节标题格式、字数偏差、段落长度），若硬性检查不通过，则直接触发 Polish Agent 修复，不进入评分流程。

**对应 Prompt**：`quality.md`

**评分维度**：

| 维度 | 权重 | 考察点 |
|------|------|--------|
| `plot` | 30% | 主线推进、逻辑通顺、节奏松紧 |
| `character` | 25% | 人设一致性、情绪转变自然度 |
| `rhythm` | 20% | 结尾悬念吸引力、整体节奏感 |
| `writing` | 15% | 语言流畅度、AI套话、排版格式 |
| `compliance` | 10% | 世界观一致性、内容合规 |

**占位符**：

| 占位符 | 说明 |
|--------|------|
| `{{chapter_content}}` | 待评分章节正文 |
| `{{world_bible_summary}}` | 设定圣经摘要（用于一致性参考） |

**输入**：

```python
score_chapter_quality(
    content: str,                    # 章节正文
    setting_bible: str,              # 设定圣经
) -> dict
```

**输出**（JSON 格式）：

```json
{
  "scores": {
    "plot": 8,
    "character": 7,
    "rhythm": 8,
    "writing": 7,
    "compliance": 10
  },
  "total": 7.85,
  "passed": true,
  "issues": [
    "结尾悬念不够吸引人",
    "两处AI套话重复"
  ]
}
```

**及格规则**：
- `total >= 6.0` → `passed = true` → 直接通过
- `total < 6.0` → `passed = false` → 触发 Polish 优化

---

### 5. Polish - 内容精修师

**职责**：在**100%保留原剧情、人设、设定不变**的前提下，根据指出的问题做精准修复优化。属于"文字外科手术"，只改表达，不动剧情。

**问题来源**：Quality 评分中的 `issues` 字段，或系统硬伤检查结果。

**修复范围**：
- ✅ 格式问题、AI套话、冗余描写、字数偏差、情绪过渡、悬念微调
- ❌ 情节逻辑、人设修改、节奏重组（这些由 Editor 处理）

**对应 Prompt**：`polish.md`

**占位符**：

| 占位符 | 说明 |
|--------|------|
| `{{original_chapter_content}}` | 待精修的原始章节正文 |
| `{{polish_issues}}` | 问题列表（来自 Quality 或系统检查） |
| `{{target_word_count}}` | 本章应达到的目标字数 |
| `{{chapter_title}}` | 原章节标题（必须原样保留） |

**问题修复策略矩阵**：

| 问题类型 | 修复策略 | 禁止操作 |
|----------|----------|----------|
| AI套话/模板词 | 替换为具体动作描写或更自然表达 | 不能删除承载情节的句子 |
| 情绪转换生硬 | 插入 1-2 句过渡描写（动作/环境/内心闪念） | 不能改变情绪本身 |
| 结尾悬念生硬 | 从疑问句改为展示反常现象/未完成动作 | 不能改变悬念指向 |
| 冗余描写 | 压缩环境/外貌描写到 1-2 句关键细节 | 不能删除伏笔性描写 |
| 字数超标/不足 | 超标删冗余，不足加少量互动描写 | 不能添加新情节 |
| 格式问题 | 拆分长段落，确保对话单独成段 | 不能修改内容顺序 |

**输入**：

```python
optimize_quality(
    original_text: str,
    target_word_count: int,
    setting_bible: str,
    feedback: str,
    chapter_num: int = None,
    prev_chapter_end: str = "",
) -> str
```

**输出**：
- 精修后的**完整章节正文**，只输出正文，不附加任何说明

---

### 6. Critic - 深度批评家

**职责**：对刚写完的章节进行深度评审，从五个维度挑出问题，并给出具体修改建议。比 Quality 更深度、更 qualitative。

**对应 Prompt**：`critic.md`

**占位符**：

| 占位符 | 说明 |
|--------|------|
| `{{chapter_content}}` | 待评审章节正文 |
| `{{world_bible_summary}}` | 设定圣经摘要 |
| `{{previous_chapter_ending}}` | 上一章结尾（用于衔接判断） |

**评审维度**：
1. **剧情逻辑** - 主线推进、逻辑通顺、节奏把控
2. **人设一致性** - 人设不OOC、情绪转变自然度
3. **吸引力** - 结尾悬念吸引力、钩子设计
4. **文笔质量** - 流畅度、AI套话去除、排版格式
5. **设定一致性** - 世界观一致性、无矛盾

**输入**：

```python
critic_chapter(
    edited: str,                     # 待评审章节
    target_word_count: int,          # 目标字数
    chapter_num: int,                # 章节号
    setting_bible: str,              # 设定圣经
) -> tuple[dict, float, bool]
```

**输出**：JSON 格式评审报告

```json
{
  "scores": {
    "plot": 8,
    "character": 7,
    "attraction": 8,
    "writing": 7,
    "consistency": 10
  },
  "total": 7.85,
  "passed": false,
  "issues": [
    {
      "dimension": "plot",
      "severity": "high",
      "location": "第三章中段",
      "description": "主角动机转变突兀",
      "suggestion": "添加一段内心活动描写铺垫动机转变"
    }
  ]
}
```

- 返回 `(评审结果字典, 总分, 是否通过)`
- 及格线：`total >= 8.0`

**复评机制**：Editor 修改完成后，系统将修改稿再次提交 Critic 评审。若仍不通过（total < 8.0），继续迭代修改，最多重试 3 次。若超过重试次数，系统将暂停并通知用户介入。

---

### 7. Editor - 修改专家

**职责**：根据 Critic 深度评审提出的修改意见，在原文基础上进行深度修改。保留好的部分，只改有问题的部分。处理情节逻辑、人设偏差、节奏重组等深度问题。

**对应 Prompt**：`editor.md`

**占位符**：

| 占位符 | 说明 |
|--------|------|
| `{{original_chapter_content}}` | 待修改的原始章节 |
| `{{critic_feedback}}` | Critic 输出的问题清单及修改建议 |
| `{{world_bible}}` | 完整设定圣经（用于保持设定一致性） |

**输入**：

```python
edit_chapter(
    original_text: str,              # 原文
    critic_feedback: str,            # Critic 评审意见
    setting_bible: str,              # 设定圣经（保持一致性）
) -> str
```

**输出**：修改后的完整章节正文

---

### 8. Compliance - 合规检查员

**职责**：检查内容是否违反合规政策（色情、暴力、政治敏感等），防止输出违规内容。

**对应 Prompt**：`compliance.md`

**输入**：

```python
check_compliance(content: str) -> str
```

**输出**：
- `【通过】` → 合规
- `【不通过】` + 问题说明 → 不合规，需要修改

---

### 9. Fix - 修复专家

**职责**：当任务执行失败（格式错误、JSON 解析错误）时，自动修复输出格式，让它符合要求。

**对应 Prompt**：`fix.md`

**输入**：

```python
fix_all_issues(
    current_draft: str,
    target_word_count_int: int,
    setting_bible: str,
    all_problems_text: str,
    chapter_num: int,
    prev_chapter_end: str,
) -> str
```

**输出**：修复后的完整章节

---

---

## 完整创作流程

### 阶段一：项目初始化 & 顶层策划

**步骤 1：用户输入**
- 项目名称
- 小说描述/核心需求
- 题材 `genre`
- 目标平台 `platform`（番茄/起点/知乎）
- 总字数 `total_words`
- 单章字数 `chapter_word_count`
- 起始章节 `start_chapter`
- 结束章节 `end_chapter`
- 内容类型 `content_type`：`full_novel` / `short_story` / `script`

**步骤 2：Planner 生成大纲**
- 加载对应 prompt（根据 content_type 选择）
- 代码替换所有占位符
- 调用 LLM 生成完整策划案
- 保存为 `outputs/{project}/novel_plan.md`

**步骤 3：Guardian 生成设定圣经**
- Planner 输出 → Guardian 生成原子化设定圣经
- 保存为 `outputs/{project}/setting_bible.md`
- 加载到向量数据库，用于后续检索相关设定

---

### 阶段二：逐章生成循环（对每一章从 start_chapter 到 end_chapter）

```
┌─────────────────────────────────────────────────────────┐
│  输入：setting_bible, 全书大纲, 上一章结尾                  │
└────────────────────────────┬──────────────────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Writer 生成 │  →  初稿
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Quality 检查 │  →  硬伤检查（格式/字数/标题）
                     └──────┬───────┘
                            │ 不通过
                            ▼
                     ┌──────────────┐
                     │ Polish 优化  │  →  修复硬伤
                     └──────┬───────┘
                            │ 通过
                            ▼
                     ┌──────────────┐
                     │ Critic 评审  │  →  深度评审 + 打分
                     └──────┬───────┘
                            │ 不通过
                            ▼
                     ┌──────────────┐
                     │ Editor 修改  │  →  根据意见修改
                     └──────┬───────┘
                            │ 通过
                            ▼
                     ┌──────────────┐
                     │ Quality 评分 │  →  多维度量化评分 → 保存JSON
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Compliance   │  →  合规检查
                     └──────┬───────┘
                            │ 不通过
                            ▼
                     ┌──────────────┐
                     │ Editor 修正  │  →  根据合规意见修改
                     └──────┬───────┘
                            │ 通过
                            ▼
                     ┌──────────────┐
                     │ Guardian     │  →  提取章节状态 → 更新世界观中枢
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ 保存章节     │  →  chapter_{num}.txt
                     └──────┬───────┘
                            │
                            ▼
                     进入下一章...
```

---

### 阶段三：完成后导出

全部章节生成完成后，用户可导出为多种格式：
- `txt` - 纯文本
- `docx` - Word 文档
- `html` - 网页/电子书
- `epub` - 电子书

---

## 数据持久化

### 项目目录结构

```
data/projects/{user_id}/{project_id}/
├── info.json              # 项目基础信息（名称、描述、创建时间等）
├── user_requirements.yaml # 用户原始需求配置
├── novel_plan.md          # Planner 生成的全书大纲
├── setting_bible.md       # Guardian 生成的设定圣经
├── worldview_state.json   # 世界观中枢状态（时间线/角色/伏笔追踪）
├── chapter_1.txt          # 第1章正文
├── chapter_2.txt          # 第2章正文
├── ...
└── scores/
    ├── chapter_1.json     # 第1章质量评分
    ├── chapter_2.json
    └── ...
```

### 世界观中枢 (`worldview_state.json`)

用于解决**设定冲突、时间线错乱、伏笔烂尾**问题，每章生成后自动更新：

```json
{
  "base_info": {
    "novel_name": "xxx",
    "genre": ["重生", "都市"],
    "total_chapters": 0,
    "core_theme": "",
    "core_conflict": ""
  },
  "timeline": {
    "base_time": "2015年6月",
    "current_time": "2015年7月",
    "event_anchors": [
      {"time": "xxx", "event": "xxx", "chapter": 1}
    ]
  },
  "characters": {
    "主角姓名": {
      "name": "xxx",
      "description": "xxx"
    }
  },
  "world_rules": {
    "forbidden_content": [],
    "unchangeable_rules": []
  },
  "foreshadows": [
    {
      "id": "f_1_0",
      "content": "伏笔内容",
      "chapter": 1,
      "status": "unfinished",
      "related_characters": []
    }
  ]
}
```

---

## 占位符替换机制

为了保持 prompt 文件结构清晰、确定性高，同时不让 LLM 看到 `{{variable}}` 占位符文字，系统采用**代码层面替换**：

1. `prompts/*.md` 中保留 `{{variable_name}}` 写法，结构清晰
2. `load_prompt(..., context: dict)` 加载后自动替换：
   - 遍历 `context` 字典，将 `{{key}}` 替换为 `value`
   - 替换后的完整 system prompt 再发给 LLM
3. LLM 看不到占位符语法，只会看到替换后的实际内容

**示例**：

`planner.md` 中：
```markdown
- **设定圣经**：`{{world_bible}}`
```

代码加载时：
```python
context = {"world_bible": "主角张三，获得重生金手指..."}
# 替换后变为：
- **设定圣经**：`主角张三，获得重生金手指...`
```

这样既保持了 prompt 模板的清晰结构，又不会让 LLM 看到占位符语法，消除幻觉。

---

## 并行优化

为了加速生成，系统对**独立可并行**的检查任务使用线程池并行：

```python
with ThreadPoolExecutor(max_workers=3) as executor:
    future_setting = executor.submit(guardian.check_setting_consistency, ...)
    future_quality = executor.submit(quality.check_quality, ...)
    future_compliance = executor.submit(compliance.check_compliance, ...)
```

三个检查（设定一致性/质量/合规）互不依赖，可以同时进行，节省约 1/3 时间。

---

## 错误处理与重试机制

1. **API 调用失败**：`call_volc_api` 自带最多 3 次重试，每次失败等待 2 秒后重试
2. **章节号错误**：`quality_agent` 自动检测并修正标题中的章节号
3. **JSON 解析失败**：Guardian/Fix 会尝试清理 Markdown 包装，重新解析
4. **质量不达标**：总分不及格自动触发 Polish/Editor 修复，最多重试 `max_fix_retries` 次（默认 4 次）

---

## 总结

| 组件 | 核心职责 | 输入类型 | 输出类型 |
|-------|----------|----------|----------|
| Planner | 顶层整体策划 | 用户需求 | 分章大纲 |
| Guardian | 设定圣经+一致性校验 | 大纲 / 章节 | 设定圣经 / 校验报告 |
| **Worldview Manager** | 世界观状态追踪 | 章节正文 | 更新后的JSON状态 |
| Writer | 生成正文初稿 | 设定+大纲+上章结尾 | 章节正文 |
| Quality | 多维度量化评分 | 章节+设定 | JSON评分结果 |
| Polish | 精准优化文字，不动剧情 | 原文+问题列表 | 优化后正文 |
| Critic | 深度评审挑错 | 章节+设定 | JSON打分+问题清单 |
| Editor | 根据批评深度修改正文 | 原文+批评意见+设定 | 修改后正文 |
| Compliance | 合规检查 | 章节 | 通过/不通过 |
| Fix | 格式错误修复 | 原文+问题 | 修复后正文 |

流水线清晰，职责单一，易于维护和扩展。
