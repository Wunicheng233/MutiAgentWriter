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
