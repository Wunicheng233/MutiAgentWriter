import tempfile
import unittest
from pathlib import Path

import config
from core.worldview_manager import WorldviewManager
from utils import vector_db
from utils.runtime_context import (
    RunContext,
    get_current_run_context_optional,
    set_current_output_dir,
    use_output_dir,
    use_run_context,
)


class RuntimeContextIsolationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp_dir.name)
        self.original_output_dir = config.CURRENT_OUTPUT_DIR

    def tearDown(self):
        set_current_output_dir(self.original_output_dir)
        self.temp_dir.cleanup()

    def test_vector_collection_names_follow_current_output_dir_dynamically(self):
        config.CURRENT_OUTPUT_DIR = None
        self.assertEqual(vector_db._get_current_chapter_collection_name(), "novel_chapter_content_default")
        self.assertEqual(vector_db._get_current_setting_collection_name(), "novel_world_setting_default")

        config.CURRENT_OUTPUT_DIR = self.workspace / "project-a"
        self.assertEqual(vector_db._get_current_chapter_collection_name(), "chapters_project-a")
        self.assertEqual(vector_db._get_current_setting_collection_name(), "settings_project-a")

        config.CURRENT_OUTPUT_DIR = self.workspace / "project-b"
        self.assertEqual(vector_db._get_current_chapter_collection_name(), "chapters_project-b")
        self.assertEqual(vector_db._get_current_setting_collection_name(), "settings_project-b")

    def test_worldview_reset_uses_current_project_path_without_mutating_default_state(self):
        project_a = self.workspace / "project-a"
        project_b = self.workspace / "project-b"
        project_a.mkdir()
        project_b.mkdir()

        config.CURRENT_OUTPUT_DIR = project_a
        manager = WorldviewManager()
        self.assertEqual(manager.file_path, project_a / "worldview_state.json")

        manager.add_character("hero", {"name": "主角"})
        self.assertIn("hero", manager.state["characters"])

        config.CURRENT_OUTPUT_DIR = project_b
        manager.reset_worldview()

        self.assertEqual(manager.file_path, project_b / "worldview_state.json")
        self.assertEqual(manager.state["characters"], {})
        self.assertTrue((project_b / "worldview_state.json").exists())

    def test_output_dir_context_manager_isolates_current_project_path(self):
        project_a = self.workspace / "project-a"
        project_b = self.workspace / "project-b"

        set_current_output_dir(project_a)
        self.assertEqual(vector_db._get_current_chapter_collection_name(), "chapters_project-a")

        with use_output_dir(project_b):
            self.assertEqual(config.CURRENT_OUTPUT_DIR, project_b)
            self.assertEqual(vector_db._get_current_chapter_collection_name(), "chapters_project-b")

        self.assertEqual(config.CURRENT_OUTPUT_DIR, project_a)
        self.assertEqual(vector_db._get_current_chapter_collection_name(), "chapters_project-a")

    def test_run_context_tracks_structured_generation_metadata(self):
        project_a = self.workspace / "project-a"
        project_b = self.workspace / "project-b"
        set_current_output_dir(project_a)

        run_context = RunContext(
            project_id=11,
            project_path=project_b,
            generation_task_id=22,
            celery_task_id="celery-22",
            workflow_run_id=33,
            user_id=44,
        )

        with use_run_context(run_context):
            self.assertEqual(config.CURRENT_OUTPUT_DIR, project_b)
            self.assertEqual(vector_db._get_current_chapter_collection_name(), "chapters_project-b")
            current_context = get_current_run_context_optional()
            self.assertEqual(current_context.project_id, 11)
            self.assertEqual(current_context.generation_task_id, 22)
            self.assertEqual(current_context.workflow_run_id, 33)

        self.assertEqual(config.CURRENT_OUTPUT_DIR, project_a)
        self.assertIsNone(get_current_run_context_optional())


if __name__ == "__main__":
    unittest.main()
