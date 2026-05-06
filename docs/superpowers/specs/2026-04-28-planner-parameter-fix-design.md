# Planner Agent 参数传递修复设计文档

**日期：** 2026-04-28
**状态：** 待实现
**优先级：**  严重（影响核心功能）

## 1. 问题描述

### 1.1 问题背景

在对整个工作流进行系统性质量审计时，发现 Planner Agent 的参数传递存在严重的不匹配问题。多个关键的 prompt 占位符没有被正确替换，导致 Planner Agent 的核心功能受到严重影响。

### 1.2 问题根源

`backend/agents/planner_agent.py` 中的 `generate_plan()` 函数构建的 `context` 字典与 `prompts/planner.md` 中实际使用的占位符名称不一致，且缺少多个关键参数。

### 1.3 具体问题清单

| Prompt 占位符 | 实际传递的 Key | 状态 | 影响 |
|--------------|----------------|------|------|
| `{{content_type}}` |  未传递 |  严重 | 无法根据 novel/short_story/script 模式切换输出结构 |
| `{{user_requirements}}` |  未传递 |  严重 | 用户核心创作需求完全缺失 |
| `{{platform}}` | `platform` |  正确 | - |
| `{{target_words}}` | `total_words` |  严重 | 名称不匹配，总字数约束失效 |
| `{{target_duration}}` |  未传递 |  中等 | 剧本模式的时长参数缺失（可选） |
| `{{core_hook}}` | `core_hook` |  正确 | - |
| `{{chapter_word_count}}` |  未传递 |  严重 | 每章字数规划完全失效 |
| `world_bible` | `world_bible` |  多余 | Prompt 不使用 |
| `genre` | `genre` |  多余 | Prompt 不使用 |

## 2. 修复方案

### 2.1 修改文件

**文件：** `backend/agents/planner_agent.py`

**原代码（第20-30行）：**
```python
context = {}
if world_bible:
    context["world_bible"] = world_bible
if genre:
    context["genre"] = genre
if target_platform:
    context["platform"] = target_platform
if total_words:
    context["total_words"] = total_words
if core_hook:
    context["core_hook"] = core_hook
```

**修复后的代码：**
```python
context = {}
if target_platform:
    context["platform"] = target_platform
if total_words:
    context["target_words"] = str(total_words)
if core_hook:
    context["core_hook"] = core_hook
context["content_type"] = content_type
context["user_requirements"] = core_requirement
context["chapter_word_count"] = str(chapter_word_count)
```

### 2.2 变更说明

1.  **修复名称不匹配**：`total_words` → `target_words`
2.  **新增必选参数**：`content_type`（创作模式）
3.  **新增必选参数**：`user_requirements`（用户核心需求，使用 `core_requirement`）
4.  **新增必选参数**：`chapter_word_count`（每章字数）
5.  **移除多余参数**：`world_bible`、`genre`（prompt 中不使用）

## 3. 验证方案

### 3.1 单元测试

创建测试文件 `tests/test_planner_parameters.py`，验证：
1. `generate_plan()` 正确构建 `context` 字典
2. 所有占位符名称与 prompt 文件一致
3. 占位符替换功能正常工作

### 3.2 集成测试

运行完整工作流测试，验证：
1. Planner 生成的大纲包含正确的章节数量（与总字数匹配）
2. 输出结构符合 `content_type`（长篇/短篇/剧本）
3. 平台特定规则生效（如番茄平台的节奏要求）

## 4. 风险评估

| 风险项 | 影响 | 概率 | 缓解措施 |
|--------|------|------|----------|
| 参数名称变更导致上游调用失败 | 低 | 低 | context 是内部字典，不影响函数签名 |
| 移除多余参数导致意外行为 | 低 | 极低 | prompt 中不使用这些参数，移除无影响 |
| 类型转换（int → str）导致问题 | 低 | 低 | load_prompt 内部使用 str() 转换 |

**总体风险等级：** 低风险，高收益

## 5. 验收标准

- [ ] 所有 Planner prompt 占位符都被正确替换
- [ ] Planner 输出的结构与 `content_type` 匹配
- [ ] 章节规划字数与 `chapter_word_count` 一致
- [ ] 总章节数与 `target_words` / `chapter_word_count` 匹配
- [ ] 所有单元测试通过
- [ ] 完整生成流程测试通过
