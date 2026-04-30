"""测试：开始生成任务前的前置条件验证"""
from __future__ import annotations

from backend.models import Project
from tests.base import BaseWorkflowTestCase


class TestGenerationPreconditions(BaseWorkflowTestCase):
    """测试生成任务的前置条件验证逻辑"""

    def _create_project_with_exact_config(self, user, name, config):
        """创建项目时使用精确的 config 值（不做默认替换）"""
        db = self.SessionLocal()
        try:
            project = Project(
                user_id=user.id,
                name=name,
                description="demo",
                content_type="full_novel",
                status="draft",
                file_path=None,
                config=config,
            )
            db.add(project)
            db.commit()
            db.refresh(project)
            db.expunge(project)
            return project
        finally:
            db.close()

    def test_cannot_start_generation_without_config(self):
        """测试：完全没有 config 的项目不能开始生成"""
        user = self._create_user("testuser", "test@example.com")
        self._set_current_user(user)

        # 创建一个没有 config 的项目
        project = self._create_project_with_exact_config(
            user=user,
            name="Test Project",
            config=None,
        )

        # 尝试开始生成
        response = self.client.post(
            f"/api/projects/{project.id}/generate",
        )

        # 应该返回 400 错误，提示需要先完成配置
        self.assertEqual(response.status_code, 400)
        detail = response.json()["detail"]
        self.assertTrue("配置" in detail or "config" in detail)

    def test_cannot_start_generation_with_empty_config(self):
        """测试：config 为空对象时不能开始生成"""
        user = self._create_user("testuser", "test@example.com")
        self._set_current_user(user)

        # 创建一个有 config 但是是空的项目
        project = self._create_project_with_exact_config(
            user=user,
            name="Test Project",
            config={},
        )

        # 尝试开始生成
        response = self.client.post(
            f"/api/projects/{project.id}/generate",
        )

        # 应该返回 400 错误
        self.assertEqual(response.status_code, 400)

    def test_cannot_start_generation_without_core_requirement(self):
        """测试：只有名字但缺少核心需求时不能开始生成"""
        user = self._create_user("testuser", "test@example.com")
        self._set_current_user(user)

        project = self._create_project_with_exact_config(
            user=user,
            name="Test Project",
            config={
                "novel_name": "Test Novel",
                "chapter_word_count": 2000,
                "start_chapter": 1,
                "end_chapter": 3,
            },
        )

        response = self.client.post(
            f"/api/projects/{project.id}/generate",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("核心创作需求", response.json()["detail"])

    def test_plan_only_mode_still_requires_core_requirements(self):
        """测试：plan_only 也不能用空配置启动，否则策划会没有输入依据"""
        user = self._create_user("testuser", "test@example.com")
        self._set_current_user(user)

        project = self._create_project_with_exact_config(
            user=user,
            name="Test Project",
            config=None,
        )

        # 尝试只生成策划方案
        response = self.client.post(
            f"/api/projects/{project.id}/generate?plan_only=true",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("配置", response.json()["detail"])
