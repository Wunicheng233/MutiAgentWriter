from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import backend.core.orchestrator as orchestrator_module
from backend.core.orchestrator import ChapterQualityGateError, NovelOrchestrator
from backend.core.workflow_optimization import (
    apply_local_patch,
    apply_stitching_patch,
    build_local_repair_context,
    build_stitching_context,
    extract_scene_anchor_blocks_by_chapter,
    normalize_critic_v2_payload,
    parse_scene_anchors_from_outline,
    route_repair_strategy,
)
from backend.core.word_count_policy import WordCountPolicy


DIMENSIONS = {"plot": 8, "character": 8, "hook": 8, "writing": 8, "setting": 8}


class WorkflowOptimizationHelperTests(unittest.TestCase):
    def test_scene_anchor_json_parse_and_fallback_to_chapter_goal(self):
        outline = """
第2章 码头接头

```json
{
  "scene_anchors": [
    {
      "scene_id": "scene-1",
      "goal": "主角抵达码头并找到线人",
      "conflict": "线人被另一伙人盯上",
      "character_intent": "主角想确认父亲留下的暗号",
      "state_change": "获得半枚铜钥匙",
      "hook_intent": "箱子里传出陌生人的呼吸声"
    }
  ]
}
```
"""
        anchors = parse_scene_anchors_from_outline(outline, default_word_count=1800)

        self.assertEqual(len(anchors), 1)
        self.assertEqual(anchors[0]["scene_id"], "scene-1")
        self.assertEqual(anchors[0]["goal"], "主角抵达码头并找到线人")
        self.assertEqual(anchors[0]["target_word_count"], 1800)

        fallback = parse_scene_anchors_from_outline("本章目标：主角调查码头", default_word_count=1200)
        self.assertEqual(len(fallback), 1)
        self.assertEqual(fallback[0]["scene_id"], "scene-1")
        self.assertIn("主角调查码头", fallback[0]["goal"])

    def test_scene_anchor_blocks_are_keyed_by_chapter(self):
        setting_bible = """
### 第1章
```json
{"chapter": 1, "scene_anchors": [{"scene_id": "scene-1", "goal": "开场"}]}
```

### 第2章
```json
{"chapter": 2, "scene_anchors": [{"scene_id": "scene-1", "goal": "追击"}]}
```
"""

        blocks = extract_scene_anchor_blocks_by_chapter(setting_bible)

        self.assertEqual(blocks[1]["scene_anchors"][0]["goal"], "开场")
        self.assertEqual(blocks[2]["scene_anchors"][0]["goal"], "追击")

    def test_critic_v2_normalize_fills_missing_fields_and_preserves_span(self):
        payload = {
            "plot_progress": [
                {
                    "scene_id": "scene-2",
                    "evidence_span": "目标问题段",
                    "severity": "high",
                    "fix_instruction": "补足冲突升级，让该场景产生不可逆后果",
                }
            ]
        }

        normalized = normalize_critic_v2_payload(payload)

        self.assertEqual(normalized["schema_version"], "chapter_critique_v2")
        self.assertIn("character_consistency", normalized["diagnostics"])
        self.assertEqual(normalized["diagnostics"]["character_consistency"], [])
        self.assertEqual(normalized["issues"][0]["issue_type"], "plot_progress")
        self.assertEqual(normalized["issues"][0]["scene_id"], "scene-2")
        self.assertEqual(normalized["issues"][0]["evidence_span"]["quote"], "目标问题段")
        self.assertEqual(normalized["issues"][0]["fix_strategy"], "scene_goal_rewrite")

    def test_failure_router_maps_issue_types_to_local_strategies(self):
        self.assertEqual(route_repair_strategy({"issue_type": "worldview_conflict"}), "state_consistency_repair")
        self.assertEqual(route_repair_strategy({"issue_type": "style_match"}), "style_repair")
        self.assertEqual(route_repair_strategy({"issue_type": "redundancy"}), "compression_tension_rewrite")
        self.assertEqual(route_repair_strategy({"type": "格式问题"}), "format_repair")
        self.assertEqual(route_repair_strategy({"type": "未知"}), "local_rewrite")

    def test_local_patch_uses_adjacency_context_and_preserves_surrounding_text(self):
        chapter = "开头段。\n\n前一段。\n\n目标问题段。\n\n后一段。\n\n结尾段。"

        context = build_local_repair_context(chapter, "目标问题段")
        self.assertEqual(context["previous"], "前一段。")
        self.assertEqual(context["target"], "目标问题段。")
        self.assertEqual(context["next"], "后一段。")

        patched, applied = apply_local_patch(
            chapter,
            {
                "target_text": "目标问题段。",
                "replacement_text": "修复后的问题段。",
                "bridge_sentence": "过渡句。",
            },
        )

        self.assertTrue(applied)
        self.assertIn("开头段。", patched)
        self.assertIn("前一段。", patched)
        self.assertIn("过渡句。\n\n修复后的问题段。", patched)
        self.assertIn("后一段。", patched)
        self.assertIn("结尾段。", patched)
        self.assertNotIn("目标问题段。", patched)

    def test_stitching_patch_only_replaces_neighbor_window(self):
        chapter = "开头固定。\n\n前一段。\n\n目标段。\n\n后一段。\n\n结尾固定。"

        context = build_stitching_context(chapter, "目标段")
        stitched, applied = apply_stitching_patch(
            chapter,
            context,
            "前一段。衔接更自然。\n\n目标段。\n\n后一段。时间线更清晰。",
        )

        self.assertTrue(applied)
        self.assertTrue(stitched.startswith("开头固定。"))
        self.assertTrue(stitched.endswith("结尾固定。"))
        self.assertIn("衔接更自然", stitched)
        self.assertIn("时间线更清晰", stitched)


class WorkflowOptimizationOrchestratorTests(unittest.TestCase):
    def test_outline_parser_keeps_table_rows_and_attaches_matching_anchor_blocks(self):
        orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        orchestrator.chapter_word_count = "2000"
        orchestrator.plan = "fallback"
        orchestrator.setting_bible = """
| 章节 | 本章目标（情节推进） | 核心冲突/爽点 | 结尾钩子 |
| :--- | :--- | :--- | :--- |
| 第1章 | 主角抵达码头 | 线人失踪 | 箱子发出声音 |
| 第2章 | 主角追查货单 | 对手销毁证据 | 货单指向熟人 |

## 五、Scene Anchors
### 第1章
```json
{"chapter": 1, "scene_anchors": [{"scene_id": "scene-1", "goal": "码头接头"}]}
```

### 第2章
```json
{"chapter": 2, "scene_anchors": [{"scene_id": "scene-1", "goal": "追查货单"}]}
```
"""

        outlines = orchestrator.parse_outlines_from_setting_bible()

        self.assertEqual(outlines[0]["chapter_num"], 1)
        self.assertIn("主角抵达码头", outlines[0]["outline"])
        self.assertIn("码头接头", outlines[0]["outline"])
        self.assertNotIn("主角追查货单", outlines[0]["outline"])
        self.assertEqual(outlines[1]["chapter_num"], 2)
        self.assertIn("主角追查货单", outlines[1]["outline"])
        self.assertIn("追查货单", outlines[1]["outline"])
        self.assertNotIn("码头接头", outlines[1]["outline"])

    def test_failed_critic_uses_local_repair_and_stitching_before_recheck(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
            orchestrator.output_dir = project_dir
            orchestrator.project_dir = str(project_dir)
            orchestrator.info_path = project_dir / "info.json"
            orchestrator.plan = "plan"
            orchestrator.setting_bible = "主角：林岚"
            orchestrator.chapter_outlines = [
                {
                    "chapter_num": 1,
                    "title": "第一章",
                    "outline": "本章目标：抵达码头\nscene_anchors: []",
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
            from backend.core.novel_state_service import NovelStateService
            orchestrator.novel_state_service = NovelStateService(project_dir)
            orchestrator.scene_anchor_plans = []
            orchestrator.repair_traces = []
            orchestrator.stitching_reports = []
            orchestrator.novel_state_snapshots = []
            orchestrator.chapter_scores = []
            # 视角配置：局部修复和 stitching 也必须继承同一作家风格
            orchestrator.writer_perspective = "liu-cixin"
            orchestrator.perspective_strength = 0.8
            orchestrator.use_perspective_critic = True
            orchestrator.word_count_policy = WordCountPolicy(min_ratio=0.01, max_ratio=10)

            class FakeWriter:
                def generate_chapter(self, *args, **kwargs):
                    return "第1章 标题\n\n开头段。\n\n前一段。\n\n目标问题段。\n\n后一段。\n\n结尾段。"

            class FakeCritic:
                def __init__(self):
                    self.calls = 0

                def critic_chapter(self, chapter_content, setting_bible, chapter_outline, content_type, perspective: str = None, perspective_strength: float = 0.7):
                    self.calls += 1
                    if self.calls == 1:
                        issue = {
                            "issue_type": "style_match",
                            "scene_id": "scene-1",
                            "location": "目标问题段",
                            "evidence_span": {"quote": "目标问题段"},
                            "severity": "medium",
                            "fix_instruction": "将该段改得更克制，贴合本章语气",
                        }
                        critique_v2 = {"style_match": [issue]}
                        return False, 5, DIMENSIONS, [issue], critique_v2
                    return True, 9, DIMENSIONS, []

            class FakeRevise:
                def __init__(self):
                    self.local_called = False
                    self.whole_called = False
                    self.stitch_called = False

                def revise_chapter(self, original_chapter, issues, setting_bible, perspective: str = None, perspective_strength: float = 0.7):
                    self.whole_called = True
                    return original_chapter

                def revise_local_patch(self, original_chapter, repair_issue, local_context, setting_bible, perspective: str = None, perspective_strength: float = 0.7):
                    self.local_called = True
                    self.local_context = local_context
                    self.local_perspective = perspective
                    self.local_perspective_strength = perspective_strength
                    return {
                        "target_text": "目标问题段。",
                        "replacement_text": "修复后的问题段。",
                        "bridge_sentence": "",
                    }

                def stitch_chapter(self, chapter_content, repair_trace, setting_bible, perspective: str = None, perspective_strength: float = 0.7):
                    self.stitch_called = True
                    self.stitch_perspective = perspective
                    self.stitch_perspective_strength = perspective_strength
                    return chapter_content.replace("前一段。", "前一段。衔接更自然。")

            fake_revise = FakeRevise()
            orchestrator.writer = FakeWriter()
            orchestrator.critic = FakeCritic()
            orchestrator.revise = fake_revise

            original_guardrails = orchestrator_module.run_system_guardrails
            original_search_related = orchestrator_module.search_related_chapter_content
            original_search_core = orchestrator_module.search_core_setting
            original_add_chapter = orchestrator_module.add_chapter_to_db
            # Import and patch settings for this test to disable consistency pass
            from backend.core.config import settings as config_settings
            original_consistency = config_settings.enable_chapter_consistency_pass
            original_validator = config_settings.enable_novel_state_validator
            try:
                # Disable quality workflow enhancements for this test
                # (focus is on local repair mechanism, not new quality checks)
                config_settings.enable_chapter_consistency_pass = False
                config_settings.enable_novel_state_validator = False
                orchestrator_module.search_related_chapter_content = lambda *args, **kwargs: ""
                orchestrator_module.search_core_setting = lambda *args, **kwargs: ""
                orchestrator_module.add_chapter_to_db = lambda *args, **kwargs: None
                orchestrator_module.run_system_guardrails = lambda content, context: SimpleNamespace(
                    corrected_content=content,
                    warnings=[],
                    suggestions=[],
                    metrics={"word_count": context["target_word_count"]},
                    violations={},
                    passed=True,
                )

                content, score, passed, issues = orchestrator.run_chapter_generation(1)
            finally:
                orchestrator_module.run_system_guardrails = original_guardrails
                orchestrator_module.search_related_chapter_content = original_search_related
                orchestrator_module.search_core_setting = original_search_core
                orchestrator_module.add_chapter_to_db = original_add_chapter
                config_settings.enable_chapter_consistency_pass = original_consistency
                config_settings.enable_novel_state_validator = original_validator

            self.assertTrue(passed)
            self.assertEqual(score, 9.0)
            self.assertTrue(fake_revise.local_called)
            self.assertTrue(fake_revise.stitch_called)
            self.assertFalse(fake_revise.whole_called)
            self.assertIn("前一段。衔接更自然。", content)
            self.assertIn("修复后的问题段。", content)
            self.assertIn("结尾段。", content)
            self.assertNotIn("目标问题段。", content)
            self.assertEqual(fake_revise.local_context["previous"], "前一段。")
            self.assertEqual(fake_revise.local_perspective, "liu-cixin")
            self.assertEqual(fake_revise.local_perspective_strength, 0.8)
            self.assertEqual(fake_revise.stitch_perspective, "liu-cixin")
            self.assertEqual(fake_revise.stitch_perspective_strength, 0.8)

    def test_final_word_gate_uses_expansion_repair_for_under_target_content(self):
        orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        orchestrator.word_count_policy = WordCountPolicy()
        orchestrator._check_cancellation = lambda: None
        orchestrator._report_workflow_event = lambda message: None

        captured = {}

        def fake_apply_repair_batch(
            chapter_index,
            current_content,
            issues,
            chapter_outline,
            revise_round,
        ):
            captured["issues"] = issues
            captured["revise_round"] = revise_round
            return "第1章 标题\n\n" + ("字" * 1800), True, []

        orchestrator._apply_repair_batch = fake_apply_repair_batch

        content, passed, issues = orchestrator._enforce_final_word_count(
            chapter_index=1,
            current_content="第1章 标题\n\n" + ("字" * 1200),
            chapter_outline="本章目标：主角收到辞职信",
            target_word_count=2000,
            budgeted_scene_plan={
                "beats": [
                    {"beat_id": "opening", "goal": "承接上一章", "word_budget": 400},
                    {"beat_id": "conflict", "goal": "辞职信制造冲突", "word_budget": 900},
                ]
            },
            revise_round=2,
        )

        self.assertTrue(passed)
        self.assertEqual(content, "第1章 标题\n\n" + ("字" * 1800))
        self.assertEqual(issues, [])
        self.assertEqual(captured["revise_round"], 3)
        self.assertEqual(captured["issues"][0]["issue_type"], "word_count_under_target")
        self.assertEqual(captured["issues"][0]["fix_strategy"], "expansion_repair")

    def test_skip_confirm_generation_fails_when_final_word_gate_remains_invalid(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            (project_dir / "chapters").mkdir(parents=True)
            orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
            orchestrator.output_dir = project_dir
            orchestrator.project_dir = str(project_dir)
            orchestrator.info_path = project_dir / "info.json"
            orchestrator.plan = "plan"
            orchestrator.setting_bible = "主角：林岚"
            orchestrator.chapter_outlines = [
                {
                    "chapter_num": 1,
                    "title": "第一章",
                    "outline": "本章目标：收到异常短信",
                    "target_word_count": 1000,
                }
            ]
            orchestrator.req = {"content_type": "novel"}
            orchestrator.content_type = "novel"
            orchestrator.novel_name = "Test Novel"
            orchestrator.chapter_word_count = "1000"
            orchestrator.skip_chapter_confirm = True
            orchestrator.dimension_scores = {"plot": [], "character": [], "hook": [], "writing": [], "setting": []}
            orchestrator.evaluation_reports = []
            orchestrator.scene_anchor_plans = []
            orchestrator.budgeted_scene_plans = []
            orchestrator.repair_traces = []
            orchestrator.stitching_reports = []
            orchestrator.novel_state_snapshots = []
            orchestrator.chapter_scores = []
            orchestrator.writer_perspective = None
            orchestrator.perspective_strength = 0.7
            orchestrator.use_perspective_critic = True
            orchestrator.word_count_policy = WordCountPolicy()
            orchestrator._check_cancellation = lambda: None
            from backend.core.novel_state_service import NovelStateService
            orchestrator.novel_state_service = NovelStateService(project_dir)

            class FakeWriter:
                def generate_chapter(self, *args, **kwargs):
                    return "第1章 标题\n\n太短。"

            class FakeCritic:
                def critic_chapter(self, *args, **kwargs):
                    return True, 8, DIMENSIONS, [], {}

            class FakeRevise:
                def revise_chapter(self, original_chapter, issues, setting_bible, **kwargs):
                    return original_chapter

            orchestrator.writer = FakeWriter()
            orchestrator.critic = FakeCritic()
            orchestrator.revise = FakeRevise()

            original_search_related = orchestrator_module.search_related_chapter_content
            original_search_core = orchestrator_module.search_core_setting
            original_add_chapter = orchestrator_module.add_chapter_to_db
            from backend.core.config import settings as config_settings
            original_consistency = config_settings.enable_chapter_consistency_pass
            original_validator = config_settings.enable_novel_state_validator
            try:
                orchestrator_module.search_related_chapter_content = lambda *args, **kwargs: ""
                orchestrator_module.search_core_setting = lambda *args, **kwargs: ""
                orchestrator_module.add_chapter_to_db = lambda *args, **kwargs: None
                config_settings.enable_chapter_consistency_pass = False
                config_settings.enable_novel_state_validator = False

                with self.assertRaises(ChapterQualityGateError) as error:
                    orchestrator.run_chapter_generation(1)
            finally:
                orchestrator_module.search_related_chapter_content = original_search_related
                orchestrator_module.search_core_setting = original_search_core
                orchestrator_module.add_chapter_to_db = original_add_chapter
                config_settings.enable_chapter_consistency_pass = original_consistency
                config_settings.enable_novel_state_validator = original_validator

            self.assertEqual(error.exception.chapter_index, 1)
            self.assertTrue((project_dir / "chapters" / "chapter_1.txt").exists())
            self.assertEqual(orchestrator.chapter_scores[0]["passed"], False)
            self.assertEqual(orchestrator.chapter_scores[0]["issues"][-1]["issue_type"], "word_count_under_target")


if __name__ == "__main__":
    unittest.main()
