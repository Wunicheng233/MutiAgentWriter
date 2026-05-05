"""Chapter-level context for skill retrieval and experience extraction."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ChapterContext:
    """Contextual information about a chapter being written or evaluated.

    Used by SkillAssembler to dynamically select relevant skills,
    and by ExperienceExtractor to understand the chapter's role in the story.
    """

    chapter_index: int
    characters_involved: list[str] = field(default_factory=list)
    plot_stage: str = "unknown"        # "exposition" | "rising" | "climax" | "falling" | "resolution"
    chapter_type: str = "regular"      # "regular" | "transition" | "climax" | "setup"
    recent_feedback: list[str] = field(default_factory=list)
    chapter_outline: str = ""
    target_word_count: int = 2000
