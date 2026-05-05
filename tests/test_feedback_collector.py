"""Tests for FeedbackCollector - signal normalization pipeline."""

import unittest
from backend.core.learning.feedback_collector import (
    FeedbackCollector,
    FeedbackSignal,
    SignalSource,
    SignalSeverity,
)


class FeedbackCollectorTests(unittest.TestCase):
    def setUp(self):
        self.collector = FeedbackCollector()

    def test_collect_from_critic_issues(self):
        issues = [
            {"type": "剧情问题", "severity": "high", "fix_instruction": "增强冲突张力"},
            {"type": "人物", "severity": "medium", "fix_instruction": "角色对话不自然"},
        ]
        signals = self.collector.collect_from_critic(issues, chapter_index=3)

        self.assertEqual(len(signals), 2)
        self.assertEqual(signals[0].source, SignalSource.CRITIC)
        self.assertEqual(signals[0].severity, SignalSeverity.HIGH)
        self.assertEqual(signals[0].chapter_index, 3)

    def test_collect_from_critic_dimensions(self):
        signals = self.collector.collect_from_critic(
            issues=[],
            dimension_scores={"plot": 9, "character": 6, "hook": 4},
            chapter_index=1,
        )

        self.assertEqual(len(signals), 2)  # character=6 and hook=4 are < 7
        self.assertEqual(signals[0].signal_type, "low_character_score")
        self.assertEqual(signals[1].signal_type, "low_hook_score")
        self.assertEqual(signals[1].severity, SignalSeverity.HIGH)  # 4 < 5

    def test_is_actionable_filters_low_severity(self):
        low = FeedbackSignal(
            source=SignalSource.GUARDIAN,
            signal_type="guardrail_warning",
            severity=SignalSeverity.LOW,
            chapter_index=1,
            description="test",
        )
        high = FeedbackSignal(
            source=SignalSource.CRITIC,
            signal_type="plot_issue",
            severity=SignalSeverity.HIGH,
            chapter_index=1,
            description="test",
        )
        self.assertFalse(low.is_actionable)
        self.assertTrue(high.is_actionable)

    def test_type_mapping_normalizes_names(self):
        issues = [
            {"type": "rhythm_continuity", "severity": "medium"},
            {"type": "style_match", "severity": "low"},
            {"type": "worldview_conflict", "severity": "high"},
        ]
        signals = self.collector.collect_from_critic(issues, chapter_index=1)

        self.assertEqual(signals[0].signal_type, "pacing_issue")
        self.assertEqual(signals[1].signal_type, "style_issue")
        self.assertEqual(signals[2].signal_type, "worldview_conflict")

    def test_evidence_extraction_from_evidence_span_dict(self):
        issues = [
            {
                "type": "plot_hole",
                "severity": "high",
                "evidence_span": {"quote": "主角突然会飞了", "offset": 100},
            }
        ]
        signals = self.collector.collect_from_critic(issues, chapter_index=1)

        self.assertIn("主角突然会飞了", signals[0].evidence)

    def test_evidence_fallback_to_location(self):
        issues = [
            {"type": "pacing_issue", "severity": "medium", "location": "第三段节奏过快"}
        ]
        signals = self.collector.collect_from_critic(issues, chapter_index=1)

        self.assertEqual(signals[0].evidence, "第三段节奏过快")

    def test_guardrail_warnings_as_strings(self):
        class FakeGuardrail:
            warnings = ["字数偏差超过30%"]
            violations = []
            suggestions = []

        signals = self.collector.collect_from_guardian(FakeGuardrail(), chapter_index=1)

        self.assertEqual(len(signals), 1)
        self.assertEqual(signals[0].source, SignalSource.GUARDIAN)
        self.assertEqual(signals[0].severity, SignalSeverity.LOW)

    def test_guardrail_violations_as_dicts(self):
        class FakeGuardrail:
            warnings = []
            violations = [
                {"type": "protagonist_missing", "message": "主角未在本章出现", "code": "G-07"}
            ]
            suggestions = []

        signals = self.collector.collect_from_guardian(FakeGuardrail(), chapter_index=1)

        self.assertEqual(len(signals), 1)
        self.assertEqual(signals[0].severity, SignalSeverity.HIGH)
        self.assertEqual(signals[0].meta.get("code"), "G-07")


if __name__ == "__main__":
    unittest.main()
