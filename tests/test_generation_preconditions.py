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

    def test_config_has_any_fields_can_start(self):
        """测试：config 有内容时可以开始生成"""
        user = self._create_user("testuser", "test@example.com")
        self._set_current_user(user)

        # 创建有基本配置的项目（即使只有一个字段也可以）
        project = self._create_project_with_exact_config(
            user=user,
            name="Test Project",
            config={
                "novel_name": "Test Novel",
            },
        )

        # 尝试开始生成
        response = self.client.post(
            f"/api/projects/{project.id}/generate",
        )

        # 应该不因为配置问题失败（可能因为 Celery 未配置返回 501，但不会是 400 配置错误）
        if response.status_code == 400:
            detail = response.json().get("detail", "")
            self.assertNotIn("配置", detail)
            self.assertNotIn("config", detail)

    def test_plan_only_mode_no_config_check(self):
        """测试：plan_only=True 时应该允许生成（因为就是要生成策划方案）"""
        user = self._create_user("testuser", "test@example.com")
        self._set_current_user(user)

        # 创建一个完全没有配置的项目
        project = self._create_project_with_exact_config(
            user=user,
            name="Test Project",
            config=None,
        )

        # 尝试只生成策划方案
        response = self.client.post(
            f"/api/projects/{project.id}/generate?plan_only=true",
        )

        # 应该允许，因为策划模式就是用来生成初始配置的
        if response.status_code == 400:
            detail = response.json().get("detail", "")
            self.assertNotIn("配置", detail)
            self.assertNotIn("config", detail)
