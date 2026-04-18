# 系统层防护规则文档 (System-Level Guardrails Specification)

## 1. 概述

### 1.1 目的
本文档定义了 StoryForge AI 精简架构中 **不依赖 LLM** 的系统层防护规则。这些规则由代码实现，在 Writer 输出后、Critic 评审前执行，用于 **快速拦截基础格式与合规问题**，降低 LLM 调用成本，提升系统稳定性。

### 1.2 设计原则

| 原则 | 说明 |
| :--- | :--- |
| **零 Token 消耗** | 所有检查均在本地完成，不调用 LLM。 |
| **毫秒级响应** | 规则应能在 100ms 内完成扫描。 |
| **可配置化** | 阈值参数应从配置文件读取，便于调优。 |
| **非阻断优先** | 仅严重问题阻断流程；轻微问题标记警告，继续流程。 |

### 1.3 执行位置

```
Writer 输出章节正文
        ↓
┌─────────────────────────────┐
│   系统层防护（本文档定义）    │
└─────────────────────────────┘
        ↓
   ┌────┴────┐
   ↓         ↓
严重问题    轻微问题
   ↓         ↓
阻断/修正   标记警告
   ↓         ↓
   └────┬────┘
        ↓
   Critic 评审
```

---

## 2. 检查项定义

### 2.1 检查项总览

| ID | 检查项 | 严重级别 | 默认处理 |
| :--- | :--- | :--- | :--- |
| G-01 | 章节标题格式 | **阻断** | 自动补全或打回 |
| G-02 | 章节号连续性 | **阻断** | 自动修正 |
| G-03 | 敏感词过滤 | **阻断** | 自动替换为 `*` |
| G-04 | 字数偏离 | 警告 | 记录偏差，继续流程 |
| G-05 | 段落长度 | 警告 | 记录超标段落，继续流程 |
| G-06 | 对话分行 | 自动修正 | 自动格式化 |
| G-07 | 主角出场检查 | 警告 | 标记提醒，继续流程 |
| G-08 | 结尾钩子检测 | 警告 | 标记提醒，继续流程 |
| G-09 | 套话黑名单 | 自动修正 | 自动替换或标记 |
| G-10 | 时代错位词检测 | 警告 | 若设定含时代校准，标记提醒 |

---

## 3. 规则详细定义

### 3.1 G-01：章节标题格式

**检查内容**：正文第一行是否包含合法的章节标题。

**规则定义**：
```python
import re

CHAPTER_TITLE_PATTERN = r'^第[一二三四五六七八九十百千万\d]+章\s+.{1,30}$'

def check_chapter_title(content: str, expected_chapter_num: int) -> tuple[bool, str, str]:
    """
    检查章节标题格式。
    
    返回：
        (是否通过, 修正后内容, 错误信息)
    """
    lines = content.strip().split('\n')
    first_line = lines[0].strip() if lines else ''
    
    # 规则1：第一行必须匹配标题格式
    if not re.match(CHAPTER_TITLE_PATTERN, first_line):
        # 自动补全
        corrected_title = f"第{expected_chapter_num}章"
        corrected_content = f"{corrected_title}\n\n{content}"
        return False, corrected_content, f"标题格式错误，已自动补全为 '{corrected_title}'"
    
    # 规则2：提取章节号，校验是否与期望一致
    match = re.search(r'第(\d+)章', first_line)
    if match:
        actual_num = int(match.group(1))
        if actual_num != expected_chapter_num:
            # 自动修正章节号
            corrected_title = re.sub(r'第\d+章', f'第{expected_chapter_num}章', first_line)
            lines[0] = corrected_title
            corrected_content = '\n'.join(lines)
            return False, corrected_content, f"章节号错误（期望{expected_chapter_num}，实际{actual_num}），已自动修正"
    
    return True, content, ""
```

**处理逻辑**：
| 情况 | 处理 | 是否阻断 |
| :--- | :--- | :--- |
| 第一行无标题 | 自动在文首插入 `第X章` | 否（已修正） |
| 标题格式不匹配 | 自动补全为标准格式 | 否（已修正） |
| 章节号与期望不符 | 自动修正章节号 | 否（已修正） |
| 标题正确 | 放行 | — |

---

### 3.2 G-02：章节号连续性

**检查内容**：当前章节号是否与上一章连续。

**规则定义**：
```python
def check_chapter_continuity(current_chapter: int, previous_chapter: int) -> tuple[bool, str]:
    """
    检查章节号连续性。
    """
    if current_chapter == previous_chapter + 1:
        return True, ""
    else:
        return False, f"章节号跳跃（上一章{previous_chapter}，本章{current_chapter}）"
```

**处理逻辑**：
| 情况 | 处理 |
| :--- | :--- |
| `current = previous + 1` | 通过 |
| 跳跃 | 记录警告日志，但仍使用当前章节号（可能是用户手动指定） |

---

### 3.3 G-03：敏感词过滤

**检查内容**：正文是否包含政治、色情、暴力等敏感词。

**规则定义**：
```python
# 敏感词库应从外部配置文件加载，以下为示例结构
SENSITIVE_WORDS = {
    "political": ["敏感词示例1", "敏感词示例2"],
    "porn": ["色情词1", "色情词2"],
    "violence": ["暴力词1", "暴力词2"]
}

def filter_sensitive_words(content: str) -> tuple[bool, str, list[str]]:
    """
    过滤敏感词。
    
    返回：
        (是否有敏感词被替换, 过滤后内容, 被替换的词列表)
    """
    filtered = content
    replaced = []
    
    for category, words in SENSITIVE_WORDS.items():
        for word in words:
            if word in filtered:
                filtered = filtered.replace(word, '*' * len(word))
                replaced.append(word)
    
    return len(replaced) > 0, filtered, replaced
```

**处理逻辑**：
| 情况 | 处理 |
| :--- | :--- |
| 命中敏感词 | 自动替换为等长 `*`，记录被替换的词 |
| 命中高严重级别词 | 阻断流程，通知用户修改 |

**配置建议**：敏感词库应支持热更新，建议使用 Trie 树结构以提升匹配效率。

---

### 3.4 G-04：字数偏离

**检查内容**：章节字数是否在目标字数的允许范围内。

**规则定义**：
```python
def check_word_count(content: str, target_count: int, tolerance: float = 0.30) -> tuple[bool, int, float, str]:
    """
    检查字数偏离。
    
    参数：
        tolerance: 允许的偏离比例，默认 0.30（±30%）
    
    返回：
        (是否在范围内, 实际字数, 偏离比例, 警告信息)
    """
    # 中文环境下，字数约等于字符数（去除空格和换行符的影响）
    text = content.replace('\n', '').replace('\r', '').replace(' ', '')
    actual = len(text)
    
    deviation = (actual - target_count) / target_count
    
    if abs(deviation) <= tolerance:
        return True, actual, deviation, ""
    elif deviation > 0:
        return False, actual, deviation, f"字数超标 {deviation:.1%}（目标{target_count}，实际{actual}）"
    else:
        return False, actual, deviation, f"字数不足 {abs(deviation):.1%}（目标{target_count}，实际{actual}）"
```

**处理逻辑**：
| 情况 | 处理 |
| :--- | :--- |
| ±30% 以内 | 通过 |
| 超出 ±30% | 记录警告，**继续流程**（不阻断，由 Critic 或用户决定是否调整） |

---

### 3.5 G-05：段落长度

**检查内容**：是否存在超过 3 句话的段落。

**规则定义**：
```python
import re

SENTENCE_END_PATTERN = r'[。！？!?]'

def check_paragraph_length(content: str, max_sentences: int = 3) -> tuple[bool, list[int]]:
    """
    检查段落长度。
    
    返回：
        (是否全部通过, 超标段落的行号列表)
    """
    lines = content.split('\n')
    long_paragraphs = []
    
    for i, para in enumerate(lines, 1):
        para = para.strip()
        if not para:
            continue
        # 跳过对话行（通常以人名+冒号开头）
        if re.match(r'^[^\s：:]{1,10}[：:]', para):
            continue
        
        sentences = re.split(SENTENCE_END_PATTERN, para)
        sentence_count = len([s for s in sentences if s.strip()])
        
        if sentence_count > max_sentences:
            long_paragraphs.append(i)
    
    return len(long_paragraphs) == 0, long_paragraphs
```

**处理逻辑**：
| 情况 | 处理 |
| :--- | :--- |
| 所有段落 ≤3 句 | 通过 |
| 存在超标段落 | 记录超标行号，**继续流程**，由前端提示用户 |

---

### 3.6 G-06：对话分行

**检查内容**：对话是否以标准格式独立成段。

**规则定义**：
```python
DIALOGUE_PATTERN = re.compile(r'^[^\s：:]{1,10}[：:].+')

def check_dialogue_format(content: str) -> tuple[bool, str]:
    """
    检查并自动修正对话格式。
    
    返回：
        (是否有修正, 修正后内容)
    """
    lines = content.split('\n')
    corrected_lines = []
    modified = False
    
    for line in lines:
        # 如果一行中包含多段对话，尝试拆分
        parts = re.split(r'(?<=[。！？])\s*(?=[^\s：:]{1,10}[：:])', line)
        if len(parts) > 1:
            corrected_lines.extend([p.strip() for p in parts if p.strip()])
            modified = True
        else:
            corrected_lines.append(line)
    
    corrected_content = '\n'.join(corrected_lines)
    return modified, corrected_content
```

**处理逻辑**：
| 情况 | 处理 |
| :--- | :--- |
| 对话已独立成段 | 通过 |
| 多段对话挤在一行 | 自动拆分为独立段落 |

---

### 3.7 G-07：主角出场检查

**检查内容**：主角姓名是否在本章至少出现一次。

**规则定义**：
```python
def check_protagonist_appearance(content: str, protagonist_name: str) -> tuple[bool, str]:
    """
    检查主角是否出场。
    """
    if not protagonist_name:
        return True, ""
    
    if protagonist_name in content:
        return True, ""
    else:
        return False, f"警告：主角「{protagonist_name}」在本章未出场"
```

**处理逻辑**：
| 情况 | 处理 |
| :--- | :--- |
| 主角姓名出现 | 通过 |
| 未出现 | 记录警告，**继续流程**（某些章节可能确实不出现主角） |

---

### 3.8 G-08：结尾钩子检测

**检查内容**：最后 3 段是否包含悬念元素（疑问、反转、动作中断、危机暗示）。

**规则定义**：
```python
HOOK_INDICATORS = [
    r'\?',                    # 疑问句
    r'突然|忽然|猛地',         # 突发动作
    r'却|但是|然而|竟然',      # 反转
    r'背后|身后|门外|窗外',    # 空间悬念
    r'……|——$',               # 中断/留白
]

def check_ending_hook(content: str) -> tuple[bool, str]:
    """
    检测结尾是否包含钩子元素。
    """
    lines = [l.strip() for l in content.split('\n') if l.strip()]
    if len(lines) < 3:
        last_part = ' '.join(lines)
    else:
        last_part = ' '.join(lines[-3:])
    
    import re
    for pattern in HOOK_INDICATORS:
        if re.search(pattern, last_part):
            return True, ""
    
    return False, "建议：结尾缺少明确的悬念钩子"
```

**处理逻辑**：
| 情况 | 处理 |
| :--- | :--- |
| 检测到钩子元素 | 通过 |
| 未检测到 | 记录建议，**继续流程** |

---

### 3.9 G-09：套话黑名单

**检查内容**：是否包含 AI 常用套话。

**规则定义**：
```python
CLICHE_BLACKLIST = [
    "只见", "话落", "微微一笑", "心中一动", "瞳孔一缩",
    "倒吸一口凉气", "随着", "就在这时", "一股...涌上心头",
]

def check_cliches(content: str) -> tuple[bool, str, list[str]]:
    """
    检测并标记套话。
    
    返回：
        (是否有套话, 标记后内容, 发现的套话列表)
    """
    found = []
    for cliche in CLICHE_BLACKLIST:
        if cliche in content:
            found.append(cliche)
    
    # 不自动替换，仅标记，由前端高亮提示
    return len(found) > 0, content, found
```

**处理逻辑**：
| 情况 | 处理 |
| :--- | :--- |
| 无套话 | 通过 |
| 有套话 | 记录发现的套话列表，**继续流程**，前端可高亮显示 |

---

### 3.10 G-10：时代错位词检测

**检查内容**：若设定圣经包含 `[时代校准]`，则检测是否出现超前词汇。

**规则定义**：
```python
# 时代词库（示例，实际应从配置加载）
ERA_VOCAB = {
    "1990s": {
        "forbidden": ["智能手机", "WiFi", "社交媒体", "网购", "二维码"],
        "caution": ["互联网", "手机", "电脑"]
    },
    "ancient": {
        "forbidden": ["电话", "电灯", "汽车", "分钟", "小时"],
        "caution": []
    }
}

def check_era_consistency(content: str, era_key: str) -> tuple[bool, list[str]]:
    """
    检查时代错位词。
    """
    if era_key not in ERA_VOCAB:
        return True, []
    
    violations = []
    for word in ERA_VOCAB[era_key]["forbidden"]:
        if word in content:
            violations.append(f"禁止词：{word}")
    
    return len(violations) == 0, violations
```

**处理逻辑**：
| 情况 | 处理 |
| :--- | :--- |
| 无错位词 | 通过 |
| 有禁止词 | 记录违规词列表，**继续流程**（由 Critic 或用户决定修改） |

---

## 4. 集成接口定义

### 4.1 主检查函数

```python
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class GuardrailResult:
    """系统层防护检查结果"""
    passed: bool                    # 是否通过所有阻断级检查
    corrected_content: str          # 修正后的内容
    warnings: List[str]             # 警告信息列表
    suggestions: List[str]          # 建议信息列表
    metrics: dict                   # 统计指标（字数、段落数等）
    violations: dict                # 违规详情（按检查项ID分组）

def run_system_guardrails(
    content: str,
    context: dict
) -> GuardrailResult:
    """
    执行全部系统层防护检查。
    
    参数：
        content: 章节正文
        context: 上下文信息，包含：
            - expected_chapter_num: int
            - previous_chapter_num: int
            - target_word_count: int
            - protagonist_name: str
            - era_key: Optional[str]
    
    返回：
        GuardrailResult 对象
    """
    result = GuardrailResult(
        passed=True,
        corrected_content=content,
        warnings=[],
        suggestions=[],
        metrics={},
        violations={}
    )
    
    current = content
    
    # G-01: 标题格式
    passed, current, msg = check_chapter_title(current, context['expected_chapter_num'])
    if not passed:
        result.corrected_content = current
        result.warnings.append(msg)
    
    # G-03: 敏感词（阻断级）
    has_sensitive, current, replaced = filter_sensitive_words(current)
    if has_sensitive:
        result.corrected_content = current
        result.warnings.append(f"已替换敏感词: {replaced}")
        result.violations['G-03'] = replaced
    
    # G-06: 对话分行
    modified, current = check_dialogue_format(current)
    if modified:
        result.corrected_content = current
        result.warnings.append("已自动修正对话格式")
    
    # G-04: 字数
    in_range, actual, dev, msg = check_word_count(current, context['target_word_count'])
    result.metrics['word_count'] = actual
    result.metrics['word_count_deviation'] = dev
    if not in_range:
        result.warnings.append(msg)
    
    # G-05: 段落长度
    passed_para, long_lines = check_paragraph_length(current)
    if not passed_para:
        result.suggestions.append(f"段落过长，建议拆分第 {long_lines} 行")
        result.violations['G-05'] = long_lines
    
    # G-07: 主角出场
    passed_prot, msg = check_protagonist_appearance(current, context.get('protagonist_name', ''))
    if not passed_prot:
        result.suggestions.append(msg)
    
    # G-08: 结尾钩子
    passed_hook, msg = check_ending_hook(current)
    if not passed_hook:
        result.suggestions.append(msg)
    
    # G-09: 套话
    has_cliche, _, cliches = check_cliches(current)
    if has_cliche:
        result.suggestions.append(f"检测到AI套话: {cliches}")
        result.violations['G-09'] = cliches
    
    # G-10: 时代错位
    if context.get('era_key'):
        passed_era, violations = check_era_consistency(current, context['era_key'])
        if not passed_era:
            result.warnings.append(f"时代错位词: {violations}")
            result.violations['G-10'] = violations
    
    return result
```

### 4.2 调用示例

```python
context = {
    'expected_chapter_num': 3,
    'previous_chapter_num': 2,
    'target_word_count': 2000,
    'protagonist_name': '张毅',
    'era_key': '1990s'
}

result = run_system_guardrails(chapter_content, context)

if result.passed:
    final_content = result.corrected_content
else:
    # 理论上不会走到这里，因为阻断项都已自动修正
    pass

# 将 warnings 和 suggestions 传递给前端展示
# 将 metrics 存入数据库
```

---

## 5. 配置文件结构建议

```yaml
# guardrails_config.yaml
guardrails:
  word_count:
    tolerance: 0.30              # 字数允许偏差比例
    
  paragraph:
    max_sentences: 3              # 段落最大句子数
    exclude_dialogue: true        # 对话行不计入段落检查
    
  sensitive_words:
    enabled: true
    auto_replace: true
    block_on_high_severity: true
    
  cliche_blacklist:
    - "只见"
    - "话落"
    - "微微一笑"
    - "心中一动"
    - "瞳孔一缩"
    - "倒吸一口凉气"
    
  hook_indicators:
    - "?"
    - "突然"
    - "忽然"
    - "猛地"
    - "却"
    - "但是"
    - "然而"
    - "竟然"
    - "背后"
    - "身后"
    - "门外"
    - "窗外"
    - "……"
    
  era_vocab:
    1990s:
      forbidden:
        - "智能手机"
        - "WiFi"
        - "社交媒体"
        - "网购"
        - "二维码"
      caution:
        - "互联网"
        - "手机"
    ancient:
      forbidden:
        - "电话"
        - "电灯"
        - "汽车"
```

---

## 6. 执行顺序与优先级

| 优先级 | 检查项 | 原因 |
| :--- | :--- | :--- |
| P0 | G-01 标题格式 | 系统解析依赖标题 |
| P0 | G-03 敏感词 | 合规红线 |
| P1 | G-06 对话分行 | 影响排版正确性 |
| P2 | G-04 字数 | 参考指标 |
| P2 | G-05 段落长度 | 阅读体验 |
| P3 | G-07 主角出场 | 建议项 |
| P3 | G-08 结尾钩子 | 建议项 |
| P3 | G-09 套话 | 建议项 |
| P3 | G-10 时代错位 | 建议项 |

---

## 7. 扩展性考虑

1. **插件化架构**：每个检查项设计为独立函数，便于增删。
2. **规则热更新**：敏感词库、套话黑名单等从外部文件或数据库加载，支持不重启更新。
3. **A/B 测试支持**：可通过配置开关控制各项检查的启用/禁用。
4. **监控埋点**：每次检查结果应上报监控系统，用于分析常见问题分布。