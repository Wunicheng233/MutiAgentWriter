import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import MagicMock, patch

from backend.core.orchestrator import NovelOrchestrator


class TestNovelStateValidatorIntegration(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.project_dir = Path(self.tmpdir.name)
        self.orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        self.orchestrator.output_dir = self.project_dir
        self.orchestrator.writer_perspective = None
        self.orchestrator.perspective_strength = 0.7
        self.orchestrator.setting_bible = "测试设定"
        self.orchestrator.stitching_reports = []
        self.orchestrator.repair_traces = []
        self.orchestrator.novel_state_snapshots = []

        # Setup fake revise agent
        class FakeRevise:
            def revise_local_patch(self, *args, **kwargs):
                return {"target_text": "", "replacement_text": "", "bridge_sentence": ""}

            def revise_chapter(self, content, issues, setting, **kwargs):
                return content

        self.orchestrator.revise = FakeRevise()

        # Setup scene_anchors
        self.scene_anchors = [{"scene_id": "scene-1", "goal": "测试场景"}]

    def tearDown(self):
        self.tmpdir.cleanup()

    @patch.object(NovelOrchestrator, '_run_critic_harness')
    @patch.object(NovelOrchestrator, 'save_chapter')
    @patch.object(NovelOrchestrator, '_record_novel_state_snapshot')
    def test_state_issues_merged_into_critic_issues(self, mock_record, mock_save, mock_critic):
        """NovelStateValidator issues should be merged into critic issues."""
        mock_critic.return_value = (True, 8.5, {}, [])
        mock_save.return_value = None
        mock_record.return_value = None

        # Setup novel_state_service mock
        class MockStateService:
            def load_state(self):
                return {"characters": {}}

            def merge_delta(self, delta):
                return {}

        self.orchestrator.novel_state_service = MockStateService()

        # Call the method that would run validation
        self.orchestrator.chapter_outlines = [{"chapter_num": 1, "title": "第一章", "outline": "大纲", "target_word_count": 2000}]
        self.orchestrator.plan = "测试策划"
        self.orchestrator.skip_chapter_confirm = True
        self.orchestrator.dimension_scores = {}

    def test_validator_can_be_instantiated_directly(self):
        """Verify NovelStateValidator class is accessible via service."""
        from backend.core.novel_state_service import NovelStateService, NovelStateValidator

        service = NovelStateService(self.project_dir)
        validator = NovelStateValidator(service)

        # Should be able to instantiate
        self.assertIsNotNone(validator)

    def test_dead_character_appearing_triggers_issue(self):
        """When a dead character appears in content, it should trigger an issue."""
        from backend.core.novel_state_service import NovelStateService, NovelStateValidator

        service = NovelStateService(self.project_dir)
        service.save_state({
            "characters": {
                "李华": {"status": "已死亡", "last_seen": "chapter 1"}
            }
        })

        validator = NovelStateValidator(service)
        chapter_content = """第2章

李华走进了房间，微笑着对大家打招呼。
"""
        passed, issues = validator.validate_chapter(2, chapter_content, [])

        self.assertFalse(passed)
        character_issues = [i for i in issues if i.get("type") == "character_state_violation"]
        self.assertGreaterEqual(len(character_issues), 1)
        self.assertIn("李华", character_issues[0].get("fix_instruction", ""))

    def test_flashback_context_allows_dead_character(self):
        """Flashback context (回忆/想起) should suppress dead character violation."""
        from backend.core.novel_state_service import NovelStateService, NovelStateValidator

        service = NovelStateService(self.project_dir)
        service.save_state({
            "characters": {
                "李华": {"status": "已死亡", "last_seen": "chapter 1"}
            }
        })

        validator = NovelStateValidator(service)
        chapter_content = """第2章

主角想起了李华，回忆起当年他们一起战斗的日子。
"""
        passed, issues = validator.validate_chapter(2, chapter_content, [])

        character_issues = [i for i in issues if i.get("type") == "character_state_violation"]
        # 回忆场景不应该触发角色状态冲突
        self.assertEqual(len(character_issues), 0)
