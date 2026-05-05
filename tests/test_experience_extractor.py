"""Tests for ExperienceExtractor - structured writing experience extraction."""

import unittest
from unittest.mock import patch, MagicMock
from backend.core.learning.experience_extractor import (
    ExperienceExtractor,
    WritingExperience,
)


class WritingExperienceTests(unittest.TestCase):
    """WritingExperience dataclass tests."""

    def test_default_fields(self):
        exp = WritingExperience(
            problem_type="character_inconsistency",
            description="角色林舟对话不一致",
            root_cause="忽略角色设定",
            suggestion="保持短句风格",
        )
        self.assertEqual(exp.problem_type, "character_inconsistency")
        self.assertEqual(exp.evidence, "")
        self.assertEqual(exp.related_characters, [])
        self.assertEqual(exp.confidence, 0.0)
        self.assertEqual(exp.source_chapters, [])

    def test_full_construction(self):
        exp = WritingExperience(
            problem_type="style_issue",
            description="文风不统一",
            root_cause="切换了写作视角",
            suggestion="统一使用第三人称有限视角",
            evidence="第3段突然切换到上帝视角",
            related_characters=["林舟"],
            confidence=0.85,
            source_chapters=[1, 2, 3],
        )
        self.assertEqual(len(exp.related_characters), 1)
        self.assertAlmostEqual(exp.confidence, 0.85)
        self.assertEqual(exp.source_chapters, [1, 2, 3])


class TestFormatCritique(unittest.TestCase):
    """Tests for _format_critique method."""

    def setUp(self):
        self.extractor = ExperienceExtractor()

    def test_format_critique_none(self):
        result = self.extractor._format_critique(None)
        self.assertEqual(result, "无")

    def test_format_critique_empty_dict(self):
        result = self.extractor._format_critique({})
        self.assertEqual(result, "无")

    def test_format_critique_with_score(self):
        result = self.extractor._format_critique({"score": 7.5})
        self.assertIn("综合评分: 7.5/10", result)

    def test_format_critique_with_overall_score(self):
        result = self.extractor._format_critique({"overall_score": 6.0})
        self.assertIn("综合评分: 6.0/10", result)

    def test_format_critique_with_dimensions(self):
        report = {"score": 8, "dimensions": {"plot": 9, "character": 6, "hook": 4}}
        result = self.extractor._format_critique(report)
        self.assertIn("维度评分:", result)
        self.assertIn("plot: 9/10", result)
        self.assertIn("character: 6/10", result)

    def test_format_critique_with_dimension_scores(self):
        report = {"score": 7, "dimension_scores": {"plot": 8, "character": 5}}
        result = self.extractor._format_critique(report)
        self.assertIn("维度评分:", result)
        self.assertIn("plot: 8/10", result)

    def test_format_critique_with_issues(self):
        report = {
            "score": 6,
            "issues": [
                {"type": "剧情问题", "severity": "high", "fix_instruction": "增强冲突张力"},
                {"type": "人物", "severity": "medium", "fix_instruction": "角色对话不自然"},
            ],
        }
        result = self.extractor._format_critique(report)
        self.assertIn("发现 2 个问题", result)
        self.assertIn("[high] 剧情问题: 增强冲突张力", result)
        self.assertIn("[medium] 人物: 角色对话不自然", result)

    def test_format_critique_caps_issues_at_10(self):
        issues = [
            {"type": f"issue_{i}", "severity": "low"}
            for i in range(15)
        ]
        report = {"score": 5, "issues": issues}
        result = self.extractor._format_critique(report)
        self.assertIn("发现 15 个问题", result)

    def test_format_critique_issue_without_description(self):
        report = {
            "score": 6,
            "issues": [{"type": "plot_hole", "severity": "high"}],
        }
        result = self.extractor._format_critique(report)
        self.assertIn("[high] plot_hole", result)


class TestFormatGuardrail(unittest.TestCase):
    """Tests for _format_guardrail method."""

    def setUp(self):
        self.extractor = ExperienceExtractor()

    def test_format_guardrail_none(self):
        result = self.extractor._format_guardrail(None)
        self.assertEqual(result, "无")

    def test_format_guardrail_string_warnings(self):
        class FakeGuardrail:
            warnings = ["字数偏差超过30%"]
            violations = []

        result = self.extractor._format_guardrail(FakeGuardrail())
        self.assertIn("[警告] 字数偏差超过30%", result)

    def test_format_guardrail_dict_violations(self):
        class FakeGuardrail:
            warnings = []
            violations = [
                {"type": "protagonist_missing", "message": "主角未在本章出现"}
            ]

        result = self.extractor._format_guardrail(FakeGuardrail())
        self.assertIn("[违规] 主角未在本章出现", result)

    def test_format_guardrail_dict_format(self):
        result = self.extractor._format_guardrail({
            "warnings": [{"message": "字数偏差"}],
            "violations": [{"message": "主角缺失"}],
        })
        self.assertIn("[warnings] 字数偏差", result)
        self.assertIn("[violations] 主角缺失", result)

    def test_format_guardrail_empty(self):
        class FakeGuardrail:
            warnings = []
            violations = []

        result = self.extractor._format_guardrail(FakeGuardrail())
        self.assertEqual(result, "无")


class TestParseOutput(unittest.TestCase):
    """Tests for _parse_output method."""

    def setUp(self):
        self.extractor = ExperienceExtractor()

    def test_parse_valid_json(self):
        raw = '{"experiences": [{"problem_type": "pacing_issue", "description": "节奏太快", "root_cause": "过渡章节太少", "suggestion": "增加过渡段", "confidence": 0.8}]}'
        results = self.extractor._parse_output(raw, chapter_index=3)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].problem_type, "pacing_issue")
        self.assertEqual(results[0].description, "节奏太快")
        self.assertAlmostEqual(results[0].confidence, 0.8)
        self.assertEqual(results[0].source_chapters, [3])

    def test_parse_json_with_markdown_fence(self):
        raw = '```json\n{"experiences": [{"problem_type": "style_issue", "description": "风格不统一", "root_cause": "mixed", "suggestion": "unify"}]}\n```'
        results = self.extractor._parse_output(raw, chapter_index=1)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].problem_type, "style_issue")

    def test_parse_empty_experiences(self):
        raw = '{"experiences": []}'
        results = self.extractor._parse_output(raw, chapter_index=1)
        self.assertEqual(results, [])

    def test_parse_invalid_json_returns_empty(self):
        raw = "not json at all"
        results = self.extractor._parse_output(raw, chapter_index=1)
        self.assertEqual(results, [])

    def test_parse_non_dict_returns_empty(self):
        raw = '["not a dict"]'
        results = self.extractor._parse_output(raw, chapter_index=1)
        self.assertEqual(results, [])

    def test_parse_partial_experience_fills_defaults(self):
        raw = '{"experiences": [{"problem_type": "plot_hole"}]}'
        results = self.extractor._parse_output(raw, chapter_index=2)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].description, "")
        self.assertEqual(results[0].related_characters, [])
        self.assertEqual(results[0].source_chapters, [2])

    def test_parse_clamps_confidence(self):
        raw = '{"experiences": [{"problem_type": "x", "description": "d", "root_cause": "r", "suggestion": "s", "confidence": 2.5}]}'
        results = self.extractor._parse_output(raw, chapter_index=1)
        self.assertAlmostEqual(results[0].confidence, 1.0)

    def test_parse_negative_confidence(self):
        raw = '{"experiences": [{"problem_type": "x", "description": "d", "root_cause": "r", "suggestion": "s", "confidence": -0.5}]}'
        results = self.extractor._parse_output(raw, chapter_index=1)
        self.assertAlmostEqual(results[0].confidence, 0.0)

    def test_parse_truncates_long_evidence(self):
        evidence = "x" * 1000
        raw = f'{{"experiences": [{{"problem_type": "x", "description": "d", "root_cause": "r", "suggestion": "s", "evidence": "{evidence}"}}]}}'
        results = self.extractor._parse_output(raw, chapter_index=1)
        self.assertLessEqual(len(results[0].evidence), 500)


class TestExtractMethod(unittest.TestCase):
    """Tests for the extract() method with mocked LLM."""

    def setUp(self):
        self.extractor = ExperienceExtractor()

    @patch("backend.core.learning.experience_extractor.call_volc_api")
    def test_extract_success(self, mock_call):
        mock_call.return_value = (
            '{"experiences": [{"problem_type": "pacing_issue", "description": "节奏过快", '
            '"root_cause": "缺少过渡", "suggestion": "加一段过渡", "confidence": 0.75}]}'
        )

        results = self.extractor.extract(
            chapter_index=3,
            critique_report={"score": 6.5, "issues": [{"type": "pacing", "severity": "high"}]},
            chapter_outline="第3章大纲",
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].problem_type, "pacing_issue")
        # Verify LLM was called with correct params
        mock_call.assert_called_once()
        args, kwargs = mock_call.call_args
        self.assertEqual(kwargs["agent_role"], "experience_extractor")
        self.assertAlmostEqual(kwargs["temperature"], 0.3)

    @patch("backend.core.learning.experience_extractor.call_volc_api")
    def test_extract_llm_failure_returns_empty(self, mock_call):
        mock_call.side_effect = RuntimeError("API call failed")

        results = self.extractor.extract(
            chapter_index=1,
            critique_report={"score": 5.0},
        )

        self.assertEqual(results, [])

    @patch("backend.core.learning.experience_extractor.call_volc_api")
    def test_extract_parsing_failure_returns_empty(self, mock_call):
        mock_call.return_value = "not valid json"

        results = self.extractor.extract(
            chapter_index=1,
            critique_report={"score": 5.0},
        )

        self.assertEqual(results, [])

    @patch("backend.core.learning.experience_extractor.call_volc_api")
    def test_extract_calls_llm_with_prompt_context(self, mock_call):
        mock_call.return_value = '{"experiences": []}'

        self.extractor.extract(
            chapter_index=5,
            critique_report={"score": 7.0},
            guardrail_results=None,
            user_feedback="角色对话不自然",
            chapter_outline="第5章大纲",
        )

        args, kwargs = mock_call.call_args
        context = kwargs["context"]
        self.assertEqual(context["chapter_index"], "5")
        self.assertIn("综合评分: 7.0/10", context["critique_report"])
        self.assertEqual(context["user_feedback"], "角色对话不自然")
        self.assertEqual(context["chapter_outline"], "第5章大纲")


if __name__ == "__main__":
    unittest.main()
