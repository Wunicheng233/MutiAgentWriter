import unittest

from core.evaluation_harness import (
    build_chapter_evaluation_report,
    evaluate_chapter_with_critic,
    normalize_dimensions,
)


class EvaluationHarnessTests(unittest.TestCase):
    def test_normalize_dimensions_clamps_known_dimensions_and_fills_defaults(self):
        dimensions = normalize_dimensions(
            {
                "plot": 12,
                "character": "bad",
                "hook": 0,
                "unknown": 10,
            }
        )

        self.assertEqual(dimensions["plot"], 10.0)
        self.assertEqual(dimensions["character"], 5.0)
        self.assertEqual(dimensions["hook"], 1.0)
        self.assertEqual(dimensions["writing"], 5.0)
        self.assertEqual(dimensions["setting"], 5.0)
        self.assertNotIn("unknown", dimensions)

    def test_build_report_preserves_structured_issue_for_harness_and_legacy_callers(self):
        report = build_chapter_evaluation_report(
            chapter_index=3,
            passed=False,
            score=11,
            dimensions={"plot": 8},
            issues=[
                {
                    "type": "剧情问题",
                    "location": "中段",
                    "fix": "增强冲突",
                    "severity": "high",
                }
            ],
            content_type="novel",
            revision_round=2,
        )

        self.assertFalse(report.passed)
        self.assertEqual(report.score, 10.0)
        self.assertEqual(report.dimensions["plot"], 8.0)
        self.assertEqual(report.revision_round, 2)
        self.assertEqual(report.to_dict()["issues"][0]["source"], "critic")
        self.assertEqual(report.as_legacy_tuple()[3][0]["severity"], "high")

    def test_evaluate_chapter_with_critic_wraps_legacy_critic_tuple(self):
        class FakeCritic:
            def critic_chapter(self, chapter_content, setting_bible, chapter_outline, content_type):
                return True, 9, {"plot": 9, "character": 8}, []

        report = evaluate_chapter_with_critic(
            critic=FakeCritic(),
            chapter_content="章节内容",
            setting_bible="设定",
            chapter_outline="大纲",
            content_type="novel",
            chapter_index=1,
            revision_round=0,
        )

        self.assertTrue(report.passed)
        self.assertEqual(report.score, 9.0)
        self.assertEqual(report.dimensions["character"], 8.0)
        self.assertEqual(report.harness_version, "chapter-evaluation-v1")


if __name__ == "__main__":
    unittest.main()
