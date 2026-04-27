from __future__ import annotations

import json
import os
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path

from backend.core.novel_state_service import NovelStateService


class NovelStateServiceExceptionLoggingTests(unittest.TestCase):
    """Tests for novel_state_service.py exception logging fix."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.service = NovelStateService(Path(self.temp_dir))

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_load_state_logs_warning_on_json_decode_error(self):
        """Test that JSONDecodeError during load_state logs a warning."""
        # Create an invalid JSON file
        state_file = Path(self.temp_dir) / "novel_state.json"
        state_file.write_text("{ invalid json ", encoding="utf-8")

        with patch("backend.core.novel_state_service.logger.warning") as mock_warning:
            state = self.service.load_state()

            # Verify logger.warning was called
            mock_warning.assert_called_once()
            log_message = mock_warning.call_args[0][0]
            self.assertIn("加载状态文件失败", log_message)
            self.assertIn("JSONDecodeError", log_message)

            # Verify default state is still returned
            self.assertIn("characters", state)
            self.assertIn("timeline", state)

    def test_load_state_logs_warning_on_os_error(self):
        """Test that OSError during load_state logs a warning."""
        # Mock open to raise OSError
        state_file = Path(self.temp_dir) / "novel_state.json"
        state_file.touch()

        with patch("backend.core.novel_state_service.logger.warning") as mock_warning:
            with patch("builtins.open", side_effect=OSError("Permission denied")):
                state = self.service.load_state()

                # Verify logger.warning was called
                mock_warning.assert_called_once()
                log_message = mock_warning.call_args[0][0]
                self.assertIn("加载状态文件失败", log_message)
                self.assertIn("OSError", log_message)

                # Verify default state is still returned
                self.assertIn("characters", state)
                self.assertIn("timeline", state)

    def test_load_state_returns_valid_state_without_logging_on_good_file(self):
        """Test that valid JSON file loads without warning."""
        state_file = Path(self.temp_dir) / "novel_state.json"
        state_file.write_text('{"characters": {"test": "data"}}', encoding="utf-8")

        with patch("backend.core.novel_state_service.logger.warning") as mock_warning:
            state = self.service.load_state()

            # Verify logger.warning was NOT called
            mock_warning.assert_not_called()

            # Verify state was loaded correctly
            self.assertEqual(state["characters"], {"test": "data"})


class OrchestratorPrintReplacementTests(unittest.TestCase):
    """Tests for orchestrator.py print statement replacement."""

    def test_orchestrator_has_no_print_statements(self):
        """Verify that orchestrator.py contains no print statements in interactive mode."""
        orchestrator_path = Path(__file__).resolve().parents[1] / "backend" / "core" / "orchestrator.py"
        content = orchestrator_path.read_text(encoding="utf-8")
        lines = content.split("\n")

        # Find all lines with print statements that are not commented out
        print_lines = []
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            # Skip comment lines and lines with print in comments/strings
            if stripped.startswith("#"):
                continue
            # Check for print( that's not inside a string or comment
            if "print(" in line:
                # Simple heuristic - print statements that are at the start (after indent)
                # and not inside a string
                if "logger" not in line:
                    print_lines.append(f"Line {i}: {line.strip()}")

        # All print statements should have been replaced with logger.info
        self.assertEqual(
            print_lines,
            [],
            "Found print statements in orchestrator.py - replace with logger.info:\n" +
            "\n".join(print_lines)
        )


if __name__ == "__main__":
    unittest.main()
