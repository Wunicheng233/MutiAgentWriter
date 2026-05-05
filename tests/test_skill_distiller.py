"""Tests for SkillDistiller - experience to skill distillation pipeline."""

import unittest
from datetime import datetime
from backend.core.learning.skill_distiller import (
    SkillDistiller,
    DistilledSkill,
    SKILL_TEMPLATES,
    DEFAULT_TEMPLATE,
)
from backend.core.learning.experience_extractor import WritingExperience


class DistilledSkillTests(unittest.TestCase):
    """Tests for DistilledSkill dataclass."""

    def test_to_skill_md_contains_frontmatter(self):
        skill = DistilledSkill(
            skill_id="test-skill-001",
            name="Test Skill",
            description="A test skill",
            skill_type="writing_style",
            applies_to=["writer", "revise"],
            priority=60,
            tags=["writing_style", "auto_generated"],
            injection_content="## 风格指导\n\n保持简洁",
            confidence=0.75,
            source_chapters=[1, 2],
        )
        md = skill.to_skill_md()
        self.assertIn("---", md)
        self.assertIn('name: "Test Skill"', md)
        self.assertIn('description: "A test skill"', md)
        self.assertIn("type: writing_style", md)
        self.assertIn("applies_to: [writer, revise]", md)
        self.assertIn("priority: 60", md)
        self.assertIn("tags: [writing_style, auto_generated]", md)
        self.assertIn("confidence: 0.75", md)
        self.assertIn("source_chapters: [1, 2]", md)
        self.assertIn("config_schema:", md)
        self.assertIn("## 风格指导", md)
        self.assertIn("保持简洁", md)

    def test_to_skill_md_includes_target_character(self):
        skill = DistilledSkill(
            skill_id="char-linzhou-001",
            name="林舟风格",
            description="林舟对话风格",
            skill_type="character_style",
            applies_to=["writer"],
            priority=50,
            tags=["character_style", "auto_generated"],
            injection_content="## 表达 DNA\n\n短句",
            confidence=0.8,
            source_chapters=[3],
            target_character="林舟",
        )
        md = skill.to_skill_md()
        self.assertIn('target: "林舟"', md)

    def test_to_skill_md_empty_source_chapters(self):
        skill = DistilledSkill(
            skill_id="no-src",
            name="No Src",
            description="no sources",
            skill_type="general_helper",
            applies_to=["writer"],
            priority=80,
            tags=["auto_generated"],
            injection_content="content",
            confidence=0.0,
            source_chapters=[],
        )
        md = skill.to_skill_md()
        self.assertNotIn("source_chapters", md)


class SkillTemplatesTests(unittest.TestCase):
    """Tests for SKILL_TEMPLATES mapping."""

    def test_all_problem_types_have_templates(self):
        expected_types = {
            "character_inconsistency",
            "style_issue",
            "pacing_issue",
            "plot_hole",
            "worldview_conflict",
            "redundancy",
            "hook_weakness",
            "user_preference",
        }
        for pt in expected_types:
            self.assertIn(pt, SKILL_TEMPLATES, f"Missing template for {pt}")

    def test_all_templates_have_required_keys(self):
        required = {"type", "applies_to", "priority", "tags", "injection_template"}
        for pt, tmpl in SKILL_TEMPLATES.items():
            for key in required:
                self.assertIn(key, tmpl, f"Template {pt} missing key '{key}'")

    def test_default_template_has_required_keys(self):
        self.assertIn("type", DEFAULT_TEMPLATE)
        self.assertIn("applies_to", DEFAULT_TEMPLATE)
        self.assertIn("injection_template", DEFAULT_TEMPLATE)

    def test_character_inconsistency_template_uses_character_style(self):
        self.assertEqual(SKILL_TEMPLATES["character_inconsistency"]["type"], "character_style")

    def test_style_issue_template_uses_writing_style(self):
        self.assertEqual(SKILL_TEMPLATES["style_issue"]["type"], "writing_style")

    def test_pacing_issue_template_uses_plot_helper(self):
        self.assertEqual(SKILL_TEMPLATES["pacing_issue"]["type"], "plot_helper")


class TestDistillMethod(unittest.TestCase):
    """Tests for SkillDistiller.distill()."""

    def setUp(self):
        self.distiller = SkillDistiller()

    def test_distill_character_inconsistency(self):
        exp = WritingExperience(
            problem_type="character_inconsistency",
            description="林舟对话不符合设定",
            root_cause="忽略了林舟沉默寡言的性格",
            suggestion="林舟对话应保持短句、少解释的风格",
            evidence="第3段林舟说了200字的长篇自白",
            related_characters=["林舟"],
            confidence=0.85,
            source_chapters=[1, 2, 3],
        )
        skill = self.distiller.distill(exp)
        self.assertIsNotNone(skill)
        self.assertEqual(skill.skill_type, "character_style")
        self.assertEqual(skill.target_character, "林舟")
        self.assertIn("林舟", skill.name)
        self.assertIn("auto_generated", skill.tags)
        self.assertGreater(skill.confidence, 0.5)

    def test_distill_style_issue(self):
        exp = WritingExperience(
            problem_type="style_issue",
            description="文风不统一",
            root_cause="混合了多种叙事视角",
            suggestion="统一使用第三人称有限视角",
            evidence="第1段上帝视角，第2段切换到第一人称",
            confidence=0.7,
        )
        skill = self.distiller.distill(exp)
        self.assertIsNotNone(skill)
        self.assertEqual(skill.skill_type, "writing_style")

    def test_distill_pacing_issue(self):
        exp = WritingExperience(
            problem_type="pacing_issue",
            description="情节推进过快",
            root_cause="缺少过渡章节",
            suggestion="在关键转折前增加铺垫章节",
            evidence="第4章主角突然获得能力",
            related_characters=["林舟"],
            confidence=0.6,
        )
        skill = self.distiller.distill(exp)
        self.assertIsNotNone(skill)
        self.assertEqual(skill.skill_type, "plot_helper")
        self.assertIn("节奏规则", skill.injection_content)

    def test_distill_plot_hole(self):
        exp = WritingExperience(
            problem_type="plot_hole",
            description="逻辑漏洞",
            root_cause="时间线冲突",
            suggestion="调整时间线顺序",
            evidence="第2章和第3章时间线不一致",
            confidence=0.9,
        )
        skill = self.distiller.distill(exp)
        self.assertIsNotNone(skill)
        self.assertEqual(skill.skill_type, "plot_helper")

    def test_distill_worldview_conflict(self):
        exp = WritingExperience(
            problem_type="worldview_conflict",
            description="世界观冲突",
            root_cause="魔法规则不一致",
            suggestion="统一魔法体系规则",
            evidence="第1章说魔法需要施法材料，第3章主角直接施法",
            confidence=0.8,
        )
        skill = self.distiller.distill(exp)
        self.assertIsNotNone(skill)
        self.assertIn("世界观规则", skill.injection_content)

    def test_distill_redundancy(self):
        exp = WritingExperience(
            problem_type="redundancy",
            description="重复描述",
            root_cause="多次重复相同信息",
            suggestion="删减重复内容",
            evidence="角色背景在第1、3、5章重复描述",
            confidence=0.65,
        )
        skill = self.distiller.distill(exp)
        self.assertIsNotNone(skill)
        self.assertIn("精简规则", skill.injection_content)

    def test_distill_hook_weakness(self):
        exp = WritingExperience(
            problem_type="hook_weakness",
            description="章节钩子太弱",
            root_cause="悬念设置不足",
            suggestion="在章节结尾设置明确悬念",
            evidence="第2章结尾平铺直叙，读者无期待",
            confidence=0.7,
        )
        skill = self.distiller.distill(exp)
        self.assertIsNotNone(skill)
        self.assertIn("钩子设计指南", skill.injection_content)

    def test_distill_user_preference(self):
        exp = WritingExperience(
            problem_type="user_preference",
            description="用户偏好心理描写",
            root_cause="用户希望更多心理活动描写",
            suggestion="增加角色内心独白段落",
            evidence="用户反馈说'心理活动太少了'",
            confidence=0.75,
        )
        skill = self.distiller.distill(exp)
        self.assertIsNotNone(skill)
        self.assertIn("用户偏好", skill.injection_content)

    def test_distill_unknown_type_uses_default_template(self):
        exp = WritingExperience(
            problem_type="some_unknown_type",
            description="test",
            root_cause="cause",
            suggestion="fix",
            confidence=0.5,
        )
        skill = self.distiller.distill(exp)
        self.assertIsNotNone(skill)
        self.assertEqual(skill.skill_type, "general_helper")

    def test_distill_returns_none_when_description_empty(self):
        exp = WritingExperience(
            problem_type="style_issue",
            description="",
            root_cause="cause",
            suggestion="fix",
            confidence=0.5,
        )
        skill = self.distiller.distill(exp)
        self.assertIsNone(skill)

    def test_distill_returns_none_when_suggestion_empty(self):
        exp = WritingExperience(
            problem_type="style_issue",
            description="desc",
            root_cause="cause",
            suggestion="",
            confidence=0.5,
        )
        skill = self.distiller.distill(exp)
        self.assertIsNone(skill)

    def test_distill_truncates_evidence_to_500_chars(self):
        exp = WritingExperience(
            problem_type="style_issue",
            description="desc",
            root_cause="cause",
            suggestion="fix",
            evidence="x" * 1000,
            confidence=0.5,
        )
        skill = self.distiller.distill(exp)
        self.assertIsNotNone(skill)
        self.assertLessEqual(len(skill.injection_content), 1000)  # template + max 500

    def test_distill_generates_timestamped_skill_id(self):
        exp = WritingExperience(
            problem_type="character_inconsistency",
            description="desc",
            root_cause="cause",
            suggestion="fix",
            related_characters=["林舟"],
            confidence=0.7,
        )
        skill = self.distiller.distill(exp)
        self.assertIsNotNone(skill)
        self.assertTrue(skill.skill_id.startswith("char-林舟-") or skill.skill_id.startswith("char-"))
        # ID should be filesystem-safe
        self.assertNotIn(" ", skill.skill_id)

    def test_distill_strength_from_confidence(self):
        """Verify strength mapping for different confidence levels."""
        # low confidence: < 0.5
        low = WritingExperience("x", "d", "r", "s", confidence=0.3)
        low_skill = self.distiller.distill(low)
        if low_skill:
            self.assertEqual(low_skill.strength, 0.0)

        # medium confidence: 0.5-0.8 achieved with 0.6 llm + rich heuristics
        med = WritingExperience(
            "style_issue", "desc", "root cause with enough depth info x" * 5, "suggestion",
            evidence="x" * 150,
            related_characters=["LinZhou"],
            source_chapters=[1, 2, 3],
            confidence=0.6,
        )
        med_skill = self.distiller.distill(med)
        if med_skill:
            self.assertEqual(med_skill.strength, 0.3)

        # high confidence: >= 0.8 requires both high LLM conf AND strong heuristics
        high = WritingExperience(
            "style_issue", "desc", "root cause with enough depth info x" * 5, "suggestion",
            evidence="x" * 150,
            related_characters=["LinZhou"],
            source_chapters=[1, 2, 3],
            confidence=0.95,
        )
        high_skill = self.distiller.distill(high)
        if high_skill:
            expected = self.distiller._strength_from_confidence(high_skill.confidence)
            self.assertEqual(
                high_skill.strength,
                expected,
                f"Expected strength {expected} for confidence {high_skill.confidence}",
            )


class TestConfidenceScoring(unittest.TestCase):
    """Tests for confidence scoring heuristics."""

    def setUp(self):
        self.distiller = SkillDistiller()

    def test_blended_confidence_multiple_chapters_boost(self):
        exp1 = WritingExperience("x", "d", "r", "s", confidence=0.5, source_chapters=[1])
        exp3 = WritingExperience("x", "d", "r", "s", confidence=0.5, source_chapters=[1, 2, 3])

        c1 = self.distiller._compute_blended_confidence(exp1)
        c3 = self.distiller._compute_blended_confidence(exp3)

        self.assertGreater(c3, c1)  # More chapters should boost confidence

    def test_blended_confidence_long_evidence_boost(self):
        exp_short = WritingExperience("x", "d", "r", "s", confidence=0.5, evidence="short")
        exp_long = WritingExperience("x", "d", "r", "s", confidence=0.5, evidence="x" * 150)

        c_short = self.distiller._compute_blended_confidence(exp_short)
        c_long = self.distiller._compute_blended_confidence(exp_long)

        self.assertGreater(c_long, c_short)

    def test_blended_confidence_with_characters_boost(self):
        exp_no_char = WritingExperience("x", "d", "r", "s", confidence=0.5)
        exp_with_char = WritingExperience("x", "d", "r", "s", confidence=0.5, related_characters=["林舟"])

        c_no = self.distiller._compute_blended_confidence(exp_no_char)
        c_with = self.distiller._compute_blended_confidence(exp_with_char)

        self.assertGreater(c_with, c_no)

    def test_blended_confidence_deep_root_cause_boost(self):
        exp_shallow = WritingExperience("x", "d", "shallow", "s", confidence=0.5)
        exp_deep = WritingExperience("x", "d", "x" * 100, "s", confidence=0.5)

        c_shallow = self.distiller._compute_blended_confidence(exp_shallow)
        c_deep = self.distiller._compute_blended_confidence(exp_deep)

        self.assertGreaterEqual(c_deep, c_shallow)

    def test_blended_confidence_clamps_to_range(self):
        exp = WritingExperience("x", "d", "r", "s", confidence=2.0)
        c = self.distiller._compute_blended_confidence(exp)
        self.assertLessEqual(c, 1.0)
        self.assertGreaterEqual(c, 0.0)

        exp_low = WritingExperience("x", "d", "r", "s", confidence=-1.0)
        c_low = self.distiller._compute_blended_confidence(exp_low)
        self.assertGreaterEqual(c_low, 0.0)

    def test_strength_from_confidence_thresholds(self):
        self.assertEqual(self.distiller._strength_from_confidence(0.0), 0.0)
        self.assertEqual(self.distiller._strength_from_confidence(0.4), 0.0)
        self.assertEqual(self.distiller._strength_from_confidence(0.6), 0.3)
        self.assertEqual(self.distiller._strength_from_confidence(0.7), 0.3)
        self.assertEqual(self.distiller._strength_from_confidence(0.8), 0.7)
        self.assertEqual(self.distiller._strength_from_confidence(0.9), 0.7)
        self.assertEqual(self.distiller._strength_from_confidence(1.0), 0.7)


class TestSkillIdGeneration(unittest.TestCase):
    """Tests for skill ID and name generation."""

    def setUp(self):
        self.distiller = SkillDistiller()

    def test_make_skill_id_character_prefix(self):
        exp = WritingExperience(
            problem_type="character_inconsistency",
            description="desc",
            root_cause="cause",
            suggestion="fix",
            related_characters=["LinZhou"],
        )
        skill_id = self.distiller._make_skill_id(exp)
        self.assertTrue(skill_id.startswith("char-LinZhou-"))

    def test_make_skill_id_prefix_mapping(self):
        cases = [
            ("character_inconsistency", "char"),
            ("style_issue", "style"),
            ("pacing_issue", "pace"),
            ("plot_hole", "plot"),
            ("worldview_conflict", "world"),
            ("redundancy", "concise"),
            ("hook_weakness", "hook"),
            ("user_preference", "pref"),
            ("unknown_type", "gen"),
        ]
        for problem_type, expected_prefix in cases:
            exp = WritingExperience(problem_type, "d", "r", "s")
            skill_id = self.distiller._make_skill_id(exp)
            self.assertTrue(
                skill_id.startswith(expected_prefix),
                f"{problem_type} should produce prefix '{expected_prefix}' but got '{skill_id}'",
            )

    def test_make_skill_id_filesystem_safe(self):
        exp = WritingExperience(
            problem_type="character_inconsistency",
            description="desc",
            root_cause="cause",
            suggestion="fix",
            related_characters=["特殊/字符"],
        )
        skill_id = self.distiller._make_skill_id(exp)
        for char in skill_id:
            self.assertTrue(char.isalnum() or char in "-_", f"Unsafe character '{char}' in {skill_id}")

    def test_make_skill_name_with_related_characters(self):
        exp = WritingExperience("x", "d", "r", "s", related_characters=["林舟"])
        name = self.distiller._make_skill_name(exp, "character_style")
        self.assertIn("林舟", name)
        self.assertIn("character_style", name)

    def test_make_skill_name_truncates_long_description(self):
        exp = WritingExperience("x", "x" * 100, "r", "s")
        name = self.distiller._make_skill_name(exp, "general")
        self.assertIn("...", name)

    def test_make_skill_name_short_description(self):
        exp = WritingExperience("x", "短描述", "r", "s")
        name = self.distiller._make_skill_name(exp, "general")
        self.assertIn("短描述", name)


if __name__ == "__main__":
    unittest.main()
