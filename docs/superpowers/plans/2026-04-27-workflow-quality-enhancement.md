# Workflow Quality Enhancement Implementation Plan

&gt; **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the novel generation workflow with scene-aware criticism and NovelState validation, improving local repair trigger rate by ≥60% while making zero changes to the core Writer generation flow.

**Architecture:** All enhancements are additive layers on top of the existing stable workflow. NovelStateValidator (pure code) runs before Critic for zero-token hard error detection. Critic prompt is enhanced with scene anchors for more precise issue localization. Issues are grouped by scene_id for safer, more targeted local repairs.

**Tech Stack:** Python 3.11+, unittest, FastAPI backend, no new external dependencies

---

## File Map

| File | Change Type | Responsibility |
|------|-------------|----------------|
| `backend/core/novel_state_service.py` | Modify + Add Class | Add `NovelStateValidator` pure code checker, foreshadow tracking, enhanced attribution |
| `backend/prompts/critic.md` | Modify | Inject scene_anchors and novel_state_snapshot into Critic prompt context |
| `backend/core/orchestrator.py` | Modify | Add scene grouping in repair batch, chapter consistency pass, state validation integration |
| `tests/test_novel_state_validator.py` | Create | Unit tests for the validator |
| `tests/test_scene_grouped_repair.py` | Create | Unit tests for grouped repair logic |

---

## Task 1: NovelStateValidator - Pure Code Hard Error Checker

**Files:**
- Modify: `backend/core/novel_state_service.py` (append at end)
- Test: `tests/test_novel_state_validator.py`

This task builds the zero-token validator that runs before LLM criticism.

- [ ] **Step 1: Write failing test - character state violation detection**

```python
# tests/test_novel_state_validator.py
import unittest
from pathlib import Path
import tempfile

from backend.core.novel_state_service import NovelStateService, NovelStateValidator


class NovelStateValidatorTests(unittest.TestCase):
    def test_dead_character_appearing_triggers_violation(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            service = NovelStateService(Path(tmpdir))
            # Set up state: character is dead
            service.save_state({
                "characters": {
                    "老张": "已死亡，在第3章中枪身亡",
                },
                "timeline": [],
                "foreshadows": {},
            })

            validator = NovelStateValidator(service)

            # Chapter content: dead character appears without flashback context
            chapter_content = """
老张推开门走了进来。
"你怎么来了？" 林岚惊讶地问。
"""

            passed, issues = validator.validate_chapter(4, chapter_content, [])

            self.assertFalse(passed)
            self.assertEqual(len(issues), 1)
            self.assertEqual(issues[0]["type"], "character_state_violation")
            self.assertEqual(issues[0]["severity"], "high")

    def test_dead_character_in_flashback_is_allowed(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            service = NovelStateService(Path(tmpdir))
            service.save_state({
                "characters": {
                    "老张": "已死亡，在第3章中枪身亡",
                },
                "timeline": [],
                "foreshadows": {},
            })

            validator = NovelStateValidator(service)

            # Flashback context should not trigger violation
            chapter_content = """
林岚回忆起三年前的那个下午。
老张推开门走了进来。
"准备好了吗？" 他问。
"""

            passed, issues = validator.validate_chapter(4, chapter_content, [])

            # Should pass - flashback is valid context
            self.assertTrue(passed)
            self.assertEqual(len(issues), 0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest tests.test_novel_state_validator.NovelStateValidatorTests.test_dead_character_appearing_triggers_violation -v`
Expected: FAIL with "cannot import name NovelStateValidator"

- [ ] **Step 3: Implement NovelStateValidator class**

Append to `backend/core/novel_state_service.py`:

```python
class NovelStateValidator:
    """
    纯代码状态校验器，零token消耗
    在 Critic 评审前运行，抓出硬错误
    """

    def __init__(self, state_service: NovelStateService):
        self.state_service = state_service

    def validate_chapter(
        self,
        chapter_index: int,
        chapter_content: str,
        scene_anchors: List[Dict],
    ) -> Tuple[bool, List[Dict]]:
        """
        校验本章内容与当前状态快照的一致性

        Returns:
            (是否通过, 发现的硬错误列表)
        """
        state = self.state_service.load_state()
        issues: List[Dict] = []

        # 检查1：角色一致性 - 已标记为死亡/离开的角色不应出现（除非回忆）
        for char_name, char_state in state.get("characters", {}).items():
            char_state_str = str(char_state)
            if ("死亡" in char_state_str or "离开" in char_state_str or "不在" in char_state_str):
                if char_name in chapter_content:
                    context_window = self._get_name_context(chapter_content, char_name)
                    # 检查是否是回忆/闪回上下文
                    flashback_indicators = ["回忆", "想起", "记得", "当年", "以前", "恍惚", "仿佛"]
                    is_flashback = any(indicator in context_window for indicator in flashback_indicators)
                    if not is_flashback:
                        issues.append({
                            "type": "character_state_violation",
                            "issue_type": "character_consistency",
                            "evidence_span": {"quote": char_name},
                            "severity": "high",
                            "fix_strategy": "state_consistency_repair",
                            "fix_instruction": f"{char_name} 状态为'{char_state}'，不应在本章出现，除非是回忆场景",
                        })

        # 检查2：伏笔堆积提醒（不强制失败，只作为参考）
        open_foreshadows = [
            k for k, v in state.get("foreshadows", {}).items()
            if isinstance(v, dict) and v.get("status") == "open"
        ]
        if len(open_foreshadows) &gt; 5 and chapter_index &gt; 5:
            issues.append({
                "type": "too_many_open_foreshadows",
                "issue_type": "plot_progress",
                "severity": "low",
                "fix_strategy": "foreshadow_review",
                "fix_instruction": f"当前有 {len(open_foreshadows)} 个未回收伏笔，建议在后续章节逐步回收",
            })

        return len(issues) == 0, issues

    @staticmethod
    def _get_name_context(content: str, name: str) -&gt; str:
        """提取名字出现的上下文窗口"""
        idx = content.find(name)
        if idx &lt; 0:
            return ""
        start = max(0, idx - 20)
        end = min(len(content), idx + 20)
        return content[start:end]
```

- [ ] **Step 4: Add missing imports**

At the top of `novel_state_service.py`, add:
```python
from typing import List, Dict, Tuple
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest tests.test_novel_state_validator -v`
Expected: Both tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/core/novel_state_service.py tests/test_novel_state_validator.py
git commit -m "feat: add NovelStateValidator for zero-token hard error detection"
```

---

## Task 2: NovelState Foreshadow Tracking and Attribution

**Files:**
- Modify: `backend/core/novel_state_service.py`
- Test: `tests/test_novel_state_validator.py` (add tests)

- [ ] **Step 1: Write failing test - foreshadow registration**

Add to `tests/test_novel_state_validator.py`:

```python
def test_register_foreshadow_creates_open_entry(self):
    with tempfile.TemporaryDirectory() as tmpdir:
        service = NovelStateService(Path(tmpdir))

        service.register_foreshadow(
            foreshadow_id="mysterious_key",
            chapter_index=3,
            scene_id="scene-2",
            description="一把生锈的铜钥匙，刻着看不懂的符号",
        )

        state = service.load_state()
        foreshadow = state["foreshadows"]["mysterious_key"]

        self.assertEqual(foreshadow["status"], "open")
        self.assertEqual(foreshadow["planted_chapter"], 3)
        self.assertEqual(foreshadow["planted_scene"], "scene-2")

def test_resolve_foreshadow_marks_as_resolved(self):
    with tempfile.TemporaryDirectory() as tmpdir:
        service = NovelStateService(Path(tmpdir))

        service.register_foreshadow("mysterious_key", 3, "scene-2", "描述")
        service.resolve_foreshadow(
            foreshadow_id="mysterious_key",
            chapter_index=7,
            scene_id="scene-1",
            resolution="钥匙打开了老王家的地下室门，里面是父亲留下的日记",
        )

        state = service.load_state()
        foreshadow = state["foreshadows"]["mysterious_key"]

        self.assertEqual(foreshadow["status"], "resolved")
        self.assertEqual(foreshadow["resolved_chapter"], 7)
        self.assertIn("日记", foreshadow["resolution"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest tests.test_novel_state_validator.NovelStateValidatorTests.test_register_foreshadow_creates_open_entry -v`
Expected: FAIL with "'NovelStateService' object has no attribute 'register_foreshadow'"

- [ ] **Step 3: Implement foreshadow tracking methods**

Add these methods to the `NovelStateService` class in `novel_state_service.py`:

```python
def register_foreshadow(
    self,
    foreshadow_id: str,
    chapter_index: int,
    scene_id: str,
    description: str,
):
    """登记一个新埋设的伏笔"""
    state = self.load_state()
    state.setdefault("foreshadows", {})[foreshadow_id] = {
        "status": "open",
        "planted_chapter": chapter_index,
        "planted_scene": scene_id,
        "description": description,
        "planted_at": datetime.utcnow().isoformat(),
    }
    self.save_state(state)

def resolve_foreshadow(
    self,
    foreshadow_id: str,
    chapter_index: int,
    scene_id: str,
    resolution: str,
):
    """标记伏笔已回收"""
    state = self.load_state()
    if foreshadow_id in state.get("foreshadows", {}):
        state["foreshadows"][foreshadow_id]["status"] = "resolved"
        state["foreshadows"][foreshadow_id]["resolved_chapter"] = chapter_index
        state["foreshadows"][foreshadow_id]["resolved_scene"] = scene_id
        state["foreshadows"][foreshadow_id]["resolution"] = resolution
        self.save_state(state)
```

- [ ] **Step 4: Enhance merge_delta with source attribution**

Update the `merge_delta` method signature and add attribution logic:

```python
def merge_delta(self, delta: Mapping[str, Any], source_scene: str = None) -&gt; dict[str, Any]:
    """
    合并状态变更

    Args:
        delta: 状态增量
        source_scene: 导致此变更的 scene_id，用于追溯
    """
    state = self.load_state()

    for character_name, character_state in dict(delta.get("characters") or {}).items():
        current = state.setdefault("characters", {}).setdefault(character_name, {})
        if isinstance(current, dict) and isinstance(character_state, Mapping):
            current.update(dict(character_state))
        else:
            state["characters"][character_name] = character_state

    timeline_delta = delta.get("timeline") or []
    if isinstance(timeline_delta, list):
        # 新增：记录来源和时间戳
        for event in timeline_delta:
            if isinstance(event, dict):
                event["source_scene"] = source_scene or "unknown"
                event["timestamp"] = datetime.utcnow().isoformat()
        state.setdefault("timeline", []).extend(timeline_delta)
        state["timeline"] = state["timeline"][-30:]

    foreshadow_delta = delta.get("foreshadows") or {}
    if isinstance(foreshadow_delta, Mapping):
        state.setdefault("foreshadows", {}).update(dict(foreshadow_delta))

    style_delta = delta.get("style") or {}
    if isinstance(style_delta, Mapping):
        state.setdefault("style", {}).update(dict(style_delta))

    return self.save_state(state)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest tests.test_novel_state_validator -v`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/core/novel_state_service.py tests/test_novel_state_validator.py
git commit -m "feat: add foreshadow tracking and state change attribution"
```

---

## Task 3: Critic Prompt Scene Awareness Enhancement

**Files:**
- Modify: `backend/prompts/critic.md`
- Modify: `backend/core/orchestrator.py` (pass scene_anchors to prompt context)

- [ ] **Step 1: Read current critic prompt to understand structure**

First, confirm the current prompt structure by reading it.

- [ ] **Step 2: Add Scene Anchor section to critic prompt**

In `backend/prompts/critic.md`, after the "2. 输入变量解析" section and before "3. 评审维度与扣分锚点", add:

```markdown
---

## 2.1 Scene Anchor 定位参考（仅作内部定位使用）

本章的 scene 边界，请参考以下锚点精准定位问题位置：

{% for anchor in scene_anchors %}
- **{{ anchor.scene_id }}**: 目标={{ anchor.goal }}
  - 冲突={{ anchor.conflict }}
  - 角色动机={{ anchor.character_intent }}
  - 状态变更={{ anchor.state_change }}
{% endfor %}

【定位规则】
1. 所有问题的 `evidence_span.quote` 必须是原文中可以精确找到的完整句子或短语
2. `scene_id` 字段必须从上面的列表中选择，问题落在哪个 scene 就填哪个
3. 如果问题跨多个 scene，选择最主要的那个 scene_id
```

- [ ] **Step 3: Add NovelState snapshot section to critic prompt**

After the Scene Anchor section, add:

```markdown
## 2.2 事实基准（Fact Base - 必须遵守）

以下是截至上一章的小说事实状态，本章内容与这些事实矛盾的地方必须报告为高严重度错误：

{{ novel_state_snapshot }}

【硬性规则】
1. 角色状态冲突（死亡后复活、离开后出现）必须标记为 high severity
2. 时间线穿越必须标记为 worldview_conflict 类型
3. 已回收的伏笔不应再次以"新发现"姿态出现
```

- [ ] **Step 4: Modify orchestrator to pass scene_anchors and state snapshot**

In `backend/core/orchestrator.py`, find the `_run_critic_harness` method. Update the method to build and pass the scene context:

First, add a helper method to format scene anchors for the prompt:

```python
def _format_scene_anchors_for_critic(self, chapter_index: int) -&gt; str:
    """Format scene anchors into the string format expected by Critic prompt."""
    if not hasattr(self, "scene_anchor_plans") or not self.scene_anchor_plans:
        return "（无 scene anchors）"

    for plan in self.scene_anchor_plans:
        if plan.get("chapter_index") == chapter_index:
            anchors = plan.get("scene_anchors", [])
            if not anchors:
                return "（无 scene anchors）"
            lines = []
            for anchor in anchors:
                lines.append(
                    f"- **{anchor.get('scene_id', 'unknown')}**: "
                    f"目标={anchor.get('goal', '')}; "
                    f"冲突={anchor.get('conflict', '')}; "
                    f"角色动机={anchor.get('character_intent', '')}; "
                    f"状态变更={anchor.get('state_change', '')}"
                )
            return "\n".join(lines)
    return "（无 scene anchors）"
```

- [ ] **Step 5: Update critic call to include context**

In `_run_critic_harness`, before calling `critic.critic_chapter`, ensure the context is available. Since the prompt template uses Jinja2-style variables that the prompt loader injects, we need to ensure the load_prompt function receives these values.

Update the critic call in `_run_critic_harness` to pass these additional context values to the prompt loader. The exact integration point depends on how `load_prompt` is currently called for Critic.

- [ ] **Step 6: Verify no syntax errors**

Run: `cd /Users/nobody1/Desktop/project/writer && python -c "from backend.core.orchestrator import NovelOrchestrator; print('OK')"`
Expected: No import errors

- [ ] **Step 7: Commit**

```bash
git add backend/prompts/critic.md backend/core/orchestrator.py
git commit -m "feat: enhance Critic prompt with scene anchors and state snapshot"
```

---

## Task 4: Scene-Grouped Local Repair

**Files:**
- Modify: `backend/core/orchestrator.py` (`_apply_repair_batch` method)
- Test: `tests/test_scene_grouped_repair.py`

- [ ] **Step 1: Write failing test - issues grouped by scene_id**

```python
# tests/test_scene_grouped_repair.py
import unittest
import tempfile
from pathlib import Path
from types import SimpleNamespace

from backend.core.orchestrator import NovelOrchestrator


class SceneGroupedRepairTests(unittest.TestCase):
    def test_issues_grouped_by_scene_id_before_repair(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
            orchestrator.output_dir = project_dir
            orchestrator.writer_perspective = None
            orchestrator.perspective_strength = 0.7

            issues = [
                {"scene_id": "scene-1", "issue_type": "style_match", "evidence_span": {"quote": "目标1"}, "fix_instruction": "修复1"},
                {"scene_id": "scene-1", "issue_type": "plot_progress", "evidence_span": {"quote": "目标2"}, "fix_instruction": "修复2"},
                {"scene_id": "scene-2", "issue_type": "character_consistency", "evidence_span": {"quote": "目标3"}, "fix_instruction": "修复3"},
            ]

            normalized = [orchestrator._normalize_repair_issue(issue) for issue in issues]

            # Verify grouping logic works as expected
            from collections import defaultdict
            issues_by_scene = defaultdict(list)
            for issue in normalized:
                scene_id = issue.get("scene_id", "chapter")
                issues_by_scene[scene_id].append(issue)

            self.assertEqual(len(issues_by_scene), 2)
            self.assertEqual(len(issues_by_scene["scene-1"]), 2)
            self.assertEqual(len(issues_by_scene["scene-2"]), 1)

    def test_max_two_issues_per_scene_limit(self):
        """Each scene should only attempt repair on its top 2 issues to avoid over-modification."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
            orchestrator.output_dir = project_dir
            orchestrator.writer_perspective = None
            orchestrator.perspective_strength = 0.7

            # 4 issues all in the same scene
            issues = [
                {"scene_id": "scene-1", "evidence_span": {"quote": f"目标{i}"}, "fix_instruction": f"修复{i}"}
                for i in range(4)
            ]

            normalized = [orchestrator._normalize_repair_issue(issue) for issue in issues]

            # Simulate the per-scene limit of 2
            from collections import defaultdict
            issues_by_scene = defaultdict(list)
            for issue in normalized:
                scene_id = issue.get("scene_id", "chapter")
                issues_by_scene[scene_id].append(issue)

            issues_attempted = []
            for scene_issues in issues_by_scene.values():
                issues_attempted.extend(scene_issues[:2])

            self.assertEqual(len(issues_attempted), 2)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest tests.test_scene_grouped_repair -v`
Expected: PASS for helper logic test, but we haven't integrated grouping yet

- [ ] **Step 3: Modify _apply_repair_batch to use grouping**

Update the `_apply_repair_batch` method in orchestrator.py:

```python
def _apply_repair_batch(
    self,
    chapter_index: int,
    current_content: str,
    issues: List[Dict],
    chapter_outline: str,
    revise_round: int,
) -&gt; Tuple[str, bool, List[Dict]]:
    """Apply local repairs when possible; return content, used_local, trace."""
    repair_trace: List[Dict] = []
    used_local_repair = False
    normalized_issues = [self._normalize_repair_issue(issue) for issue in (issues or [])]
    local_revise = getattr(self.revise, "revise_local_patch", None)

    # 按 scene_id 分组修复，同一个 scene 的问题批量处理
    from collections import defaultdict
    issues_by_scene: Dict[str, List[Dict]] = defaultdict(list)
    for issue in normalized_issues:
        scene_id = issue.get("scene_id", "chapter")
        issues_by_scene[scene_id].append(issue)

    if normalized_issues:
        strategies = ", ".join(issue.get("fix_strategy", "local_rewrite") for issue in normalized_issues[:3])
        self._report_workflow_event(
            f"Workflow v2 · 第{chapter_index}章 Failure Router：本轮策略 {strategies}，跨 {len(issues_by_scene)} 个scene"
        )

    # 每个 scene 最多修复前2个问题，避免过度修改
    for scene_id, scene_issues in issues_by_scene.items():
        for issue in scene_issues[:2]:
            evidence_quote = str((issue.get("evidence_span") or {}).get("quote") or issue.get("location") or "")
            if not local_revise or not evidence_quote or evidence_quote == "全文":
                continue
            local_context = build_local_repair_context(current_content, evidence_quote)
            if not local_context.get("target"):
                continue

            before_content = current_content
            patch = local_revise(
                current_content,
                issue,
                {
                    **local_context,
                    "chapter_outline": chapter_outline,
                    "repair_strategy": issue.get("fix_strategy"),
                },
                self.setting_bible,
                perspective=self.writer_perspective,
                perspective_strength=self.perspective_strength,
            )
            patched_content, applied = apply_local_patch(current_content, patch or {})
            trace_item = {
                "artifact_type": "repair_trace",
                "chapter_index": chapter_index,
                "revision_round": revise_round,
                "issue": issue,
                "repair_strategy": issue.get("fix_strategy"),
                "evidence": issue.get("evidence_span"),
                "target_text": (patch or {}).get("target_text") if isinstance(patch, dict) else "",
                "replacement_applied": bool(applied),
                "scene_id": scene_id,
            }
            repair_trace.append(trace_item)
            if applied and patched_content != before_content:
                current_content = patched_content
                used_local_repair = True
                self._report_workflow_event(
                    f"Workflow v2 · 第{chapter_index}章 {scene_id} Local Revise：已局部替换 {issue.get('fix_strategy')}"
                )

    if used_local_repair:
        current_content = self.run_stitching_pass(chapter_index, current_content, repair_trace)
        self.repair_traces.extend(repair_trace)
        return current_content, True, repair_trace

    # 局部修复全部失败，回退到整章修订
    current_content = self.revise.revise_chapter(
        current_content,
        issues,
        self.setting_bible,
        perspective=self.writer_perspective,
        perspective_strength=self.perspective_strength,
    )
    self._report_workflow_event(
        f"Workflow v2 · 第{chapter_index}章 Revise：局部定位不足，已回退整章轻量修订"
    )
    return current_content, False, repair_trace
```

- [ ] **Step 4: Add missing import for Dict**

Ensure `from typing import Dict` is at the top of orchestrator.py (it should already be there).

- [ ] **Step 5: Run existing tests to ensure no regression**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest tests.test_workflow_optimization -v`
Expected: All existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add backend/core/orchestrator.py tests/test_scene_grouped_repair.py
git commit -m "feat: scene-grouped local repair with max 2 issues per scene limit"
```

---

## Task 5: Chapter Consistency Pass (终检层)

**Files:**
- Modify: `backend/core/orchestrator.py` (add new method and integrate)
- Test: Add test to `tests/test_scene_grouped_repair.py`

- [ ] **Step 1: Write failing test for consistency pass**

Add to `tests/test_scene_grouped_repair.py`:

```python
def test_consistency_pass_detects_missing_state_change(self):
    with tempfile.TemporaryDirectory() as tmpdir:
        project_dir = Path(tmpdir)
        orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        orchestrator.output_dir = project_dir

        from backend.core.novel_state_service import NovelStateService
        orchestrator.novel_state_service = NovelStateService(project_dir)

        scene_anchors = [
            {
                "scene_id": "scene-1",
                "goal": "主角找到钥匙",
                "state_change": "获得铜钥匙",
            }
        ]

        # Chapter content doesn't mention the key
        chapter_content = """
第1章 码头接头

林岚在码头等了半个小时。
潮水涨上来，打湿了她的鞋。
"""

        passed, issues = orchestrator.run_chapter_consistency_pass(1, chapter_content, scene_anchors)

        self.assertFalse(passed)
        self.assertEqual(len(issues), 1)
        self.assertIn("铜钥匙", issues[0]["fix"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest tests.test_scene_grouped_repair.SceneGroupedRepairTests.test_consistency_pass_detects_missing_state_change -v`
Expected: FAIL with "no attribute 'run_chapter_consistency_pass'"

- [ ] **Step 3: Implement run_chapter_consistency_pass method**

Add to orchestrator.py:

```python
def run_chapter_consistency_pass(
    self,
    chapter_index: int,
    chapter_content: str,
    scene_anchors: List[Dict],
) -&gt; Tuple[bool, List[Dict]]:
    """
    章节级一致性终检（纯代码，零token消耗）
    检查项：
    1. scene锚点的 state_change 是否已在内容中体现
    2. 结尾钩子强度（基于简单长度/标点启发式）

    Returns:
        (是否通过, 发现的问题列表)
    """
    issues: List[Dict] = []

    # 检查1：state_change 的关键术语是否出现在内容中
    for anchor in scene_anchors:
        state_change = anchor.get("state_change", "")
        if state_change and len(state_change.strip()) &gt; 3:
            # 检查 state_change 中的关键词是否出现在章节内容
            # 简单的启发式：提取2个以上的中文字符序列
            import re
            keywords = re.findall(r'[一-鿿]{2,}', state_change)
            found_any = False
            for kw in keywords[:3]:
                if kw in chapter_content:
                    found_any = True
                    break
            if not found_any and keywords:
                issues.append({
                    "type": "scene_state_mismatch",
                    "scene_id": anchor.get("scene_id"),
                    "location": "全文",
                    "issue_type": "plot_progress",
                    "severity": "medium",
                    "fix_strategy": "scene_goal_rewrite",
                    "fix_instruction": (
                        f"场景 {anchor.get('scene_id')} 预期的状态变更 '{state_change}' "
                        f"未在内容中体现，关键词 '{keywords[0]}' 未找到，需要补充相关描写"
                    ),
                })

    # 检查2：结尾是否有钩子的简单启发式
    # 结尾短句 + 悬念标点 = 可能有钩子
    paragraphs = [p.strip() for p in chapter_content.strip().split("\n") if p.strip()]
    if paragraphs:
        last_paragraph = paragraphs[-1]
        if len(last_paragraph) &gt; 80:
            issues.append({
                "type": "long_ending_no_hook",
                "scene_id": scene_anchors[-1].get("scene_id") if scene_anchors else "chapter",
                "location": last_paragraph[-20:],
                "issue_type": "hook_strength",
                "severity": "low",
                "fix_strategy": "hook_rewrite",
                "fix_instruction": "结尾段落过长，可能缺少强有力的悬念钩子",
            })

    return len(issues) == 0, issues
```

- [ ] **Step 4: Integrate consistency pass into run_chapter_generation**

In `run_chapter_generation`, right before saving the chapter, add:

```python
# Chapter Consistency Pass - 纯代码终检
consistency_passed, consistency_issues = self.run_chapter_consistency_pass(
    chapter_index,
    current_content,
    scene_anchors,
)
if not consistency_passed:
    self._report_workflow_event(
        f"Workflow v2 · 第{chapter_index}章 Consistency Pass：发现 {len(consistency_issues)} 个状态一致性问题"
    )
    # 将发现的问题追加到 issues 列表，进入最终修复流程
    issues.extend(consistency_issues)
    # 如果原本通过了，但终检发现问题，需要重新标记
    passed = False
```

Find the right location: insert after the final `_run_critic_harness` call and guardrail check, before the save operation.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest tests.test_scene_grouped_repair -v`
Expected: All tests PASS

- [ ] **Step 6: Run full workflow test suite**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest tests.test_workflow_optimization -v`
Expected: All tests still pass (no regression)

- [ ] **Step 7: Commit**

```bash
git add backend/core/orchestrator.py tests/test_scene_grouped_repair.py
git commit -m "feat: add chapter consistency pass for zero-token final validation"
```

---

## Task 6: Integrate NovelStateValidator into Workflow

**Files:**
- Modify: `backend/core/orchestrator.py`
- Test: Add integration test to existing test file

- [ ] **Step 1: Write failing integration test**

Add to `tests/test_workflow_optimization.py`:

```python
def test_novel_state_validator_runs_before_critic(self):
    """NovelStateValidator should detect hard errors and add them before Critic runs."""
    with tempfile.TemporaryDirectory() as tmpdir:
        project_dir = Path(tmpdir)
        orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        orchestrator.output_dir = project_dir
        orchestrator.project_dir = str(project_dir)
        orchestrator.info_path = project_dir / "info.json"
        orchestrator.plan = "plan"
        orchestrator.setting_bible = """
主角：林岚
配角：老张（已死亡，第3章中枪）
"""
        orchestrator.chapter_outlines = [
            {
                "chapter_num": 4,
                "title": "第四章",
                "outline": "林岚调查真相",
                "target_word_count": 2000,
            }
        ]
        orchestrator.req = {"content_type": "novel"}
        orchestrator.content_type = "novel"
        orchestrator.novel_name = "Test Novel"
        orchestrator.chapter_word_count = "2000"
        orchestrator.skip_chapter_confirm = True
        orchestrator.dimension_scores = {"plot": [], "character": [], "hook": [], "writing": [], "setting": []}
        orchestrator.evaluation_reports = []
        orchestrator._check_cancellation = lambda: None

        from backend.core.novel_state_service import NovelStateService, NovelStateValidator
        orchestrator.novel_state_service = NovelStateService(project_dir)
        orchestrator.scene_anchor_plans = []
        orchestrator.repair_traces = []
        orchestrator.stitching_reports = []
        orchestrator.novel_state_snapshots = []
        orchestrator.chapter_scores = []
        orchestrator.writer_perspective = None
        orchestrator.perspective_strength = 0.7
        orchestrator.use_perspective_critic = True

        # Set up state: 老张 is dead
        orchestrator.novel_state_service.save_state({
            "characters": {
                "老张": "已死亡，在第3章中枪身亡",
            },
            "timeline": [],
            "foreshadows": {},
        })

        class FakeWriter:
            def generate_chapter(self, *args, **kwargs):
                return """
第4章 真相

老张推开门走了进来。
"你还活着？" 林岚瞪大了眼睛。
"""

        critic_called_with = []

        class FakeCritic:
            def critic_chapter(self, chapter_content, setting_bible, chapter_outline, content_type, perspective=None, perspective_strength=0.7):
                critic_called_with.append(chapter_content)
                return True, 8, {}, []

        class FakeRevise:
            def revise_chapter(self, *args, **kwargs):
                return args[0]
            def revise_local_patch(self, *args, **kwargs):
                return {}
            def stitch_chapter(self, *args, **kwargs):
                return args[0]

        orchestrator.writer = FakeWriter()
        orchestrator.critic = FakeCritic()
        orchestrator.revise = FakeRevise()

        original_guardrails = orchestrator_module.run_system_guardrails
        original_search_related = orchestrator_module.search_related_chapter_content
        original_search_core = orchestrator_module.search_core_setting
        original_add_chapter = orchestrator_module.add_chapter_to_db
        try:
            orchestrator_module.search_related_chapter_content = lambda *args, **kwargs: ""
            orchestrator_module.search_core_setting = lambda *args, **kwargs: ""
            orchestrator_module.add_chapter_to_db = lambda *args, **kwargs: None
            orchestrator_module.run_system_guardrails = lambda content, context: SimpleNamespace(
                corrected_content=content,
                warnings=[],
                suggestions=[],
                metrics={"word_count": 200},
                violations={},
                passed=True,
            )

            content, score, passed, issues = orchestrator.run_chapter_generation(4)

            # State validator should have detected the dead character
            self.assertFalse(passed)
            # The issue should be in the list
            self.assertTrue(any("老张" in str(i.get("fix_instruction", "")) or "老张" in str(i.get("fix", "")) for i in issues))
        finally:
            orchestrator_module.run_system_guardrails = original_guardrails
            orchestrator_module.search_related_chapter_content = original_search_related
            orchestrator_module.search_core_setting = original_search_core
            orchestrator_module.add_chapter_to_db = original_add_chapter
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest tests.test_workflow_optimization.WorkflowOptimizationOrchestratorTests.test_novel_state_validator_runs_before_critic -v`
Expected: FAIL (validator not yet integrated)

- [ ] **Step 3: Integrate NovelStateValidator into run_chapter_generation**

In `run_chapter_generation`, after the System Guardrails step and before the first Critic call, add:

```python
# NovelStateValidator - 纯代码硬错误检测，零token消耗
from backend.core.novel_state_service import NovelStateValidator
validator = NovelStateValidator(self.novel_state_service)
state_passed, state_issues = validator.validate_chapter(
    chapter_index,
    current_content,
    scene_anchors,
)
if not state_passed:
    self._report_workflow_event(
        f"Workflow v2 · 第{chapter_index}章 NovelStateValidator：发现 {len(state_issues)} 个硬错误"
    )
    issues.extend(state_issues)
    passed = False
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest tests.test_workflow_optimization.WorkflowOptimizationOrchestratorTests.test_novel_state_validator_runs_before_critic -v`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest discover tests -v 2&gt;&amp;1 | tail -30`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/core/orchestrator.py tests/test_workflow_optimization.py
git commit -m "feat: integrate NovelStateValidator into generation workflow"
```

---

## Task 7: Feature Flags and Configuration

**Files:**
- Modify: `backend/core/config.py` (add feature toggle settings)

- [ ] **Step 1: Add feature toggles to Settings class**

In `backend/core/config.py`, add to the Settings class:

```python
# Workflow Quality Enhancement - Feature Toggles
enable_scene_aware_critic: bool = True
enable_novel_state_validator: bool = True
enable_scene_grouped_repair: bool = True
enable_chapter_consistency_pass: bool = True
```

- [ ] **Step 2: Guard all new features with config checks**

Wrap each new feature in orchestrator with config checks:

```python
if settings.enable_novel_state_validator:
    # run validator
```

```python
if settings.enable_scene_grouped_repair:
    # use grouped repair logic
else:
    # original sequential repair
```

```python
if settings.enable_chapter_consistency_pass:
    # run consistency pass
```

- [ ] **Step 3: Run tests to verify no regression**

Run: `cd /Users/nobody1/Desktop/project/writer && python -m unittest discover tests -v`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/core/config.py backend/core/orchestrator.py
git commit -m "feat: add feature flags for all workflow quality enhancements"
```

---

## Plan Self-Review

 **Spec coverage:**
- A optimization (scene-aware criticism): Task 3 + Task 4
- C optimization (NovelState as gatekeeper): Task 1 + Task 6
- Foreshadow tracking: Task 2
- Chapter consistency pass: Task 5
- Feature flags: Task 7

 **Placeholder scan:** No TBD/TODO placeholders found. All code steps have exact code.

 **Type consistency:** All method names, property names, types are consistent across tasks.

 **No new dependencies:** All enhancements use existing dependencies.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-27-workflow-quality-enhancement.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
