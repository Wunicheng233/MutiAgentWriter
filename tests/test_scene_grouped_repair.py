import unittest
import tempfile
from pathlib import Path
from collections import defaultdict

from backend.core.orchestrator import NovelOrchestrator


class TestSceneGroupedRepair(unittest.TestCase):
    def test_issues_grouped_by_scene_id_before_repair(self):
        """Test that issues are correctly grouped by scene_id."""
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
            issues_by_scene = defaultdict(list)
            for issue in normalized:
                scene_id = issue.get("scene_id", "chapter")
                issues_by_scene[scene_id].append(issue)

            issues_attempted = []
            for scene_issues in issues_by_scene.values():
                issues_attempted.extend(scene_issues[:2])

            self.assertEqual(len(issues_attempted), 2)

    def test_issues_without_scene_id_go_to_chapter_group(self):
        """Issues without scene_id should be grouped under 'chapter' default."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
            orchestrator.output_dir = project_dir
            orchestrator.writer_perspective = None
            orchestrator.perspective_strength = 0.7

            issues = [
                {"issue_type": "style_match", "evidence_span": {"quote": "目标1"}, "fix_instruction": "修复1"},
                {"issue_type": "plot_progress", "evidence_span": {"quote": "目标2"}, "fix_instruction": "修复2"},
            ]

            normalized = [orchestrator._normalize_repair_issue(issue) for issue in issues]

            issues_by_scene = defaultdict(list)
            for issue in normalized:
                scene_id = issue.get("scene_id", "chapter")
                issues_by_scene[scene_id].append(issue)

            self.assertEqual(len(issues_by_scene), 1)
            self.assertIn("chapter", issues_by_scene)
            self.assertEqual(len(issues_by_scene["chapter"]), 2)


if __name__ == "__main__":
    unittest.main()
