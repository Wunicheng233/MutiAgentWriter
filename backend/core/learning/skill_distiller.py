"""Distill structured WritingExperience instances into auto-generated SKILL.md files.

Routes each experience to the appropriate skill template based on problem_type,
computes a confidence score, and produces a valid SKILL.md file that can be
registered with the SkillRegistry.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from backend.core.config import settings
from backend.core.learning.experience_extractor import WritingExperience
from backend.utils.logger import logger


@dataclass
class DistilledSkill:
    """A skill ready to be written to disk as SKILL.md."""

    skill_id: str
    name: str
    description: str
    skill_type: str
    applies_to: list[str]
    priority: int
    tags: list[str]
    injection_content: str
    confidence: float
    source_chapters: list[int]
    target_character: str = ""
    strength: float = 0.3  # Default low strength for auto-generated skills

    def to_skill_md(self) -> str:
        """Render this skill as a complete SKILL.md file."""
        tags_str = ", ".join(self.tags)
        applies_to_str = ", ".join(self.applies_to)
        schema = self._build_config_schema()

        lines = [
            "---",
            f"name: \"{self.name}\"",
            f"description: \"{self.description}\"",
            f"type: {self.skill_type}",
            f"version: \"1.0\"",
            f"author: \"auto-generated\"",
            f"applies_to: [{applies_to_str}]",
            f"priority: {self.priority}",
            f"tags: [{tags_str}]",
            f"confidence: {self.confidence:.2f}",
        ]
        if self.target_character:
            lines.append(f"target: \"{self.target_character}\"")
        if self.source_chapters:
            chapters_str = ", ".join(str(c) for c in self.source_chapters)
            lines.append(f"source_chapters: [{chapters_str}]")
        lines.append(f"config_schema:")
        lines.append(f"  strength:")
        lines.append(f"    type: float")
        lines.append(f"    default: {self.strength}")
        lines.append(f"    min: 0.0")
        lines.append(f"    max: 1.0")
        lines.append(f"  mode:")
        lines.append(f"    type: string")
        lines.append(f"    enum: [style_only, full]")
        lines.append(f"    default: style_only")
        lines.append(f"safety_tags: [safe_for_all]")
        lines.append(f"dependencies: []")
        lines.append("---")
        lines.append("")
        lines.append(self.injection_content.strip())

        return "\n".join(lines)

    def _build_config_schema(self) -> dict[str, Any]:
        return {
            "strength": {
                "type": "float",
                "default": self.strength,
                "min": 0.0,
                "max": 1.0,
            },
            "mode": {
                "type": "string",
                "enum": ["style_only", "full"],
                "default": "style_only",
            },
        }


# Map problem_type → skill template configuration
SKILL_TEMPLATES: dict[str, dict[str, Any]] = {
    "character_inconsistency": {
        "type": "character_style",
        "applies_to": ["writer", "revise"],
        "priority": 50,
        "tags": ["character_style", "auto_generated"],
        "injection_template": "## 表达 DNA\n\n{suggestion}\n\n## 创作启发式\n\n{root_cause}\n\n## 需避免\n\n基于以下观察避免同类问题：{evidence}",
    },
    "style_issue": {
        "type": "writing_style",
        "applies_to": ["writer", "revise"],
        "priority": 60,
        "tags": ["writing_style", "auto_generated"],
        "injection_template": "## 风格指导\n\n{suggestion}\n\n## 原因分析\n\n{root_cause}\n\n## 参考证据\n\n{evidence}",
    },
    "pacing_issue": {
        "type": "plot_helper",
        "applies_to": ["writer", "planner"],
        "priority": 70,
        "tags": ["plot_helper", "auto_generated"],
        "injection_template": "## 节奏规则\n\n{suggestion}\n\n## 适用场景\n\n当写作{related}类型章节时，注意：{root_cause}",
    },
    "plot_hole": {
        "type": "plot_helper",
        "applies_to": ["planner", "writer"],
        "priority": 50,
        "tags": ["plot_helper", "auto_generated"],
        "injection_template": "## 规划约束\n\n{suggestion}\n\n## 避免\n\n{root_cause}",
    },
    "worldview_conflict": {
        "type": "plot_helper",
        "applies_to": ["writer", "planner", "critic"],
        "priority": 50,
        "tags": ["worldview", "auto_generated"],
        "injection_template": "## 世界观规则\n\n{suggestion}\n\n## 违规详情\n\n{root_cause}\n\n## 证据\n\n{evidence}",
    },
    "redundancy": {
        "type": "writing_style",
        "applies_to": ["writer", "revise", "critic"],
        "priority": 70,
        "tags": ["writing_style", "auto_generated"],
        "injection_template": "## 精简规则\n\n{suggestion}\n\n## 需避免的重复模式\n\n{evidence}",
    },
    "hook_weakness": {
        "type": "plot_helper",
        "applies_to": ["writer", "planner"],
        "priority": 60,
        "tags": ["plot_helper", "auto_generated"],
        "injection_template": "## 钩子设计指南\n\n{suggestion}\n\n## 避免\n\n{root_cause}",
    },
    "user_preference": {
        "type": "user_preference",
        "applies_to": ["writer", "planner", "critic"],
        "priority": 40,
        "tags": ["user_preference", "auto_generated"],
        "injection_template": "## 用户偏好\n\n{suggestion}\n\n## 用户反馈原文\n\n{evidence}",
    },
}

# Default template for unclassified problem types
DEFAULT_TEMPLATE: dict[str, Any] = {
    "type": "general_helper",
    "applies_to": ["writer", "revise"],
    "priority": 80,
    "tags": ["auto_generated"],
    "injection_template": "## 写作指导\n\n{suggestion}\n\n## 说明\n\n{root_cause}",
}


class SkillDistiller:
    """Convert WritingExperience instances into DistilledSkill instances.

    Usage:
        distiller = SkillDistiller()
        for exp in experiences:
            skill = distiller.distill(exp)
            if skill and skill.confidence >= threshold:
                registry.register_skill(skill.skill_id, skill.to_skill_md())
    """

    def distill(self, experience: WritingExperience) -> DistilledSkill | None:
        """Convert a single WritingExperience into a skill candidate.

        Returns None if the experience lacks enough detail to form a useful skill.
        """
        if not experience.description or not experience.suggestion:
            logger.debug(f"跳过经验蒸馏：描述或建议为空")
            return None

        template = SKILL_TEMPLATES.get(experience.problem_type, DEFAULT_TEMPLATE)
        skill_id = self._make_skill_id(experience)
        related = "、".join(experience.related_characters) if experience.related_characters else "相关"

        # Render injection content from template
        injection_content = template["injection_template"].format(
            suggestion=experience.suggestion,
            root_cause=experience.root_cause,
            evidence=experience.evidence[:500],
            related=related,
        )

        target_character = (
            experience.related_characters[0]
            if experience.related_characters
            else ""
        )

        # Compute confidence, blending LLM confidence with our own heuristics
        confidence = self._compute_blended_confidence(experience)
        strength = self._strength_from_confidence(confidence)

        skill = DistilledSkill(
            skill_id=skill_id,
            name=self._make_skill_name(experience, template["type"]),
            description=experience.description[:200],
            skill_type=template["type"],
            applies_to=list(template["applies_to"]),
            priority=int(template["priority"]),
            tags=list(template["tags"]),
            injection_content=injection_content,
            confidence=confidence,
            source_chapters=experience.source_chapters,
            target_character=target_character,
            strength=strength,
        )

        logger.info(
            f"蒸馏技能: {skill_id} "
            f"(type={skill.skill_type}, confidence={confidence:.2f}, strength={strength:.1f})"
        )
        return skill

    # ------------------------------------------------------------------
    # Confidence scoring
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_blended_confidence(exp: WritingExperience) -> float:
        """Combine LLM-reported confidence with heuristic signals.

        LLM confidence accounts for 60%, our heuristics for 40%.
        """
        llm_conf = min(max(exp.confidence, 0.0), 1.0)
        heuristics = []
        # Heuristic: more source chapters = more confidence
        if len(exp.source_chapters) >= 3:
            heuristics.append(0.8)
        elif len(exp.source_chapters) >= 2:
            heuristics.append(0.6)
        else:
            heuristics.append(0.3)
        # Heuristic: having evidence specific enough to quote is good
        if len(exp.evidence) > 100:
            heuristics.append(0.7)
        elif len(exp.evidence) > 20:
            heuristics.append(0.5)
        else:
            heuristics.append(0.3)
        # Heuristic: named characters → more specific → higher confidence
        if exp.related_characters:
            heuristics.append(0.7)
        else:
            heuristics.append(0.4)
        # Heuristic: specific root cause → higher confidence
        if len(exp.root_cause) > 50:
            heuristics.append(0.6)
        else:
            heuristics.append(0.4)

        heuristic_conf = sum(heuristics) / len(heuristics) if heuristics else 0.5
        blended = 0.6 * llm_conf + 0.4 * heuristic_conf
        return min(max(blended, 0.0), 1.0)

    @staticmethod
    def _strength_from_confidence(confidence: float) -> float:
        """Map confidence to an injection strength value.

        - confidence < 0.5: strength=0.0 (not usable, needs manual review)
        - 0.5 <= confidence < 0.8: strength=0.3 (low impact trial)
        - confidence >= 0.8: strength=0.7 (confident recommendation)
        """
        if confidence < settings.skill_confidence_threshold:
            return 0.0
        if confidence >= 0.8:
            return 0.7
        return 0.3

    # ------------------------------------------------------------------
      # Naming helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _make_skill_id(exp: WritingExperience) -> str:
        """Generate a unique, URL-safe skill ID."""
        prefix_map = {
            "character_inconsistency": "char",
            "style_issue": "style",
            "pacing_issue": "pace",
            "plot_hole": "plot",
            "worldview_conflict": "world",
            "redundancy": "concise",
            "hook_weakness": "hook",
            "user_preference": "pref",
        }
        prefix = prefix_map.get(exp.problem_type, "gen")
        char_suffix = ""
        if exp.related_characters:
            char_suffix = f"-{exp.related_characters[0]}"
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        slug = f"{prefix}{char_suffix}-{timestamp}"
        # Ensure the ID is filesystem-safe
        slug = re.sub(r"[^a-zA-Z0-9_\-]", "", slug)
        return slug

    @staticmethod
    def _make_skill_name(exp: WritingExperience, skill_type: str) -> str:
        """Generate a human-readable skill name."""
        if exp.related_characters:
            chars = "、".join(exp.related_characters)
            return f"{chars} {skill_type} (auto)"
        desc = exp.description[:30]
        return f"{desc}{'...' if len(exp.description) > 30 else ''} (auto)"
