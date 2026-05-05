import unittest
from fastapi.testclient import TestClient

from backend.main import app
from tests.base import BaseWorkflowTestCase


class SkillAPITests(BaseWorkflowTestCase):
    def test_list_skills_endpoint_returns_builtin_skills(self):
        response = self.client.get("/api/skills")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("skills", data)
        skill_ids = {skill["id"] for skill in data["skills"]}
        self.assertIn("liu-cixin-perspective", skill_ids)

    def test_list_skills_includes_required_fields(self):
        """Test that each skill summary includes all required schema fields."""
        response = self.client.get("/api/skills")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        for skill in data["skills"]:
            self.assertIn("id", skill)
            self.assertIn("name", skill)
            self.assertIn("description", skill)
            self.assertIn("version", skill)
            self.assertIn("author", skill)
            self.assertIn("applies_to", skill)
            self.assertIn("priority", skill)
            self.assertIn("tags", skill)
            self.assertIn("config_schema", skill)
            self.assertIn("safety_tags", skill)
            self.assertIn("dependencies", skill)

    def test_update_project_skills_requires_authentication(self):
        response = self.client.post(
            "/api/projects/1/skills",
            json={"enabled": [{"skill_id": "liu-cixin-perspective"}]},
        )

        self.assertEqual(response.status_code, 401)

    def test_update_project_skills_with_valid_skill_succeeds(self):
        """Test enabling a valid skill with proper authentication."""
        owner = self._create_user("skill_owner", "skill_owner@example.com")
        project = self._create_project(owner, name="Skill Test Novel")
        self._set_current_user(owner)

        response = self.client.post(
            f"/api/projects/{project.id}/skills",
            json={"enabled": [{"skill_id": "liu-cixin-perspective"}]},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("config", data)
        skills_config = data["config"].get("skills", {})
        self.assertIn("enabled", skills_config)
        self.assertEqual(len(skills_config["enabled"]), 1)
        self.assertEqual(skills_config["enabled"][0]["skill_id"], "liu-cixin-perspective")

    def test_create_project_rejects_blank_required_fields(self):
        """创建项目不能只靠空白字符串绕过前端必填。"""
        owner = self._create_user("blank_project_owner", "blank_project_owner@example.com")
        self._set_current_user(owner)

        response = self.client.post(
            "/api/projects",
            json={
                "name": "   ",
                "core_requirement": "   ",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("作品名称", response.json()["detail"])

    def test_create_project_rejects_invalid_generation_numbers(self):
        """创建项目时拒绝会导致生成流程不确定的章节与字数参数。"""
        owner = self._create_user("invalid_numbers_owner", "invalid_numbers_owner@example.com")
        self._set_current_user(owner)

        response = self.client.post(
            "/api/projects",
            json={
                "name": "Invalid Numbers Novel",
                "core_requirement": "写一个正常故事",
                "chapter_word_count": 0,
                "start_chapter": 4,
                "end_chapter": 1,
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("每章字数", response.json()["detail"])

    def test_create_project_persists_initial_skill_config(self):
        """创建项目时可以直接保存初始作家风格 Skill。"""
        owner = self._create_user("skill_create_owner", "skill_create_owner@example.com")
        self._set_current_user(owner)

        response = self.client.post(
            "/api/projects",
            json={
                "name": "Skill Create Novel",
                "core_requirement": "写一个科幻故事",
                "config": {
                    "skills": {
                        "enabled": [
                            {
                                "skill_id": "liu-cixin-perspective",
                                "applies_to_override": ["planner", "writer", "revise"],
                                "config": {"strength": 0.7, "mode": "style_only"},
                            }
                        ]
                    }
                },
            },
        )

        self.assertEqual(response.status_code, 201)
        skills_config = response.json()["config"].get("skills", {})
        self.assertEqual(
            skills_config["enabled"],
            [
                {
                    "skill_id": "liu-cixin-perspective",
                    "applies_to_override": ["planner", "writer", "revise"],
                    "config": {"strength": 0.7, "mode": "style_only"},
                }
            ],
        )

    def test_create_project_rejects_multiple_initial_author_styles(self):
        """创建项目时也必须遵守单主作家风格限制。"""
        owner = self._create_user("skill_create_limit_owner", "skill_create_limit_owner@example.com")
        self._set_current_user(owner)

        response = self.client.post(
            "/api/projects",
            json={
                "name": "Skill Create Limit Novel",
                "core_requirement": "写一个现实主义故事",
                "config": {
                    "skills": {
                        "enabled": [
                            {"skill_id": "liu-cixin-perspective"},
                            {"skill_id": "yu-hua-perspective"},
                        ]
                    }
                },
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("只能启用一个作家风格", response.json()["detail"])

    def test_update_project_skills_rejects_nonexistent_skill(self):
        """Test that enabling a non-existent skill returns appropriate error."""
        owner = self._create_user("skill_owner2", "skill_owner2@example.com")
        project = self._create_project(owner, name="Skill Test Novel 2")
        self._set_current_user(owner)

        response = self.client.post(
            f"/api/projects/{project.id}/skills",
            json={"enabled": [{"skill_id": "nonexistent-skill-12345"}]},
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)
        self.assertIn("Skill 不存在", data["detail"])

    def test_update_project_skills_with_config(self):
        """Test enabling a skill with custom configuration."""
        owner = self._create_user("skill_owner3", "skill_owner3@example.com")
        project = self._create_project(owner, name="Skill Test Novel 3")
        self._set_current_user(owner)

        response = self.client.post(
            f"/api/projects/{project.id}/skills",
            json={
                "enabled": [
                    {
                        "skill_id": "liu-cixin-perspective",
                        "config": {"intensity": "high", "style": "epic"},
                    }
                ]
            },
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        skills_config = data["config"].get("skills", {})
        enabled_skill = skills_config["enabled"][0]
        self.assertEqual(enabled_skill["config"], {"intensity": "high", "style": "epic"})

    def test_update_project_skills_rejects_multiple_author_styles(self):
        """同一项目只能有一个主作家风格，避免文风指令互相抵消。"""
        owner = self._create_user("skill_owner_style_limit", "skill_owner_style_limit@example.com")
        project = self._create_project(owner, name="Skill Style Limit Novel")
        self._set_current_user(owner)

        response = self.client.post(
            f"/api/projects/{project.id}/skills",
            json={
                "enabled": [
                    {"skill_id": "liu-cixin-perspective"},
                    {"skill_id": "yu-hua-perspective"},
                ]
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("只能启用一个作家风格", response.json()["detail"])

    def test_update_project_skills_empty_list_clears_skills(self):
        """Test that an empty enabled list clears project skills."""
        owner = self._create_user("skill_owner4", "skill_owner4@example.com")
        project = self._create_project(owner, name="Skill Test Novel 4")
        self._set_current_user(owner)

        # First, enable a skill
        response = self.client.post(
            f"/api/projects/{project.id}/skills",
            json={"enabled": [{"skill_id": "liu-cixin-perspective"}]},
        )
        self.assertEqual(response.status_code, 200)

        # Then, clear all skills
        response = self.client.post(
            f"/api/projects/{project.id}/skills",
            json={"enabled": []},
        )
        self.assertEqual(response.status_code, 200)

        data = response.json()
        skills_config = data["config"].get("skills", {})
        self.assertEqual(skills_config["enabled"], [])


if __name__ == "__main__":
    unittest.main()
