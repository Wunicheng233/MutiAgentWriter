"""Hermes-style learning loop: experience extraction, skill distillation, and dynamic skill management."""

from backend.core.learning.chapter_context import ChapterContext
from backend.core.learning.feedback_collector import FeedbackCollector, FeedbackSignal
from backend.core.learning.trace_aggregator import TraceAggregator
from backend.core.learning.experience_extractor import ExperienceExtractor, WritingExperience
from backend.core.learning.skill_distiller import SkillDistiller, DistilledSkill

__all__ = [
    "ChapterContext",
    "FeedbackCollector",
    "FeedbackSignal",
    "TraceAggregator",
    "ExperienceExtractor",
    "WritingExperience",
    "SkillDistiller",
    "DistilledSkill",
]
