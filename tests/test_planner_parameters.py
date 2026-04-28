#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tests for Planner Agent parameter consistency.
TDD: Verify that all placeholders in planner.md prompt are correctly
populated by the context dictionary built in planner_agent.py.
"""

import unittest
import re
from pathlib import Path
from unittest.mock import patch, MagicMock


class TestPlannerParameterConsistency(unittest.TestCase):
    """Test that Planner context keys match prompt placeholders exactly."""

    def setUp(self):
        """Load the planner prompt file and extract all placeholders."""
        project_root = Path(__file__).parent.parent
        self.prompt_path = project_root / "prompts" / "planner.md"
        self.assertTrue(self.prompt_path.exists(), f"Prompt file not found: {self.prompt_path}")

        with open(self.prompt_path, "r", encoding="utf-8") as f:
            self.prompt_content = f.read()

        # Extract all {{placeholder}} patterns, excluding skill_layer
        all_placeholders = re.findall(r"\{\{([^{}]+)\}\}", self.prompt_content)
        self.prompt_placeholders = set(
            ph.strip() for ph in all_placeholders
            if ph.strip() != "skill_layer"
        )

    def test_prompt_has_expected_placeholders(self):
        """Prompt should contain the documented placeholders."""
        expected_placeholders = {
            "content_type",
            "user_requirements",
            "platform",
            "target_words",
            "core_hook",
            "chapter_word_count",
        }
        # target_duration is optional (script mode only)
        for ph in expected_placeholders:
            self.assertIn(ph, self.prompt_placeholders,
                         f"Expected placeholder {{.{ph}.}} not found in prompt")

    def test_generate_plan_context_contains_all_required_keys(self):
        """generate_plan() should build context with all required keys."""
        from backend.agents.planner_agent import generate_plan

        with patch("backend.agents.planner_agent.call_volc_api") as mock_call:
            mock_call.return_value = "test result"

            # Call generate_plan with sample parameters
            generate_plan(
                core_requirement="写一个关于时间旅行的故事",
                target_platform="番茄",
                chapter_word_count="2000",
                content_type="novel",
                total_words="100000",
                core_hook="主角可以看到10秒后的未来",
            )

            # Verify the context passed to call_volc_api
            call_args = mock_call.call_args
            context = call_args[1].get("context", {})

            # Required keys (must exist)
            required_keys = ["content_type", "user_requirements",
                           "platform", "target_words",
                           "core_hook", "chapter_word_count"]

            for key in required_keys:
                self.assertIn(key, context,
                             f"Required key '{key}' missing from context")

            # Verify values
            self.assertEqual(context["content_type"], "novel")
            self.assertEqual(context["user_requirements"], "写一个关于时间旅行的故事")
            self.assertEqual(context["platform"], "番茄")
            self.assertEqual(context["target_words"], "100000")
            self.assertEqual(context["core_hook"], "主角可以看到10秒后的未来")
            self.assertEqual(context["chapter_word_count"], "2000")

            # Should NOT contain these (unused in prompt)
            self.assertNotIn("world_bible", context,
                            "context should not contain unused key 'world_bible'")
            self.assertNotIn("genre", context,
                            "context should not contain unused key 'genre'")

    def test_context_keys_match_prompt_placeholders(self):
        """All context keys should match placeholders in prompt, no extras."""
        from backend.agents.planner_agent import generate_plan

        with patch("backend.agents.planner_agent.call_volc_api") as mock_call:
            mock_call.return_value = "test result"

            generate_plan(
                core_requirement="test requirement",
                target_platform="测试平台",
                chapter_word_count="2000",
                content_type="novel",
                total_words="100000",
                core_hook="test hook",
            )

            call_args = mock_call.call_args
            context = call_args[1].get("context", {})
            context_keys = set(context.keys())

            # Check that every context key exists in the prompt
            for key in context_keys:
                self.assertIn(key, self.prompt_placeholders,
                             f"Context key '{key}' not found in prompt placeholders")

    def test_optional_parameters_handle_none(self):
        """generate_plan should handle optional parameters being None/empty."""
        from backend.agents.planner_agent import generate_plan

        with patch("backend.agents.planner_agent.call_volc_api") as mock_call:
            mock_call.return_value = "test result"

            # Call without optional parameters
            generate_plan(
                core_requirement="test requirement",
                target_platform="",  # Empty
                chapter_word_count="2000",
                content_type="short_story",
                total_words="",  # Empty
                core_hook="",  # Empty
            )

            call_args = mock_call.call_args
            context = call_args[1].get("context", {})

            # Required keys should always exist, even if empty
            self.assertEqual(context["content_type"], "short_story")
            self.assertEqual(context["user_requirements"], "test requirement")
            self.assertEqual(context["chapter_word_count"], "2000")
            # Optional keys should NOT be in context if empty
            self.assertNotIn("platform", context)
            self.assertNotIn("target_words", context)
            self.assertNotIn("core_hook", context)

    def test_placeholder_replacement_in_load_prompt(self):
        """Verify load_prompt correctly replaces all placeholders."""
        from backend.utils.file_utils import load_prompt

        # Test with all placeholders populated (including optional)
        context = {
            "content_type": "script",
            "user_requirements": "写一个关于时间旅行的故事",
            "platform": "番茄",
            "target_words": "100000",
            "target_duration": "90分钟",  # 剧本模式专用
            "core_hook": "主角可以看到10秒后的未来",
            "chapter_word_count": "2000",
        }

        result = load_prompt("planner", context=context)

        # No {{...}} placeholders should remain (except skill_layer)
        remaining = re.findall(r"\{\{([^{}]+)\}\}", result)
        remaining = [ph for ph in remaining if ph.strip() != "skill_layer"]
        self.assertEqual(len(remaining), 0,
                        f"Unreplaced placeholders found: {remaining}")

    def test_revise_plan_does_not_need_context(self):
        """revise_plan doesn't use placeholders in its prompt, so no context needed."""
        from backend.agents.planner_agent import revise_plan

        with patch("backend.agents.planner_agent.call_volc_api") as mock_call:
            mock_call.return_value = "revised plan"

            revise_plan(
                original_plan="original plan content",
                feedback="需要更多悬念",
                original_requirement="核心需求",
            )

            # This should just work without errors
            self.assertTrue(mock_call.called)


if __name__ == "__main__":
    unittest.main()
