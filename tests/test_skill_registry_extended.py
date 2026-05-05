"""Tests for SkillRegistry extensions - dynamic registration and filtering."""

import tempfile
import unittest
from pathlib import Path
from backend.core.skill_runtime.skill_registry import (
    SkillRegistry,
    Skill,
    SkillValidationError,
)


class TestSkillDataclassExtensions(unittest.TestCase):
    """Tests for Skill dataclass new fields."""

    def test_skill_default_confidence(self):
        skill = Skill(
            id="test",
            name="test",
            description="test",
            version="1.0",
            author="test",
            applies_to=["writer"],
            priority=50,
        )
        self.assertEqual(skill.confidence, 0.0)
        self.assertEqual(skill.source_chapters, [])
        self.assertEqual(skill.target_character, "")

    def test_to_summary_includes_new_fields(self):
        skill = Skill(
            id="auto-char-1",
            name="林舟风格",
            description="角色风格",
            version="1.0",
            author="auto-generated",
            applies_to=["writer"],
            priority=50,
            tags=["character_style", "auto_generated"],
            confidence=0.85,
            source_chapters=[1, 2, 3],
            target_character="林舟",
        )
        summary = skill.to_summary()
        self.assertAlmostEqual(summary["confidence"], 0.85)
        self.assertEqual(summary["target_character"], "林舟")
        self.assertEqual(summary["source_chapters"], [1, 2, 3])
        self.assertTrue(summary["auto_generated"])

    def test_to_summary_non_auto_generated(self):
        skill = Skill(
            id="manual",
            name="manual",
            description="manual",
            version="1.0",
            author="user",
            applies_to=["writer"],
            priority=50,
            tags=["writing_style"],
        )
        summary = skill.to_summary()
        self.assertFalse(summary["auto_generated"])


class TestSkillRegistryExtended(unittest.TestCase):
    """Tests for dynamic skill registration and filtering."""

    def setUp(self):
        self.temp_skills_dir = Path(tempfile.mkdtemp())
        self.registry = SkillRegistry(self.temp_skills_dir)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_skills_dir, ignore_errors=True)

    def _make_skill_md(
        self,
        name="Test Skill",
        description="Auto-generated test skill",
        skill_type="writing_style",
        applies_to="[writer, revise]",
        priority=60,
        tags="[writing_style, auto_generated]",
        confidence=0.75,
        source_chapters="[1, 2]",
        target="",
        body="## 风格指导\n\n保持简洁",
    ) -> str:
        lines = [
            "---",
            f'name: "{name}"',
            f'description: "{description}"',
            f"type: {skill_type}",
            'version: "1.0"',
            "author: auto-generated",
            f"applies_to: {applies_to}",
            f"priority: {priority}",
            f"tags: {tags}",
            f"confidence: {confidence}",
        ]
        if source_chapters:
            lines.append(f"source_chapters: {source_chapters}")
        if target:
            lines.append(f'target: "{target}"')
        lines.append("---")
        lines.append("")
        lines.append(body)
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # register_skill
    # ------------------------------------------------------------------

    def test_register_skill_creates_directory_and_file(self):
        md_content = self._make_skill_md()
        skill = self.registry.register_skill("test-skill-1", md_content)

        self.assertIsNotNone(skill)
        self.assertEqual(skill.id, "test-skill-1")
        self.assertEqual(skill.name, "Test Skill")
        self.assertAlmostEqual(skill.confidence, 0.75)

        # Verify file exists on disk
        skill_dir = self.temp_skills_dir / "test-skill-1"
        self.assertTrue(skill_dir.exists())
        self.assertTrue((skill_dir / "SKILL.md").exists())

        # Verify content was written
        written = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("保持简洁", written)
        self.assertIn('name: "Test Skill"', written)

    def test_register_skill_caches_skill(self):
        md = self._make_skill_md()
        self.registry.register_skill("cached-skill", md)
        self.assertIn("cached-skill", self.registry._cache)

    def test_register_skill_reloads_from_disk(self):
        md = self._make_skill_md(name="Original")
        self.registry.register_skill("reload-skill", md)

        # Modify on disk directly
        skill_path = self.temp_skills_dir / "reload-skill" / "SKILL.md"
        modified = md.replace('name: "Original"', 'name: "Modified"')
        skill_path.write_text(modified, encoding="utf-8")

        # Clear cache and reload
        self.registry._cache.pop("reload-skill", None)
        reloaded = self.registry.load_skill("reload-skill")
        self.assertEqual(reloaded.name, "Modified")

    def test_register_skill_with_target_character(self):
        md = self._make_skill_md(
            name="林舟风格",
            skill_type="character_style",
            tags="[character_style, auto_generated]",
            target="林舟",
        )
        skill = self.registry.register_skill("char-linzhou", md)
        self.assertEqual(skill.target_character, "林舟")

    def test_register_skill_with_source_chapters(self):
        md = self._make_skill_md(source_chapters="[3, 4, 5]")
        skill = self.registry.register_skill("multi-chapter", md)
        self.assertEqual(skill.source_chapters, [3, 4, 5])

    def test_register_skill_with_minimal_frontmatter_gets_defaults(self):
        skill = self.registry.register_skill("minimal-skill", "---\nname: minimal\n---\nbody")
        self.assertIsNotNone(skill)
        self.assertEqual(skill.id, "minimal-skill")
        self.assertEqual(skill.name, "minimal")

    def test_register_skill_overwrite_existing(self):
        md1 = self._make_skill_md(name="Version 1", confidence=0.5)
        md2 = self._make_skill_md(name="Version 2", confidence=0.9)

        self.registry.register_skill("overwrite-me", md1)
        self.registry.register_skill("overwrite-me", md2)

        skill = self.registry.load_skill("overwrite-me")
        self.assertEqual(skill.name, "Version 2")
        self.assertAlmostEqual(skill.confidence, 0.9)

    # ------------------------------------------------------------------
    # list_auto_generated_skills
    # ------------------------------------------------------------------

    def test_list_auto_generated_skills_empty_when_none(self):
        skills = self.registry.list_auto_generated_skills()
        self.assertEqual(skills, [])

    def test_list_auto_generated_skills_returns_only_tagged(self):
        auto_md = self._make_skill_md(
            name="Auto",
            tags="[writing_style, auto_generated]",
        )
        manual_md = self._make_skill_md(
            name="Manual",
            tags="[writing_style]",
            confidence=0.0,
        )

        self.registry.register_skill("auto-skill", auto_md)
        self.registry.register_skill("manual-skill", manual_md)

        auto_skills = self.registry.list_auto_generated_skills()
        self.assertEqual(len(auto_skills), 1)
        self.assertEqual(auto_skills[0].name, "Auto")

    def test_list_auto_generated_skills_multiple(self):
        for i in range(3):
            md = self._make_skill_md(name=f"Auto {i}", tags="[auto_generated]")
            self.registry.register_skill(f"auto-{i}", md)

        skills = self.registry.list_auto_generated_skills()
        self.assertEqual(len(skills), 3)

    # ------------------------------------------------------------------
    # get_skills_by_character
    # ------------------------------------------------------------------

    def test_get_skills_by_character_case_insensitive(self):
        md = self._make_skill_md(
            name="林舟风格",
            skill_type="character_style",
            tags="[character_style, auto_generated]",
            target="林舟",
        )
        self.registry.register_skill("char-linzhou", md)

        # Uppercase query
        results = self.registry.get_skills_by_character("林舟")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].target_character, "林舟")

    def test_get_skills_by_character_no_match(self):
        md = self._make_skill_md(target="林舟")
        self.registry.register_skill("char-linzhou", md)
        results = self.registry.get_skills_by_character("陈默")
        self.assertEqual(results, [])

    def test_get_skills_by_character_none_registered(self):
        results = self.registry.get_skills_by_character("林舟")
        self.assertEqual(results, [])

    # ------------------------------------------------------------------
    # get_skills_by_type
    # ------------------------------------------------------------------

    def test_get_skills_by_type_returns_matching(self):
        style_md = self._make_skill_md(tags="[writing_style]")
        char_md = self._make_skill_md(tags="[character_style]")
        self.registry.register_skill("style-1", style_md)
        self.registry.register_skill("char-1", char_md)

        results = self.registry.get_skills_by_type("writing_style")
        self.assertEqual(len(results), 1)

    def test_get_skills_by_type_no_matches(self):
        results = self.registry.get_skills_by_type("plot_helper")
        self.assertEqual(results, [])

    # ------------------------------------------------------------------
    # load_skill parses new metadata
    # ------------------------------------------------------------------

    def test_load_skill_parses_confidence_and_metadata(self):
        md = self._make_skill_md(
            name="自信技能",
            confidence=0.88,
            source_chapters="[1, 3, 5]",
            target="林舟",
        )
        self.registry.register_skill("high-conf-skill", md)
        skill = self.registry.load_skill("high-conf-skill")
        self.assertAlmostEqual(skill.confidence, 0.88)
        self.assertEqual(skill.source_chapters, [1, 3, 5])
        self.assertEqual(skill.target_character, "林舟")

    def test_load_skill_missing_confidence_defaults_zero(self):
        md = "---\nname: no-conf\ndescription: test\n---\nbody"
        skill = self.registry.register_skill("no-conf-2", md)
        self.assertAlmostEqual(skill.confidence, 0.0)
        self.assertEqual(skill.target_character, "")
        self.assertEqual(skill.source_chapters, [])


if __name__ == "__main__":
    unittest.main()
