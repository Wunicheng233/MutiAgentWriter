"""测试：协作者角色权限控制"""
import unittest

from backend.models import Project, ProjectCollaborator, Chapter
from tests.base import BaseWorkflowTestCase


class CollaboratorRolePermissionTests(BaseWorkflowTestCase):
    """测试协作者角色权限控制"""

    def setUp(self):
        super().setUp()
        # 创建两个用户
        self.user1 = self._create_user("user1", "user1@example.com")
        self.user2 = self._create_user("user2", "user2@example.com")
        # 创建项目（user1 是所有者）
        self.project = self._create_project(
            owner=self.user1,
            name="Test Project",
            config={"genre": "fantasy", "novel_name": "Test Novel"},
        )

    def test_viewer_cannot_trigger_generation(self):
        """测试：viewer 角色协作者不能触发生成任务"""
        # 添加协作者，角色是 viewer
        db = self.SessionLocal()
        try:
            collaborator = ProjectCollaborator(
                project_id=self.project.id,
                user_id=self.user2.id,
                role="viewer",
            )
            db.add(collaborator)
            db.commit()
        finally:
            db.close()

        # 以 viewer 身份访问
        self._set_current_user(self.user2)

        # 尝试触发生成任务
        response = self.client.post(
            f"/api/projects/{self.project.id}/generate?plan_only=True",
        )

        # 应该返回 403 Forbidden
        self.assertEqual(response.status_code, 403)

    def test_editor_can_trigger_generation(self):
        """测试：editor 角色协作者可以触发生成任务"""
        # 添加协作者，角色是 editor
        db = self.SessionLocal()
        try:
            collaborator = ProjectCollaborator(
                project_id=self.project.id,
                user_id=self.user2.id,
                role="editor",
            )
            db.add(collaborator)
            db.commit()
        finally:
            db.close()

        # 以 editor 身份访问
        self._set_current_user(self.user2)

        # 尝试触发生成任务
        response = self.client.post(
            f"/api/projects/{self.project.id}/generate?plan_only=True",
        )

        # 应该允许（至少不因为权限问题拒绝，可能返回 501 因为 Celery 未配置）
        self.assertNotEqual(response.status_code, 403)
        # 不是 404
        self.assertNotEqual(response.status_code, 404)

    def test_owner_can_always_trigger_generation(self):
        """测试：所有者始终可以触发生成任务"""
        # 以所有者身份访问
        self._set_current_user(self.user1)

        # 尝试触发生成
        response = self.client.post(
            f"/api/projects/{self.project.id}/generate?plan_only=True",
        )

        # 应该允许（至少不因为权限问题拒绝）
        self.assertNotEqual(response.status_code, 403)
        self.assertNotEqual(response.status_code, 404)

    def test_viewer_cannot_trigger_export(self):
        """测试：viewer 角色协作者不能触发导出"""
        # 先添加章节
        db = self.SessionLocal()
        try:
            chapter = Chapter(
                project_id=self.project.id,
                chapter_index=1,
                title="Chapter 1",
                content="Content",
                status="generated",
            )
            db.add(chapter)

            # 添加协作者，角色是 viewer
            collaborator = ProjectCollaborator(
                project_id=self.project.id,
                user_id=self.user2.id,
                role="viewer",
            )
            db.add(collaborator)
            db.commit()
        finally:
            db.close()

        # 以 viewer 身份访问
        self._set_current_user(self.user2)

        # 尝试触发导出
        response = self.client.post(
            f"/api/projects/{self.project.id}/export?format=epub",
        )

        # 应该返回 403 Forbidden
        self.assertEqual(response.status_code, 403)

    def test_viewer_can_read_project(self):
        """测试：viewer 角色可以正常读取项目（只读权限）"""
        # 添加协作者，角色是 viewer
        db = self.SessionLocal()
        try:
            collaborator = ProjectCollaborator(
                project_id=self.project.id,
                user_id=self.user2.id,
                role="viewer",
            )
            db.add(collaborator)
            db.commit()
        finally:
            db.close()

        # 以 viewer 身份访问
        self._set_current_user(self.user2)

        # 获取项目详情
        response = self.client.get(
            f"/api/projects/{self.project.id}",
        )

        # 应该允许读取
        self.assertEqual(response.status_code, 200)

    def test_viewer_can_list_chapters(self):
        """测试：viewer 角色可以列出章节"""
        # 添加章节和协作者
        db = self.SessionLocal()
        try:
            chapter = Chapter(
                project_id=self.project.id,
                chapter_index=1,
                title="Chapter 1",
                content="Content",
                status="generated",
            )
            db.add(chapter)

            collaborator = ProjectCollaborator(
                project_id=self.project.id,
                user_id=self.user2.id,
                role="viewer",
            )
            db.add(collaborator)
            db.commit()
        finally:
            db.close()

        # 以 viewer 身份访问
        self._set_current_user(self.user2)

        # 列出章节
        response = self.client.get(
            f"/api/projects/{self.project.id}/chapters",
        )

        # 应该允许读取
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
