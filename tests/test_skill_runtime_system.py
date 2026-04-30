import shutil
import tempfile
import unittest
from pathlib import Path


class SkillRuntimeTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def write_skill(
        self,
        skill_id: str,
        *,
        applies_to=None,
        priority: int = 100,
        injection: str = "## Skill Body\n核心内容",
        safety_tags=None,
    ) -> Path:
        skill_dir = self.temp_dir / skill_id
        skill_dir.mkdir(parents=True)
        import yaml
        frontmatter = {
            "name": skill_id.replace("-", " ").title(),
            "description": "测试 Skill",
            "version": "1.0",
            "author": "tests",
            "applies_to": applies_to or ["planner", "writer", "revise"],
            "priority": priority,
            "tags": ["test"],
            "config_schema": {
                "strength": {
                    "type": "float",
                    "default": 0.7,
                    "min": 0.0,
                    "max": 1.0,
                }
            },
            "safety_tags": safety_tags or ["safe_for_all"],
            "dependencies": [],
        }
        skill_md_content = "---\n" + yaml.dump(frontmatter, allow_unicode=True) + "---\n\n" + injection
        (skill_dir / "SKILL.md").write_text(skill_md_content, encoding="utf-8")
        return skill_dir


class SkillRegistryTests(SkillRuntimeTestCase):
    def test_registry_scans_and_loads_skills(self):
        from backend.core.skill_runtime.skill_registry import SkillRegistry

        self.write_skill("skill-a", priority=50)
        self.write_skill("skill-b", priority=120)

        registry = SkillRegistry(self.temp_dir)
        skills = registry.list_skills()

        self.assertEqual([skill.id for skill in skills], ["skill-a", "skill-b"])
        self.assertEqual(registry.load_skill("skill-a").priority, 50)
        self.assertIsNone(registry.load_skill("missing"))

    def test_missing_skill_md_raises_error(self):
        from backend.core.skill_runtime.skill_registry import SkillRegistry, SkillValidationError

        skill_dir = self.temp_dir / "broken"
        skill_dir.mkdir()

        with self.assertRaises(SkillValidationError):
            SkillRegistry(self.temp_dir).load_skill("broken")

    def test_perspective_suffix_defaults_to_author_style_metadata(self):
        from backend.core.skill_runtime.skill_registry import SkillRegistry

        self.write_skill(
            "yu-hua-perspective",
            injection="## 风格DNA\n短句、冷静、少解释",
        )

        skill = SkillRegistry(self.temp_dir).load_skill("yu-hua-perspective")

        self.assertIn("perspective", skill.tags)
        self.assertIn("author-style", skill.tags)
        self.assertEqual(skill.priority, 50)


class SkillAssemblerTests(SkillRuntimeTestCase):
    def test_assembler_filters_overrides_and_sorts_by_priority(self):
        from backend.core.skill_runtime.skill_assembler import SkillAssembler
        from backend.core.skill_runtime.skill_registry import SkillRegistry

        self.write_skill("writer-only", applies_to=["writer"], priority=200)
        self.write_skill("planner-default", applies_to=["planner"], priority=50)

        registry = SkillRegistry(self.temp_dir)
        project_config = {
            "skills": {
                "enabled": [
                    {"skill_id": "writer-only", "config": {"strength": 0.9}},
                    {
                        "skill_id": "planner-default",
                        "applies_to_override": ["writer"],
                        "config": {"strength": 0.7},
                    },
                ]
            }
        }

        assembled = SkillAssembler(registry).assemble("writer", project_config=project_config)

        self.assertEqual([item.skill.id for item in assembled], ["planner-default", "writer-only"])
        self.assertTrue(all(item.rendered_content for item in assembled))

    def test_critic_can_receive_skills_when_explicitly_enabled(self):
        from backend.core.skill_runtime.skill_assembler import SkillAssembler
        from backend.core.skill_runtime.skill_registry import SkillRegistry

        self.write_skill("critic-requested", applies_to=["critic", "writer"])
        project_config = {
            "skills": {
                "enabled": [
                    {"skill_id": "critic-requested", "applies_to_override": ["critic"]}
                ]
            }
        }

        assembled = SkillAssembler(SkillRegistry(self.temp_dir)).assemble(
            "critic",
            project_config=project_config,
        )

        self.assertEqual(len(assembled), 1)
        self.assertEqual(assembled[0].skill.id, "critic-requested")

    def test_zero_strength_disables_skill(self):
        from backend.core.skill_runtime.skill_assembler import SkillAssembler
        from backend.core.skill_runtime.skill_registry import SkillRegistry

        self.write_skill("muted", applies_to=["writer"])
        project_config = {"skills": {"enabled": [{"skill_id": "muted", "config": {"strength": 0}}]}}

        assembled = SkillAssembler(SkillRegistry(self.temp_dir)).assemble("writer", project_config=project_config)

        self.assertEqual(assembled, [])

    def test_assembler_only_injects_first_author_style_skill(self):
        from backend.core.skill_runtime.skill_assembler import SkillAssembler
        from backend.core.skill_runtime.skill_registry import SkillRegistry

        self.write_skill("liu-cixin-perspective", injection="## 风格DNA\n宏大、理性、工程感")
        self.write_skill("yu-hua-perspective", injection="## 风格DNA\n冷静、短句、生活感")
        self.write_skill("continuity-helper", priority=80, injection="## 辅助规则\n保持时间线一致")
        project_config = {
            "skills": {
                "enabled": [
                    {"skill_id": "liu-cixin-perspective"},
                    {"skill_id": "yu-hua-perspective"},
                    {"skill_id": "continuity-helper"},
                ]
            }
        }

        assembled = SkillAssembler(SkillRegistry(self.temp_dir)).assemble("writer", project_config=project_config)

        self.assertEqual([item.skill.id for item in assembled], ["liu-cixin-perspective", "continuity-helper"])

    def test_assembler_keeps_author_style_injection_focused_under_budget(self):
        from backend.core.skill_runtime.skill_assembler import SkillAssembler
        from backend.core.skill_runtime.skill_registry import SkillRegistry

        long_sections = "\n\n".join(
            f"## 风格模块 {index}\n" + ("宏大叙事、冷静推演、尺度跳跃。\n" * 80)
            for index in range(1, 8)
        )
        self.write_skill("liu-cixin-perspective", injection=long_sections)
        project_config = {"skills": {"enabled": [{"skill_id": "liu-cixin-perspective", "config": {"strength": 1}}]}}

        assembled = SkillAssembler(SkillRegistry(self.temp_dir)).assemble("writer", project_config=project_config)

        self.assertEqual(len(assembled), 1)
        self.assertLessEqual(len(assembled[0].rendered_content), SkillAssembler.AUTHOR_STYLE_CHAR_BUDGET)

    def test_author_style_budget_prefers_expression_dna_over_usage_notes(self):
        from backend.core.skill_runtime.skill_assembler import SkillAssembler
        from backend.core.skill_runtime.skill_registry import SkillRegistry

        injection = (
            "## 使用说明\n" + ("一般说明。\n" * 1000) +
            "\n\n## 完整表达DNA\n短句。冷处理。动作先于解释。\n" +
            "\n\n## 创作启发式\n先让人物承受，再让情绪浮出水面。\n"
        )
        self.write_skill("yu-hua-perspective", injection=injection)
        project_config = {"skills": {"enabled": [{"skill_id": "yu-hua-perspective", "config": {"strength": 1}}]}}

        assembled = SkillAssembler(SkillRegistry(self.temp_dir)).assemble("writer", project_config=project_config)

        self.assertIn("完整表达DNA", assembled[0].rendered_content)
        self.assertIn("创作启发式", assembled[0].rendered_content)


class SkillInjectorTests(SkillRuntimeTestCase):
    def test_injector_adds_markers_and_replaces_placeholder(self):
        from backend.core.skill_runtime.skill_assembler import SkillAssembler
        from backend.core.skill_runtime.skill_injector import SkillInjector
        from backend.core.skill_runtime.skill_registry import SkillRegistry

        self.write_skill("skill-a", applies_to=["writer"], injection="### A\n内容A")
        project_config = {"skills": {"enabled": [{"skill_id": "skill-a"}]}}
        assembled = SkillAssembler(SkillRegistry(self.temp_dir)).assemble("writer", project_config=project_config)

        result = SkillInjector().inject("base\n{{skill_layer}}", assembled)

        self.assertIn("Skills Enabled", result)
        self.assertIn("### skill-a", result)
        self.assertIn("内容A", result)
        self.assertNotIn("{{skill_layer}}", result)

    def test_empty_layer_preserves_prompt_without_placeholder(self):
        from backend.core.skill_runtime.skill_injector import SkillInjector

        self.assertEqual(SkillInjector().inject("base", []), "base")

    def test_skill_layer_wraps_author_style_as_primary_style_not_roleplay(self):
        from backend.core.skill_runtime.skill_assembler import SkillAssembler
        from backend.core.skill_runtime.skill_injector import SkillInjector
        from backend.core.skill_runtime.skill_registry import SkillRegistry

        self.write_skill("liu-cixin-perspective", applies_to=["writer"], injection="## 风格DNA\n宏大、理性、工程感")
        project_config = {"skills": {"enabled": [{"skill_id": "liu-cixin-perspective"}]}}
        assembled = SkillAssembler(SkillRegistry(self.temp_dir)).assemble("writer", project_config=project_config)

        result = SkillInjector().inject("base\n{{skill_layer}}", assembled)

        self.assertIn("主作家风格", result)
        self.assertIn("不要扮演作者本人", result)
        self.assertIn("不得覆盖大纲、设定圣经、章节格式", result)


class SafetyFilterTests(unittest.TestCase):
    def test_safety_filter_removes_roleplay_and_blocked_terms(self):
        from backend.core.skill_runtime.safety_filter import SafetyFilter

        content = "你是某作家。\n保留这行。\n<!-- unsafe:start -->扮演内容<!-- unsafe:end -->\n政治立场"

        filtered = SafetyFilter().filter(content, mode="style_only")

        self.assertIn("保留这行", filtered)
        self.assertNotIn("你是", filtered)
        self.assertNotIn("扮演内容", filtered)
        self.assertNotIn("政治", filtered)


class SkillPromptIntegrationTests(unittest.TestCase):
    def test_load_prompt_removes_skill_placeholder_when_no_skills_enabled(self):
        from backend.utils.file_utils import load_prompt

        result = load_prompt("writer", project_config={})

        self.assertNotIn("{{skill_layer}}", result)

    def test_load_prompt_injects_project_skills_into_writer(self):
        from backend.utils.file_utils import load_prompt

        project_config = {
            "skills": {
                "enabled": [
                    {"skill_id": "liu-cixin-perspective", "config": {"strength": 0.8}},
                ]
            }
        }

        result = load_prompt("writer", project_config=project_config)

        self.assertIn("Skills Enabled", result)
        self.assertIn("### liu-cixin-perspective", result)
        self.assertIn("刘慈欣", result)

    def test_legacy_perspective_maps_to_skill_runtime_but_not_critic(self):
        from backend.utils.file_utils import load_prompt

        writer_prompt = load_prompt("writer", perspective="liu-cixin", perspective_strength=0.8)
        critic_prompt = load_prompt("critic", perspective="liu-cixin", perspective_strength=0.8)

        self.assertIn("### liu-cixin-perspective", writer_prompt)
        self.assertNotIn("### liu-cixin-perspective", critic_prompt)
        self.assertNotIn("评审视角：刘慈欣", critic_prompt)

    def test_revise_agent_delegates_prompt_context_to_call_volc_api(self):
        from unittest.mock import patch
        from backend.agents import revise_agent

        with patch("backend.agents.revise_agent.call_volc_api", return_value="修订后正文") as mock_call:
            revise_agent.revise_chapter(
                original_chapter="第1章\n原文",
                critic_issues=[{"type": "style_match", "location": "原文", "fix": "改短句"}],
                setting_bible="设定",
                project_config={"skills": {"enabled": [{"skill_id": "liu-cixin-perspective"}]}},
            )

        args, kwargs = mock_call.call_args
        self.assertEqual(args[0], "revise")
        self.assertIn("context", kwargs)
        self.assertEqual(kwargs["context"]["original_chapter"], "第1章\n原文")
        self.assertNotIn("{{original_chapter}}", args[1])
        self.assertNotIn("Skills Enabled", args[1])

    def test_critic_agent_delegates_prompt_context_to_call_volc_api(self):
        from unittest.mock import patch
        from backend.agents import critic_agent

        with patch("backend.agents.critic_agent.call_volc_api", return_value='{"passed": true, "score": 8, "dimensions": {}, "issues": [], "diagnostics": {}}') as mock_call:
            critic_agent.critic_chapter(
                chapter_content="第1章\n正文",
                setting_bible="设定",
                chapter_outline="大纲",
                project_config={"skills": {"enabled": [{"skill_id": "liu-cixin-perspective"}]}},
            )

        args, kwargs = mock_call.call_args
        self.assertEqual(args[0], "critic")
        self.assertIn("context", kwargs)
        self.assertEqual(kwargs["context"]["chapter_content"], "第1章\n正文")
        self.assertNotIn("{{chapter_content}}", args[1])
        self.assertNotIn("Skills Enabled", args[1])


if __name__ == "__main__":
    unittest.main()
