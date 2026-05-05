from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from . import safety_filter
from . import strength_trimmer
from .skill_registry import Skill, SkillRegistry, is_author_style_skill
from backend.core.learning.chapter_context import ChapterContext
from backend.utils.logger import logger


@dataclass(frozen=True)
class AssembledSkill:
    skill: Skill
    rendered_content: str
    config: dict[str, Any]


class SkillAssembler:
    """Match enabled project skills to an agent and render their injection text.

    Supports two selection modes:
    1. Static: Skills enabled in project_config (existing behavior)
    2. Dynamic: Skills matched via ChromaDB against ChapterContext (Hermes-style)
    """

    AGENT_ALLOWLIST = {"planner", "writer", "revise", "critic", "revise_local_patch", "stitch"}
    AUTHOR_STYLE_CHAR_BUDGET = 4200
    HELPER_SKILL_CHAR_BUDGET = 2600
    CONTEXT_SKILL_MAX = 3  # Max dynamically matched skills to include

    def __init__(
        self,
        registry: SkillRegistry | None = None,
    ):
        self.registry = registry or SkillRegistry()

    def assemble(
        self,
        agent_name: str,
        *,
        project_config: dict[str, Any] | None = None,
        chapter_context: ChapterContext | None = None,
    ) -> list[AssembledSkill]:
        if agent_name not in self.AGENT_ALLOWLIST:
            return []

        # 1. Static skills from project config (existing behavior)
        assembled: list[AssembledSkill] = []
        selected_author_style = False
        for entry in self._enabled_skill_entries(project_config):
            skill_id = str(entry.get("skill_id") or "")
            skill = self.registry.load_skill(skill_id)
            if skill is None or not self._applies_to_agent(skill, agent_name, entry):
                continue
            if is_author_style_skill(skill):
                if selected_author_style:
                    continue
                selected_author_style = True

            config = dict(entry.get("config") or {})
            strength = config.get("strength", self._default_strength(skill))
            raw_content = skill.injection_for(agent_name)
            trimmed = strength_trimmer.trim_by_strength(raw_content, strength=strength)
            skill_is_author_style = is_author_style_skill(skill)
            trimmed = self._trim_to_budget(
                trimmed,
                self.AUTHOR_STYLE_CHAR_BUDGET if skill_is_author_style else self.HELPER_SKILL_CHAR_BUDGET,
                prefer_style_sections=skill_is_author_style,
            )
            if not trimmed:
                continue
            mode = str(config.get("mode") or "style_only")
            rendered = safety_filter.filter_unsafe_content(trimmed, mode=mode)
            if rendered:
                assembled.append(AssembledSkill(skill=skill, rendered_content=rendered, config=config))

        # 2. Dynamic skills matched via ChromaDB (Hermes-style)
        if chapter_context is not None:
            dynamic_skills = self._retrieve_dynamic_skills(agent_name, chapter_context)
            seen_ids = {a.skill.id for a in assembled}
            for skill in dynamic_skills:
                if skill.id in seen_ids:
                    continue  # Already included from project config
                config = {"strength": max(skill.confidence, 0.3)}
                raw_content = skill.injection_for(agent_name)
                trimmed = strength_trimmer.trim_by_strength(raw_content, strength=config["strength"])
                trimmed = self._trim_to_budget(
                    trimmed,
                    self.HELPER_SKILL_CHAR_BUDGET,
                    prefer_style_sections=False,
                )
                if not trimmed:
                    continue
                rendered = safety_filter.filter_unsafe_content(trimmed, mode="style_only")
                if rendered:
                    assembled.append(AssembledSkill(skill=skill, rendered_content=rendered, config=config))
                    seen_ids.add(skill.id)

        return sorted(
            assembled,
            key=lambda item: (
                0 if is_author_style_skill(item.skill) else 1,
                # Dynamic skills that match current characters get a boost
                -1 if (
                    chapter_context is not None
                    and item.skill.target_character
                    and item.skill.target_character in chapter_context.characters_involved
                ) else 0,
                item.skill.priority,
                item.skill.id,
            ),
        )

    def _retrieve_dynamic_skills(
        self,
        agent_name: str,
        chapter_context: ChapterContext,
    ) -> list[Skill]:
        """Use ChromaDB to find skills relevant to the current chapter context."""
        try:
            from backend.utils.vector_db import search_relevant_skills

            query_parts = list(chapter_context.characters_involved)
            if chapter_context.plot_stage and chapter_context.plot_stage != "unknown":
                query_parts.append(chapter_context.plot_stage)
            query_parts.append(chapter_context.chapter_type)
            query = " ".join(query_parts)

            results = search_relevant_skills(
                query=query,
                top_k=self.CONTEXT_SKILL_MAX,
                character_name=chapter_context.characters_involved[0] if chapter_context.characters_involved else None,
            )
        except Exception as e:
            logger.debug(f"动态技能检索失败: {e}")
            return []

        skills: list[Skill] = []
        for match in results:
            skill_id = match.get("skill_id", "")
            skill = self.registry.load_skill(skill_id)
            if skill is not None and self._applies_to_agent(skill, agent_name, {"skill_id": skill_id}):
                skills.append(skill)

        return skills

    def _enabled_skill_entries(self, project_config: dict[str, Any] | None) -> list[dict[str, Any]]:
        if not project_config:
            return []

        skills_config = project_config.get("skills") or {}
        enabled = skills_config.get("enabled") or []

        entries = []
        seen = set()
        import logging
        logger = logging.getLogger(__name__)
        for entry in enabled:
            if isinstance(entry, str):
                normalized = {"skill_id": entry, "config": {}}
            else:
                normalized = entry
                if "skill_id" not in normalized:
                    logger.warning(f"跳过无效的 skill 配置项: {entry}")
                    continue

            skill_id = normalized["skill_id"]
            if skill_id not in seen:
                seen.add(skill_id)
                entries.append(normalized)
        return entries

    def _applies_to_agent(self, skill: Skill, agent_name: str, entry: dict[str, Any]) -> bool:
        override = entry.get("applies_to_override")
        if override is not None:
            return agent_name in override
        applies_to = entry.get("applies_to") or skill.applies_to
        return agent_name in applies_to

    def _default_strength(self, skill: Skill) -> float:
        strength_schema = skill.config_schema.get("strength")
        if isinstance(strength_schema, dict):
            return float(strength_schema.get("default", 0.7))
        return 0.7

    def _trim_to_budget(self, content: str, max_chars: int, *, prefer_style_sections: bool = False) -> str:
        text = content.strip()
        if len(text) <= max_chars:
            return text

        sections = strength_trimmer._split_markdown_sections(text)
        if len(sections) <= 1:
            return text[:max_chars].rsplit("\n", 1)[0].strip() or text[:max_chars].strip()

        if prefer_style_sections:
            sections = self._prioritize_style_sections(sections)

        kept: list[str] = []
        total = 0
        for section in sections:
            projected = total + len(section) + (2 if kept else 0)
            if projected > max_chars:
                break
            kept.append(section)
            total = projected

        if kept:
            return "\n\n".join(kept).strip()
        return sections[0][:max_chars].rsplit("\n", 1)[0].strip() or sections[0][:max_chars].strip()

    def _prioritize_style_sections(self, sections: list[str]) -> list[str]:
        primary_keywords = ("表达DNA", "风格DNA", "文风", "句式", "语言风格", "写作风格")
        secondary_keywords = ("创作启发", "写作", "叙事", "心智模型", "方法论", "核心能力")

        def rank(section: str) -> int:
            heading = section.splitlines()[0] if section.splitlines() else section
            if any(keyword in heading for keyword in primary_keywords):
                return 0
            if any(keyword in heading for keyword in secondary_keywords):
                return 1
            if any(keyword in section[:400] for keyword in primary_keywords):
                return 2
            if any(keyword in section[:400] for keyword in secondary_keywords):
                return 3
            return 4

        return [section for _, section in sorted(enumerate(sections), key=lambda pair: (rank(pair[1]), pair[0]))]
