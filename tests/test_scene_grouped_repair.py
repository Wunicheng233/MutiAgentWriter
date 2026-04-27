import tempfile
from pathlib import Path
from unittest import TestCase

from backend.core.orchestrator import NovelOrchestrator


class FakeReviseAgent:
    """Fake ReviseAgent that records which issues were passed to revise_local_patch."""

    def __init__(self):
        self.received_issues = []
        self.local_patch_calls = 0

    def revise_local_patch(self, original_chapter, issue, local_context, setting_bible,
                           perspective=None, perspective_strength=0.7):
        self.received_issues.append(issue)
        self.local_patch_calls += 1
        target = local_context.get("target", "")
        return {
            "target_text": target,
            "replacement_text": target + " [修复]",
            "bridge_sentence": "",
        }

    def revise_chapter(self, original_chapter, issues, setting_bible,
                       perspective=None, perspective_strength=0.7):
        return original_chapter


class TestSceneGroupedRepair(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.project_dir = Path(self.tmpdir.name)
        self.orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        self.orchestrator.output_dir = self.project_dir
        self.orchestrator.writer_perspective = None
        self.orchestrator.perspective_strength = 0.7
        self.orchestrator.setting_bible = "测试设定"
        # Initialize attributes expected by the orchestrator methods
        self.orchestrator.stitching_reports = []
        self.orchestrator.repair_traces = []
        self.fake_revise = FakeReviseAgent()
        self.orchestrator.revise = self.fake_revise

        # Sample chapter content with identifiable targets
        self.chapter_content = """第1章

场景1开头。
这是scene-1的目标文本A。
场景1继续。
这是scene-1的目标文本B。
场景1更多内容。
这是scene-1的目标文本C。

场景2开始。
这是scene-2的目标文本D。
场景2结束。
"""

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_issues_grouped_by_scene_id_before_repair(self):
        """Test that issues are correctly grouped by scene_id and passed to repair."""
        issues = [
            {"scene_id": "scene-1", "issue_type": "style_match",
             "evidence_span": {"quote": "目标文本A"}, "fix_instruction": "修复1"},
            {"scene_id": "scene-1", "issue_type": "plot_progress",
             "evidence_span": {"quote": "目标文本B"}, "fix_instruction": "修复2"},
            {"scene_id": "scene-2", "issue_type": "character_consistency",
             "evidence_span": {"quote": "目标文本D"}, "fix_instruction": "修复3"},
        ]

        self.orchestrator._apply_repair_batch(
            chapter_index=1,
            current_content=self.chapter_content,
            issues=issues,
            chapter_outline="大纲",
            revise_round=1,
        )

        # Verify all 3 issues were attempted (2 from scene-1, 1 from scene-2)
        self.assertEqual(len(self.fake_revise.received_issues), 3)

        # Verify scene grouping by checking which scene_ids are present in received issues
        scene_ids_in_repair = [
            issue.get("scene_id") for issue in self.fake_revise.received_issues
        ]
        self.assertEqual(scene_ids_in_repair.count("scene-1"), 2)
        self.assertEqual(scene_ids_in_repair.count("scene-2"), 1)

    def test_max_two_issues_per_scene_limit(self):
        """Each scene should only attempt repair on its top 2 issues to avoid over-modification."""
        # 4 issues all in the same scene
        issues = [
            {"scene_id": "scene-1", "evidence_span": {"quote": "目标文本A"}, "fix_instruction": "修复1"},
            {"scene_id": "scene-1", "evidence_span": {"quote": "目标文本B"}, "fix_instruction": "修复2"},
            {"scene_id": "scene-1", "evidence_span": {"quote": "目标文本C"}, "fix_instruction": "修复3"},
            {"scene_id": "scene-1", "evidence_span": {"quote": "场景1开头"}, "fix_instruction": "修复4"},
        ]

        self.orchestrator._apply_repair_batch(
            chapter_index=1,
            current_content=self.chapter_content,
            issues=issues,
            chapter_outline="大纲",
            revise_round=1,
        )

        # Only 2 issues should be attempted per scene
        self.assertEqual(len(self.fake_revise.received_issues), 2)

    def test_issues_without_scene_id_go_to_chapter_group(self):
        """Issues without scene_id should be grouped under 'chapter' default."""
        issues = [
            {"issue_type": "style_match", "evidence_span": {"quote": "第1章"}, "fix_instruction": "修复1"},
            {"issue_type": "plot_progress", "evidence_span": {"quote": "场景2开始"}, "fix_instruction": "修复2"},
        ]

        self.orchestrator._apply_repair_batch(
            chapter_index=1,
            current_content=self.chapter_content,
            issues=issues,
            chapter_outline="大纲",
            revise_round=1,
        )

        # Both issues should be attempted (under default chapter group, max 2)
        self.assertEqual(len(self.fake_revise.received_issues), 2)

    def test_high_severity_issues_are_prioritized_over_low_severity(self):
        """High severity issues should be repaired before low severity ones in the same scene."""
        # Issues in same scene with different severities - low severity comes first in list
        issues = [
            {"scene_id": "scene-1", "severity": "low",
             "evidence_span": {"quote": "目标文本A"}, "fix_instruction": "低优先级"},
            {"scene_id": "scene-1", "severity": "high",
             "evidence_span": {"quote": "目标文本B"}, "fix_instruction": "高优先级"},
            {"scene_id": "scene-1", "severity": "medium",
             "evidence_span": {"quote": "目标文本C"}, "fix_instruction": "中优先级"},
        ]

        self.orchestrator._apply_repair_batch(
            chapter_index=1,
            current_content=self.chapter_content,
            issues=issues,
            chapter_outline="大纲",
            revise_round=1,
        )

        # Only 2 issues attempted per scene
        self.assertEqual(len(self.fake_revise.received_issues), 2)

        # The high and medium severity issues should be repaired, NOT the low one
        severities_repaired = [
            issue.get("severity") for issue in self.fake_revise.received_issues
        ]
        self.assertIn("high", severities_repaired)
        self.assertIn("medium", severities_repaired)
        self.assertNotIn("low", severities_repaired)

    def test_default_severity_is_medium(self):
        """Issues without explicit severity should default to medium priority."""
        issues = [
            {"scene_id": "scene-1", "severity": "low",
             "evidence_span": {"quote": "目标文本A"}, "fix_instruction": "低优先级"},
            {"scene_id": "scene-1",  # No severity specified
             "evidence_span": {"quote": "目标文本B"}, "fix_instruction": "默认优先级"},
            {"scene_id": "scene-1", "severity": "high",
             "evidence_span": {"quote": "目标文本C"}, "fix_instruction": "高优先级"},
        ]

        self.orchestrator._apply_repair_batch(
            chapter_index=1,
            current_content=self.chapter_content,
            issues=issues,
            chapter_outline="大纲",
            revise_round=1,
        )

        # Only 2 issues attempted per scene
        self.assertEqual(len(self.fake_revise.received_issues), 2)

        # The high and default (medium) issues should be repaired
        severities_repaired = [
            issue.get("severity") for issue in self.fake_revise.received_issues
        ]
        self.assertIn("high", severities_repaired)
        # The default one has no severity key, so None should be present
        # which means the low one should NOT be present
        self.assertNotIn("low", severities_repaired)

    def test_issues_across_multiple_scenes_respect_both_grouping_and_sorting(self):
        """Verify grouping and sorting work together across multiple scenes."""
        issues = [
            # Scene 1: low first, then high
            {"scene_id": "scene-1", "severity": "low",
             "evidence_span": {"quote": "目标文本A"}, "fix_instruction": "s1低"},
            {"scene_id": "scene-1", "severity": "high",
             "evidence_span": {"quote": "目标文本B"}, "fix_instruction": "s1高"},
            # Scene 2: high first, then low, then medium
            {"scene_id": "scene-2", "severity": "high",
             "evidence_span": {"quote": "目标文本D"}, "fix_instruction": "s2高"},
            {"scene_id": "scene-2", "severity": "low",
             "evidence_span": {"quote": "场景2开始"}, "fix_instruction": "s2低"},
            {"scene_id": "scene-2", "severity": "medium",
             "evidence_span": {"quote": "场景2结束"}, "fix_instruction": "s2中"},
        ]

        self.orchestrator._apply_repair_batch(
            chapter_index=1,
            current_content=self.chapter_content,
            issues=issues,
            chapter_outline="大纲",
            revise_round=1,
        )

        # 2 per scene = 4 total
        self.assertEqual(len(self.fake_revise.received_issues), 4)

        # Count by scene
        scene_1_count = sum(
            1 for issue in self.fake_revise.received_issues
            if issue.get("scene_id") == "scene-1"
        )
        scene_2_count = sum(
            1 for issue in self.fake_revise.received_issues
            if issue.get("scene_id") == "scene-2"
        )
        self.assertEqual(scene_1_count, 2)
        self.assertEqual(scene_2_count, 2)

        # Scene 1: high and default(medium) should be present, low should NOT
        s1_severities = [
            issue.get("severity") for issue in self.fake_revise.received_issues
            if issue.get("scene_id") == "scene-1"
        ]
        self.assertIn("high", s1_severities)
        self.assertIn("low", s1_severities)  # only 2 issues total in scene-1, both get in

        # Scene 2: high and medium should be present, low should NOT
        s2_severities = [
            issue.get("severity") for issue in self.fake_revise.received_issues
            if issue.get("scene_id") == "scene-2"
        ]
        self.assertIn("high", s2_severities)
        self.assertIn("medium", s2_severities)
        self.assertNotIn("low", s2_severities)
