import tempfile
from pathlib import Path
from unittest import TestCase

from backend.core.orchestrator import NovelOrchestrator


class TestChapterConsistencyPass(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.project_dir = Path(self.tmpdir.name)
        self.orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        self.orchestrator.output_dir = self.project_dir
        self.orchestrator.novel_state_service = type(
            "MockStateService",
            (),
            {"load_state": lambda self: {}}
        )()

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_state_change_keywords_verified_in_content(self):
        """Scene state_change keywords should appear in chapter content."""
        scene_anchors = [
            {
                "scene_id": "scene-1",
                "state_change": "神秘传送门开启",
            }
        ]
        chapter_content = """第1章

战斗开始了。
主角勇敢地冲向敌人。
然后他受伤倒地。
场景结束。
"""  # "传送门" 这个关键词完全缺失

        passed, issues = self.orchestrator.run_chapter_consistency_pass(
            chapter_index=1,
            chapter_content=chapter_content,
            scene_anchors=scene_anchors,
        )

        state_issues = [i for i in issues if i["type"] == "scene_state_mismatch"]
        self.assertEqual(len(state_issues), 1)
        self.assertEqual(state_issues[0]["type"], "scene_state_mismatch")
        self.assertIn("传送门", state_issues[0]["fix"])

    def test_state_change_all_keywords_present(self):
        """All state_change keywords present should have no state_mismatch issues."""
        scene_anchors = [
            {
                "scene_id": "scene-1",
                "state_change": "主角受伤倒地昏迷",
            }
        ]
        chapter_content = """第1章

战斗开始了。
主角勇敢地冲向敌人。
然后他受伤倒地昏迷。
他转过身，看到了那个让他毕生难忘的景象。
"""

        passed, issues = self.orchestrator.run_chapter_consistency_pass(
            chapter_index=1,
            chapter_content=chapter_content,
            scene_anchors=scene_anchors,
        )

        state_issues = [i for i in issues if i["type"] == "scene_state_mismatch"]
        self.assertEqual(len(state_issues), 0)

    def test_weak_hook_detection(self):
        """Very short last line should trigger weak_hook warning."""
        scene_anchors = []
        chapter_content = """第1章

这是第一章的内容。
有很多描写。
完
"""  # 最后一行只有1字

        passed, issues = self.orchestrator.run_chapter_consistency_pass(
            chapter_index=1,
            chapter_content=chapter_content,
            scene_anchors=scene_anchors,
        )

        hook_issues = [i for i in issues if i["type"] == "weak_hook"]
        self.assertEqual(len(hook_issues), 1)
        self.assertEqual(hook_issues[0]["severity"], "low")

    def test_proper_hook_length_passes(self):
        """Reasonable length last line should not trigger weak_hook."""
        scene_anchors = []
        chapter_content = """第1章

这是第一章的内容。
有很多描写。
他转过身，看到了那个让他毕生难忘的景象。
"""  # 最后一行有足够长度

        passed, issues = self.orchestrator.run_chapter_consistency_pass(
            chapter_index=1,
            chapter_content=chapter_content,
            scene_anchors=scene_anchors,
        )

        hook_issues = [i for i in issues if i["type"] == "weak_hook"]
        self.assertEqual(len(hook_issues), 0)

    def test_multiple_issues_from_multiple_scenes(self):
        """Multiple scenes with missing state_changes should produce multiple issues."""
        scene_anchors = [
            {
                "scene_id": "scene-1",
                "state_change": "获得神秘钥匙",
            },
            {
                "scene_id": "scene-2",
                "state_change": "发现隐藏密室",
            }
        ]
        chapter_content = """第1章

场景1开始。
主角在房间里搜索。
他找到了。
场景2开始。
他继续探索。
"""  # 两个场景的 state_change 都缺失关键词

        passed, issues = self.orchestrator.run_chapter_consistency_pass(
            chapter_index=1,
            chapter_content=chapter_content,
            scene_anchors=scene_anchors,
        )

        self.assertFalse(passed)
        # 每个场景至少有一个关键词缺失
        self.assertGreaterEqual(len(issues), 2)
        scene_ids = [i.get("scene_id") for i in issues]
        self.assertIn("scene-1", scene_ids)
        self.assertIn("scene-2", scene_ids)

    def test_empty_state_change_ignored(self):
        """Empty or very short state_change should be skipped."""
        scene_anchors = [
            {
                "scene_id": "scene-1",
                "state_change": "",  # 空字符串
            },
            {
                "scene_id": "scene-2",
                "state_change": "是",  # 太短
            }
        ]
        chapter_content = """第1章

内容。
"""

        passed, issues = self.orchestrator.run_chapter_consistency_pass(
            chapter_index=1,
            chapter_content=chapter_content,
            scene_anchors=scene_anchors,
        )

        # 不应该有 state_mismatch 问题（state_change太短被跳过）
        state_issues = [i for i in issues if i["type"] == "scene_state_mismatch"]
        self.assertEqual(len(state_issues), 0)
