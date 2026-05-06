# StoryForge AI v2.0 升级说明：Hermes 类自我进化系统

> **一句话总结**：以前的 StoryForge 写完就忘，现在的 StoryForge 越写越聪明。

---

## 一、升级了什么？

### 以前（v1.x）

```
用户需求 → Planner → Writer → Guardian → Critic → Revise →  发布
                                                                   
写完就完了，经验不沉淀。下次写下一章，跟第一次写一样——                                                                    
同样的错误反复犯，用户反馈了的偏好也不会记住。
```

### 现在（v2.0）

```
用户需求 → Planner → Writer → Guardian → Critic → Revise →  发布
                                                               ↓
                                                     【学习闭环自动触发】
                                                               ↓
                                           TraceAggregator → FeedbackCollector 
                                           → ExperienceExtractor → SkillDistiller 
                                           → SkillRegistry [+ ChromaDB]
                                                               ↓
                                           （下次写作时自动检索注入，越写越聪明）
```

**核心变化**：系统现在会在每次章节生成后，**自动分析失败案例和用户反馈**，提炼成可复用的"写作经验"，注册为技能文件。下次 Writer/Planner 生成时，这些技能会自动注入提示词。

---

## 二、新增模块详解

### 1.  TraceAggregator —— 轨迹聚合器

**一句话**：不建新表，把已有的数据串起来。

- 零新增数据库表，复用现有 `Artifact`、`FeedbackItem`、`WorkflowStepRun`
- 提供 `get_chapter_trace()` 一次调用拿到单章完整轨迹（草稿、评审报告、修复合并记录、用户反馈）
- 提供 `get_failed_chapters()` 自动找出评分低于阈值的"失败章节"
- 提供 `get_user_modified_chapters()` 找出用户手动修改过的章节

### 2.  FeedbackCollector —— 统一信号管道

**一句话**：把 Guardian、Critic、用户三种渠道的反馈统一成一个格式。

| 信号来源 | 原始格式 | 统一后 |
|---------|---------|--------|
| Critic 评审 | 中文类型名（"剧情问题""人物"） | 标准英文信号名 |
| Guardian 合规检查 | warnings/violations 混合 | FeedbackSignal |
| 用户修改反馈 | user_note / user_rejection | FeedbackSignal |

- 自动类型映射：`"剧情问题" → "plot_issue"`、`"人物" → "character_inconsistency"` 等
- `is_actionable` 属性自动过滤低严重度信号
- 证据提取：优先从 `evidence_span` 取原文，无则回退到 `location` 字段

### 3.  ExperienceExtractor —— 经验提取器

**一句话**：让 AI 分析失败原因，提炼成结构化经验。

- 使用现有 LLM 管线（`call_volc_api`），低温（0.3）保证一致性
- 输入：评审报告 + Guardian 检查结果 + 用户反馈 + 章节大纲
- 输出：`WritingExperience` 对象列表（问题类型、描述、根因、建议、证据）
- 自动跳过信号不足的章节（无 medium+ 信号不提取）

### 4.  SkillDistiller —— 技能蒸馏器

**一句话**：把经验变成 SKILL.md 文件，注册到技能系统。

**7 种问题类型 → 技能模板映射**：

| 问题类型 | 生成技能类型 | 应用于 |
|---------|------------|--------|
| 人物不一致 → | character_style | Writer, Revise |
| 文风问题 → | writing_style | Writer, Revise |
| 节奏问题 → | plot_helper | Writer, Planner |
| 逻辑漏洞 → | plot_helper | Planner, Writer |
| 世界观冲突 → | plot_helper | Writer, Planner, Critic |
| 冗余累赘 → | writing_style | Writer, Revise, Critic |
| 钩子太弱 → | plot_helper | Writer, Planner |
| 用户偏好 → | user_preference | Writer, Planner, Critic |

**置信度评分**（决定技能是否自动启用）：
- 60% 来自 LLM 自评置信度
- 40% 来自启发式规则（证据长度、涉及角色、根因深度、跨章节数）
- `< 0.5`：不启用，需人工审核
- `0.5 ~ 0.8`：低强度试用（strength=0.3）
- `≥ 0.8`：正式推荐（strength=0.7）

### 5.  SkillRegistry 扩展 —— 动态注册

**一句话**：技能不用手动创建，系统自动写 SKILL.md 到磁盘。

- `register_skill()`：写入 `backend/skills/auto_generated/{id}/SKILL.md`
- `list_auto_generated_skills()`：列出所有自动生成的技能
- `get_skills_by_character()`：按角色检索技能
- SKILL.md 新增元数据：`confidence`、`source_chapters`、`target`

### 6.  ChromaDB 技能检索 —— 语义匹配

**一句话**：根据当前写的角色和剧情阶段，自动找到最相关的技能。

- 新增 `skills_{namespace}` 向量集合
- `add_skill_to_db()`：技能注册时自动索引
- `search_relevant_skills(query, character_name)`：语义检索
- `remove_skill_from_db()`：技能删除时同步清理

检索策略：
1. 先加载项目启用的静态技能（现有的）
2. 额外用 ChromaDB 根据 `ChapterContext`（角色+剧情阶段+章节类型）做语义匹配
3. 排序：手动 > 自动生成，匹配当前角色 > 不匹配

### 7.  NovelState v2 —— 角色记忆系统

**一句话**：以前只记角色状态，现在开始记角色"怎么说话、怎么做事"。

**旧版**：
```json
"characters": { "林舟": "已受伤，在第5章左臂中箭" }
```

**新版**：
```json
"characters": {
  "林舟": {
    "state": "已受伤，在第5章左臂中箭",
    "speech_pattern": {
      "traits": ["短句", "少解释", "常用反问"],
      "observations": ["林舟说话简短，常用反问表达不信任"]
    },
    "behavior_traits": {
      "patterns": ["行动先于言语", "对弱者有保护欲"],
      "observations": ["林舟看到弱者受伤立即上前"]
    },
    "last_appearance": 5,
    "appearance_count": 3
  }
}
```

新增方法：
- `record_character_observation()` — 记录一次观察
- `build_character_profile()` — 构建角色画像（给 ExperienceExtractor 用）
- `has_sufficient_observations()` — 判断观察是否足够生成技能

**向后兼容**：旧版字符串格式自动升级为新版字典格式，零迁移成本。

### 8.  配置开关

```python
# backend/core/config.py 新增
enable_experience_extraction: bool = True      # 开经验提取
enable_auto_skill_generation: bool = False     # 关自动技能注册（默认需人工审核）
skill_confidence_threshold: float = 0.5        # 置信度门槛
experience_extractor_agent: str = "planner"     # 经验提取用哪个 agent 角色
```

---

## 三、学习闭环完整流程

```
第 N 章生成完毕
    │
    ├─→ 保存章节、更新 NovelState（现有流程）
    │
    └─→ progress_callback 检测到"章生成完成"
          │
          ├─→ 增量同步到前端（已有）
          │
          └─→ extract_experience_task.delay()  ← 异步，不阻塞主线
                │
                ├─ 1. TraceAggregator.get_chapter_trace()
                │     聚合本章所有 Artifact + FeedbackItem
                │
                ├─ 2. FeedbackCollector.collect_all_for_chapter()
                │     统一所有信号 → FeedbackSignal[]
                │
                ├─ 3. 过滤：只有 signal 严重度 >= medium 才继续
                │
                ├─ 4. ExperienceExtractor.extract()
                │     调用 LLM → WritingExperience[]
                │
                ├─ 5. SkillDistiller.distill()
                │     WritingExperience → DistilledSkill
                │
                └─ 6. SkillRegistry.register_skill() + add_skill_to_db()
                       写入 SKILL.md + 索引到 ChromaDB
                         │
                         ▼
               第 N+1 章生成时 →
               SkillAssembler 检索到新技能 →
               {{skill_layer}} 注入到 Writer/Planner prompt
```

整个流程**异步执行**，不影响主线写作速度。用户无感知，但系统在持续学习。

---

## 四、测试覆盖

新增 6 个测试文件，148 个测试用例，覆盖所有新增模块：

| 测试文件 | 测试数 | 覆盖重点 |
|---------|-------|---------|
| `test_feedback_collector.py` | 8 | 信号归一化、类型映射、证据提取 |
| `test_trace_aggregator.py` | 41 | 轨迹聚合、阈值过滤、去重、范围过滤 |
| `test_experience_extractor.py` | 24 | LLM 调用、JSON 解析、格式化输出 |
| `test_skill_distiller.py` | 33 | 7 种模板、置信度计算、强度映射 |
| `test_novel_state_extensions.py` | 21 | 角色记忆、旧版兼容、观察累积 |
| `test_skill_registry_extended.py` | 14 | 动态注册、按角色检索、自动生成标记 |

---

## 五、如何启用

```bash
# 1. 确保配置已启用（默认已开启）
# backend/core/config.py 中：
#   enable_experience_extraction = True

# 2. 运行测试验证
conda activate storyforge
python -m unittest discover tests -v

# 3. 启动服务，正常写作即可
# 学习闭环在每次章节生成后自动触发
# 自动生成的技能位于 backend/skills/auto_generated/ 目录

# 4. （可选）查看已生成的技能
python -c "
from backend.core.skill_runtime.skill_registry import SkillRegistry
registry = SkillRegistry()
for skill in registry.list_auto_generated_skills():
    print(f'{skill.id} (confidence={skill.confidence})')
"
```
