from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


class SkillValidationError(ValueError):
    """Raised when a skill directory is malformed."""


AUTHOR_STYLE_TYPES = {"perspective", "person-perspective", "author-style"}


def is_author_style_skill(skill: "Skill") -> bool:
    tags = set(skill.tags or [])
    return (
        "author-style" in tags
        or "perspective" in tags
        or skill.id.endswith("-perspective")
    )


@dataclass(frozen=True)
class Skill:
    id: str
    name: str
    description: str
    version: str
    author: str
    applies_to: list[str]
    priority: int
    tags: list[str] = field(default_factory=list)
    config_schema: dict[str, Any] = field(default_factory=dict)
    safety_tags: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    injection_content: str = ""
    injection_by_agent: dict[str, str] = field(default_factory=dict)
    path: Path | None = None
    # Auto-generated skill metadata (Hermes-style)
    confidence: float = 0.0
    source_chapters: list[int] = field(default_factory=list)
    target_character: str = ""

    def injection_for(self, agent_name: str) -> str:
        return (
            self.injection_by_agent.get(agent_name)
            or self.injection_by_agent.get("all")
            or self.injection_content
        )

    def to_summary(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "author": self.author,
            "applies_to": self.applies_to,
            "priority": self.priority,
            "tags": self.tags,
            "config_schema": self.config_schema,
            "safety_tags": self.safety_tags,
            "dependencies": self.dependencies,
            "confidence": self.confidence,
            "target_character": self.target_character,
            "source_chapters": self.source_chapters,
            "auto_generated": "auto_generated" in (self.tags or []),
        }


class SkillRegistry:
    DEFAULT_SKILLS_DIR = Path(__file__).resolve().parents[2] / "skills"

    def __init__(self, skills_dir: str | Path | None = None):
        self.skills_dir = Path(skills_dir) if skills_dir else self.DEFAULT_SKILLS_DIR
        self._cache: dict[str, Skill] = {}

    def list_skills(self) -> list[Skill]:
        if not self.skills_dir.exists():
            return []

        skills: list[Skill] = []
        for skill_dir in sorted(path for path in self.skills_dir.iterdir() if path.is_dir()):
            skill = self.load_skill(skill_dir.name)
            if skill is not None:
                skills.append(skill)
        return sorted(skills, key=lambda skill: (skill.priority, skill.id))

    def list_skill_summaries(self) -> list[dict[str, Any]]:
        return [skill.to_summary() for skill in self.list_skills()]

    def load_skill(self, skill_id: str) -> Skill | None:
        if not skill_id:
            return None
        if skill_id in self._cache:
            return self._cache[skill_id]

        skill_dir = self.skills_dir / skill_id
        if not skill_dir.exists() or not skill_dir.is_dir():
            return None

        skill_md_path = skill_dir / "SKILL.md"
        if not skill_md_path.exists():
            raise SkillValidationError(f"Skill '{skill_id}' must include SKILL.md")

        frontmatter, body = self._parse_injection_file(skill_md_path.read_text(encoding="utf-8"))
        metadata = self._metadata_from_skill_md(skill_id, frontmatter)

        injection_by_agent = {
            key: str(value).strip()
            for key, value in frontmatter.items()
            if key in {"all", "planner", "writer", "critic", "revise"} and value
        }
        if frontmatter.get("target") == "all" and body:
            injection_by_agent.setdefault("all", body)

        applies_to_value = metadata["applies_to"]
        if not isinstance(applies_to_value, (list, tuple)):
            applies_to_value = [applies_to_value]
        applies_to = list(applies_to_value)

        skill = Skill(
            id=metadata["id"],
            name=metadata["name"],
            description=metadata["description"],
            version=str(metadata["version"]),
            author=metadata["author"],
            applies_to=applies_to,
            priority=int(metadata["priority"]),
            tags=list(metadata.get("tags") or []),
            config_schema=dict(metadata.get("config_schema") or {}),
            safety_tags=list(metadata.get("safety_tags") or []),
            dependencies=list(metadata.get("dependencies") or []),
            injection_content=body,
            injection_by_agent=injection_by_agent,
            path=skill_dir,
            # Auto-generated skill metadata
            confidence=float(metadata.get("confidence") or 0.0),
            source_chapters=list(metadata.get("source_chapters") or []),
            target_character=str(metadata.get("target") or ""),
        )
        self._cache[skill_id] = skill
        return skill

    def _metadata_from_skill_md(self, skill_id: str, frontmatter: dict[str, Any]) -> dict[str, Any]:
        skill_type = str(frontmatter.get("type") or "general")
        is_author_style = skill_type in AUTHOR_STYLE_TYPES or skill_id.endswith("-perspective")
        default_applies_to = ["planner", "writer", "revise"]
        priority = 50 if is_author_style else 80
        tags = list(frontmatter.get("tags") or [skill_type])
        if is_author_style:
            for tag in ("perspective", "author-style"):
                if tag not in tags:
                    tags.append(tag)

        applies_to_value = frontmatter.get("applies_to") or default_applies_to
        if not isinstance(applies_to_value, (list, tuple)):
            applies_to_value = [applies_to_value]
        applies_to = list(applies_to_value)

        return {
            "id": skill_id,
            "name": str(frontmatter.get("name") or skill_id),
            "description": str(frontmatter.get("description") or ""),
            "version": str(frontmatter.get("version") or "1.0"),
            "author": str(frontmatter.get("author") or "external-skill"),
            "applies_to": applies_to,
            "priority": priority if is_author_style else int(frontmatter.get("priority") or priority),
            "tags": tags,
            "config_schema": dict(frontmatter.get("config_schema") or self._default_config_schema()),
            "safety_tags": list(frontmatter.get("safety_tags") or ["safe_for_all"]),
            "dependencies": list(frontmatter.get("dependencies") or []),
            # Hermes-style auto-generated skill metadata
            "confidence": frontmatter.get("confidence", 0.0),
            "source_chapters": frontmatter.get("source_chapters", []),
            "target": frontmatter.get("target", ""),
        }

    def _default_config_schema(self) -> dict[str, Any]:
        return {
            "strength": {
                "type": "float",
                "default": 0.7,
                "min": 0.0,
                "max": 1.0,
                "label": "注入强度",
                "description": "数值越高，Skill 对提示词的影响越明显",
            },
            "mode": {
                "type": "string",
                "enum": ["style_only", "full"],
                "default": "style_only",
                "label": "注入模式",
                "description": "style_only 会过滤角色扮演和敏感内容",
            },
        }

    def _parse_injection_file(self, content: str) -> tuple[dict[str, Any], str]:
        text = content.strip()
        if not text.startswith("---"):
            return {}, text

        parts = text.split("---", 2)
        if len(parts) < 3:
            return {}, text
        frontmatter_text = parts[1].strip()
        body = parts[2].strip()
        frontmatter = yaml.safe_load(frontmatter_text) or {}
        if not isinstance(frontmatter, dict):
            frontmatter = {}
        return frontmatter, body

    # ------------------------------------------------------------------
    # Dynamic skill registration (Hermes-style)
    # ------------------------------------------------------------------

    def register_skill(self, skill_id: str, skill_md_content: str) -> Skill:
        """Dynamically register a new skill by writing its SKILL.md to disk.

        The skill is immediately available via the registry cache.

        Args:
            skill_id: Unique identifier (used as directory name)
            skill_md_content: Full SKILL.md content (frontmatter + body)

        Returns:
            The newly registered Skill instance.
        """
        skill_dir = self.skills_dir / skill_id
        skill_dir.mkdir(parents=True, exist_ok=True)
        skill_path = skill_dir / "SKILL.md"
        skill_path.write_text(skill_md_content.strip(), encoding="utf-8")

        # Invalidate cache entry so load_skill re-reads from disk
        self._cache.pop(skill_id, None)
        skill = self.load_skill(skill_id)
        if skill is None:
            raise SkillValidationError(
                f"Failed to load registered skill '{skill_id}' from {skill_path}"
            )
        return skill

    def list_auto_generated_skills(self) -> list[Skill]:
        """List all skills tagged as auto_generated."""
        return [
            skill for skill in self.list_skills()
            if "auto_generated" in (skill.tags or [])
        ]

    def get_skills_by_character(self, character_name: str) -> list[Skill]:
        """Find skills targeting a specific character (case-insensitive)."""
        char_lower = character_name.lower()
        return [
            skill for skill in self.list_skills()
            if skill.target_character.lower() == char_lower
        ]

    def get_skills_by_type(self, skill_type: str) -> list[Skill]:
        """Find skills with a specific type tag (e.g. 'character_style', 'writing_style')."""
        return [
            skill for skill in self.list_skills()
            if skill_type in (skill.tags or [])
        ]
