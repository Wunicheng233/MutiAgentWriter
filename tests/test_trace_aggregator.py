"""Tests for TraceAggregator - lightweight trace aggregation layer."""

import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime

from backend.core.learning.trace_aggregator import (
    TraceAggregator,
    ChapterTrace,
)


class ChapterTraceTests(unittest.TestCase):
    """ChapterTrace dataclass property tests."""

    def test_score_from_evaluation_report(self):
        trace = ChapterTrace(chapter_index=1, evaluation_report={"score": 8.5})
        self.assertEqual(trace.score, 8.5)

    def test_score_from_overall_score(self):
        trace = ChapterTrace(chapter_index=1, evaluation_report={"overall_score": 6.0})
        self.assertEqual(trace.score, 6.0)

    def test_score_none_when_no_report(self):
        trace = ChapterTrace(chapter_index=1)
        self.assertIsNone(trace.score)

    def test_passed_from_evaluation_report(self):
        trace = ChapterTrace(chapter_index=1, evaluation_report={"passed": True})
        self.assertTrue(trace.passed)

    def test_passed_none_when_no_report(self):
        trace = ChapterTrace(chapter_index=1)
        self.assertIsNone(trace.passed)

    def test_default_flags_are_false(self):
        trace = ChapterTrace(chapter_index=1)
        self.assertFalse(trace.has_critique)
        self.assertFalse(trace.has_feedback)
        self.assertFalse(trace.has_repair)

    def test_default_collections_are_empty(self):
        trace = ChapterTrace(chapter_index=1)
        self.assertEqual(trace.repair_traces, [])
        self.assertEqual(trace.stitching_reports, [])
        self.assertEqual(trace.feedback_items, [])


class TestTraceAggregatorInternals(unittest.TestCase):
    """Test internal helper methods with mocked DB."""

    def setUp(self):
        self.mock_db = MagicMock()
        self.aggregator = TraceAggregator(self.mock_db)

    def _make_mock_artifact(
        self,
        content_text=None,
        content_json=None,
        version_number=1,
    ):
        art = MagicMock()
        art.content_text = content_text
        art.content_json = content_json
        art.version_number = version_number
        return art

    def _make_mock_feedback(
        self,
        feedback_type="user_note",
        content="test feedback",
        status="applied",
        chapter_index=1,
    ):
        item = MagicMock()
        item.id = chapter_index * 1000
        item.feedback_scope = "chapter"
        item.feedback_type = feedback_type
        item.action_type = None
        item.content = content
        item.status = status
        item.chapter_index = chapter_index
        item.project_id = 1
        item.workflow_run_id = 1
        item.created_at = datetime(2025, 1, 1)
        item.feedback_metadata = {}
        return item

    # ------------------------------------------------------------------
    # _get_latest_artifact
    # ------------------------------------------------------------------

    def test_get_latest_artifact_returns_newest_version(self):
        new = self._make_mock_artifact(content_text="v2", version_number=2)
        self.mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = new
        result = self.aggregator._get_latest_artifact(1, "chapter_draft", "chapter", 1)
        self.assertEqual(result.version_number, 2)

    def test_get_latest_artifact_returns_none_when_missing(self):
        self.mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
        result = self.aggregator._get_latest_artifact(1, "chapter_draft", "chapter", 1)
        self.assertIsNone(result)

    # ------------------------------------------------------------------
    # _get_feedback
    # ------------------------------------------------------------------

    def test_get_feedback_formats_correctly(self):
        fb = self._make_mock_feedback()
        self.mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [fb]
        results = self.aggregator._get_feedback(1, 1)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["feedback_type"], "user_note")
        self.assertEqual(results[0]["status"], "applied")
        self.assertIn("created_at", results[0])

    def test_get_feedback_empty_when_no_items(self):
        self.mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
        results = self.aggregator._get_feedback(1, 1)
        self.assertEqual(results, [])

    def test_get_latest_artifact_passes_workflow_run_id(self):
        self.mock_db.query.return_value.filter.return_value.filter.return_value.order_by.return_value \
            .first.return_value = None
        self.aggregator._get_latest_artifact(1, "chapter_draft", "chapter", 1, workflow_run_id=42)
        # Verify two filter calls: one for basic filters, one for workflow_run_id
        filters = self.mock_db.query.return_value.filter
        self.assertEqual(filters.call_count, 1)
        second_filter = filters.return_value.filter
        second_filter.assert_called_once()


class TestGetChapterTrace(unittest.TestCase):
    """Test get_chapter_trace with clean mock setup."""

    def setUp(self):
        self.mock_db = MagicMock()
        self.aggregator = TraceAggregator(self.mock_db)

    def _config_artifact(self, name, content_text=None, content_json=None):
        """Configure the nth 'first()' call on the shared mock chain."""
        art = MagicMock()
        art.content_text = content_text
        art.content_json = content_json
        return art

    def test_draft_present_rest_missing(self):
        chain = self.mock_db.query.return_value.filter.return_value.order_by.return_value
        chain.first.side_effect = [
            self._config_artifact("draft", content_text="第1章正文"),
            None, None, None, None, None, None, None,
        ]
        chain.all.return_value = []

        trace = self.aggregator.get_chapter_trace(project_id=1, chapter_index=1)

        self.assertEqual(trace.draft_text, "第1章正文")
        self.assertIsNone(trace.critique_v2)
        self.assertIsNone(trace.evaluation_report)
        self.assertFalse(trace.has_critique)
        self.assertFalse(trace.has_repair)
        self.assertFalse(trace.has_feedback)

    def test_all_artifacts_present(self):
        chain = self.mock_db.query.return_value.filter.return_value.order_by.return_value
        chain.first.side_effect = [
            self._config_artifact("draft", content_text="正文"),
            self._config_artifact("critique", content_json={"score": 7.5, "issues": []}),
            self._config_artifact("eval", content_json={"score": 7.5, "passed": True}),
            self._config_artifact("repair", content_json={"repair_type": "style"}),
            self._config_artifact("stitch", content_json={"stitches": ["s1"]}),
            self._config_artifact("snapshot", content_json={"characters": {"林舟": "受伤"}}),
            self._config_artifact("plan", content_json={"scene": "market"}),
        ]
        # Also need to handle _get_artifacts_by_type queries (calls .all() for repairs/stitches)
        # They go through the same chain but use .all() instead of .first()
        # The .all() calls interleave with .first() calls. Let's configure differently.

    def test_all_artifacts_present_separate_paths(self):
        """Each internal query uses its own mock chain, configured independently."""
        # Don't use auto-chaining; configure each sub-method call path explicitly
        mock_q = MagicMock()
        self.mock_db.query.return_value = mock_q

        draft = self._config_artifact("draft", content_text="正文")
        critique = self._config_artifact("critique", content_json={"score": 7.5})
        eval_rpt = self._config_artifact("eval", content_json={"score": 7.5})
        snapshot = self._config_artifact("snap", content_json={"characters": {}})
        plan = self._config_artifact("plan", content_json={"scene": "x"})

        # Each _get_latest_artifact call has its own filter chain
        def make_first_result(artifact):
            m = MagicMock()
            m.filter.return_value.order_by.return_value.first.return_value = artifact
            return m

        def make_all_result(artifacts):
            m = MagicMock()
            m.filter.return_value.filter.return_value.order_by.return_value.all.return_value = artifacts
            return m

        # Configure sequential query results for get_chapter_trace's 8 artifact queries
        # + 2 _get_artifacts_by_type calls, + 1 _get_feedback call = 11 total query() calls
        query_results = [
            make_first_result(draft),
            make_first_result(critique),
            make_first_result(eval_rpt),
            make_all_result([]),   # repair_traces
            make_all_result([]),   # stitching_reports
            make_first_result(snapshot),
            make_first_result(plan),
        ]
        # _get_feedback query
        fb_q = MagicMock()
        fb_q.filter.return_value.order_by.return_value.all.return_value = []
        query_results.append(fb_q)

        self.mock_db.query.side_effect = query_results

        trace = self.aggregator.get_chapter_trace(project_id=1, chapter_index=1)

        self.assertEqual(trace.draft_text, "正文")
        self.assertEqual(trace.critique_v2, {"score": 7.5})
        self.assertEqual(trace.score, 7.5)
        self.assertTrue(trace.has_critique)
        self.assertEqual(trace.repair_traces, [])

    def test_with_feedback(self):
        fb = MagicMock()
        fb.id = 1
        fb.feedback_scope = "chapter"
        fb.feedback_type = "user_note"
        fb.action_type = None
        fb.content = "write more action"
        fb.status = "applied"
        fb.chapter_index = 1
        fb.project_id = 1
        fb.workflow_run_id = None
        fb.created_at = datetime(2025, 1, 1)
        fb.feedback_metadata = {}

        mock_q = MagicMock()
        mock_q.filter.return_value.order_by.return_value.first.return_value = None
        self.mock_db.query.return_value = mock_q
        # Override feedback query path
        mock_q.filter.return_value.order_by.return_value.all.return_value = [fb]

        trace = self.aggregator.get_chapter_trace(project_id=1, chapter_index=1)
        self.assertTrue(trace.has_feedback)
        self.assertEqual(len(trace.feedback_items), 1)
        self.assertEqual(trace.feedback_items[0]["content"], "write more action")

    def test_with_workflow_run_id(self):
        chain = self.mock_db.query.return_value.filter.return_value.order_by.return_value
        chain.first.side_effect = [None, None, None, None, None, None, None]
        chain.all.return_value = []

        trace = self.aggregator.get_chapter_trace(1, 1, workflow_run_id=42)
        self.assertEqual(trace.chapter_index, 1)

    def test_unknown_chapter_returns_defaults(self):
        chain = self.mock_db.query.return_value.filter.return_value.order_by.return_value
        chain.first.side_effect = [None, None, None, None, None, None, None]
        chain.all.return_value = []

        trace = self.aggregator.get_chapter_trace(1, 99)
        self.assertEqual(trace.chapter_index, 99)
        self.assertIsNone(trace.draft_text)
        self.assertIsNone(trace.score)


class TestGetFailedChapters(unittest.TestCase):
    """Test get_failed_chapters with mocked get_chapter_trace."""

    def setUp(self):
        self.mock_db = MagicMock()
        self.aggregator = TraceAggregator(self.mock_db)
        # Direct mock on instance to avoid class-level patch issues
        self.aggregator.get_chapter_trace = MagicMock()

    def test_returns_low_score_chapters(self):
        self.aggregator.get_chapter_trace.return_value = ChapterTrace(chapter_index=2)

        low_art = MagicMock()
        low_art.chapter_index = 2
        low_art.workflow_run_id = 1
        low_art.content_json = {"score": 5.5}
        low_art.is_current = True

        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = [low_art]

        traces = self.aggregator.get_failed_chapters(project_id=1, threshold=7.0)
        self.assertEqual(len(traces), 1)
        self.assertEqual(traces[0].chapter_index, 2)

    def test_skips_high_score(self):
        high_art = MagicMock()
        high_art.chapter_index = 3
        high_art.workflow_run_id = 1
        high_art.content_json = {"score": 8.5}
        high_art.is_current = True

        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = [high_art]

        traces = self.aggregator.get_failed_chapters(project_id=1, threshold=7.0)
        self.assertEqual(traces, [])
        self.aggregator.get_chapter_trace.assert_not_called()

    def test_skips_before_since_chapter(self):
        art = MagicMock()
        art.chapter_index = 1
        art.workflow_run_id = 1
        art.content_json = {"score": 4.0}
        art.is_current = True

        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = [art]

        traces = self.aggregator.get_failed_chapters(project_id=1, since_chapter=2, threshold=7.0)
        self.assertEqual(traces, [])

    def test_handles_missing_score(self):
        art = MagicMock()
        art.chapter_index = 5
        art.workflow_run_id = 1
        art.content_json = {}
        art.is_current = True

        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = [art]

        traces = self.aggregator.get_failed_chapters(project_id=1, threshold=7.0)
        self.assertEqual(traces, [])

    def test_skips_duplicate_chapters(self):
        """Same chapter with multiple evaluation artifacts should only appear once."""
        self.aggregator.get_chapter_trace.return_value = ChapterTrace(chapter_index=2)

        art = MagicMock()
        art.chapter_index = 2
        art.workflow_run_id = 1
        art.content_json = {"score": 5.0}
        art.is_current = True

        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = [art, art]

        traces = self.aggregator.get_failed_chapters(project_id=1, threshold=7.0)
        self.assertEqual(len(traces), 1)

    def test_handles_none_chapter_index(self):
        art = MagicMock()
        art.chapter_index = None
        art.workflow_run_id = 1
        art.content_json = {"score": 4.0}
        art.is_current = True

        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = [art]

        traces = self.aggregator.get_failed_chapters(project_id=1, threshold=7.0)
        self.assertEqual(traces, [])


class TestGetUserModifiedChapters(unittest.TestCase):
    """Test get_user_modified_chapters with mocked get_chapter_trace."""

    def setUp(self):
        self.mock_db = MagicMock()
        self.aggregator = TraceAggregator(self.mock_db)
        self.aggregator.get_chapter_trace = MagicMock()

    def test_returns_chapters_with_user_feedback(self):
        self.aggregator.get_chapter_trace.return_value = ChapterTrace(chapter_index=3)

        fb = MagicMock()
        fb.chapter_index = 3
        fb.project_id = 1
        fb.feedback_scope = "chapter"
        fb.feedback_type = "user_note"
        fb.action_type = None
        fb.content = "rewrite needed"
        fb.status = "applied"
        fb.workflow_run_id = None
        fb.created_at = datetime(2025, 1, 1)
        fb.feedback_metadata = {}
        fb.id = 1

        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = [fb]

        traces = self.aggregator.get_user_modified_chapters(project_id=1)
        self.assertEqual(len(traces), 1)
        self.assertEqual(traces[0].chapter_index, 3)

    def test_skips_non_applied_feedback(self):
        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = []

        traces = self.aggregator.get_user_modified_chapters(project_id=1)
        self.assertEqual(traces, [])

    def test_skips_none_chapter_index(self):
        self.aggregator.get_chapter_trace.return_value = ChapterTrace(chapter_index=3)

        fb = MagicMock()
        fb.chapter_index = None
        fb.project_id = 1
        fb.feedback_scope = "chapter"
        fb.feedback_type = "user_note"
        fb.status = "applied"
        fb.action_type = None
        fb.content = ""
        fb.workflow_run_id = None
        fb.created_at = datetime(2025, 1, 1)
        fb.feedback_metadata = {}
        fb.id = 1

        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = [fb]

        traces = self.aggregator.get_user_modified_chapters(project_id=1)
        self.assertEqual(traces, [])

    def test_deduplicates_same_chapter(self):
        self.aggregator.get_chapter_trace.return_value = ChapterTrace(chapter_index=3)

        fb = MagicMock()
        fb.chapter_index = 3
        fb.project_id = 1
        fb.feedback_scope = "chapter"
        fb.feedback_type = "user_note"
        fb.status = "applied"
        fb.action_type = None
        fb.content = ""
        fb.workflow_run_id = None
        fb.created_at = datetime(2025, 1, 1)
        fb.feedback_metadata = {}
        fb.id = 1

        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = [fb, fb]

        traces = self.aggregator.get_user_modified_chapters(project_id=1)
        self.assertEqual(len(traces), 1)


class TestGetAllTracesForProject(unittest.TestCase):
    """Test get_all_traces_for_project."""

    def setUp(self):
        self.mock_db = MagicMock()
        self.aggregator = TraceAggregator(self.mock_db)
        self.aggregator.get_chapter_trace = MagicMock()

    def test_returns_sorted_traces(self):
        def trace_factory(*args, **_kw):
            return ChapterTrace(chapter_index=args[1] if len(args) > 1 else 0)
        self.aggregator.get_chapter_trace.side_effect = trace_factory

        art1 = MagicMock()
        art1.chapter_index = 1
        art1.workflow_run_id = 1
        art1.content_json = {"score": 8.0}
        art1.is_current = True

        art2 = MagicMock()
        art2.chapter_index = 2
        art2.workflow_run_id = 1
        art2.content_json = {"score": 7.0}
        art2.is_current = True

        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = [art2, art1]

        traces = self.aggregator.get_all_traces_for_project(project_id=1)
        self.assertEqual(len(traces), 2)
        self.assertEqual(traces[0].chapter_index, 1)
        self.assertEqual(traces[1].chapter_index, 2)

    def test_filters_by_min_chapter(self):
        art = MagicMock()
        art.chapter_index = 5
        art.workflow_run_id = 1
        art.content_json = {"score": 7.0}
        art.is_current = True

        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = [art]

        traces = self.aggregator.get_all_traces_for_project(project_id=1, min_chapter=6)
        self.assertEqual(traces, [])

    def test_filters_by_max_chapter(self):
        """art_in (ch 3) is within [1, 5] so it's included; art_out (ch 10) is excluded."""
        def trace_factory(*_args, **_kw):
            return ChapterTrace(chapter_index=_args[1] if len(_args) > 1 else 0)
        self.aggregator.get_chapter_trace.side_effect = trace_factory

        art_in = MagicMock()
        art_in.chapter_index = 3
        art_in.workflow_run_id = 1
        art_in.content_json = {"score": 7.0}
        art_in.is_current = True

        art_out = MagicMock()
        art_out.chapter_index = 10
        art_out.workflow_run_id = 1
        art_out.content_json = {"score": 7.0}
        art_out.is_current = True

        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = [art_in, art_out]

        traces = self.aggregator.get_all_traces_for_project(project_id=1, min_chapter=1, max_chapter=5)
        self.assertEqual(len(traces), 1)
        self.assertEqual(traces[0].chapter_index, 3)

    def test_handles_none_chapter_index(self):
        art = MagicMock()
        art.chapter_index = None
        art.workflow_run_id = 1
        art.content_json = {"score": 7.0}
        art.is_current = True

        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        self.mock_db.query.return_value = mock_q
        mock_q.all.return_value = [art]

        traces = self.aggregator.get_all_traces_for_project(project_id=1)
        self.assertEqual(traces, [])


if __name__ == "__main__":
    unittest.main()
