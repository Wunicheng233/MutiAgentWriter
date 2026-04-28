"""测试：删除项目时应该取消所有运行中的 Celery 任务"""
import unittest
from unittest.mock import patch, MagicMock

from backend.models import Project, GenerationTask


class TestProjectDeleteTaskCancel(unittest.TestCase):
    """测试删除项目时取消运行中的 Celery 任务"""

    def setUp(self):
        """测试前的准备工作"""
        from tests.base import BaseWorkflowTestCase
        self.base = BaseWorkflowTestCase()
        self.base.setUp()
        self.client = self.base.client

    def tearDown(self):
        """测试后的清理工作"""
        self.base.tearDown()

    def test_delete_project_cancels_running_tasks(self):
        """测试：删除项目时应该取消所有运行中的任务"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 创建用户、项目和一个运行中的 GenerationTask
            user = self.base._create_user("testuser", "test@example.com")
            self.base._set_current_user(user)

            project = Project(
                name="Test Project",
                user_id=user.id,
                status="generating",
            )
            db.add(project)
            db.commit()
            db.refresh(project)

            task = GenerationTask(
                project_id=project.id,
                celery_task_id="test-celery-task-123",
                status="progress",
                progress=0.5,
            )
            db.add(task)
            db.commit()

            # 监视 celery.control.revoke 方法
            with patch('celery_app.celery_app.control.revoke') as mock_revoke:
                # WHEN: 删除项目
                response = self.client.delete(
                    f"/api/projects/{project.id}"
                )

                # THEN: 应该成功删除
                self.assertEqual(response.status_code, 200)

                # THEN: revoke 应该被调用，使用 terminate=True
                mock_revoke.assert_called_once_with(
                    "test-celery-task-123",
                    terminate=True,
                    signal='SIGTERM'
                )
        finally:
            db.close()

    def test_delete_project_handles_multiple_tasks(self):
        """测试：删除项目时有多个运行中的任务应该全部取消"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 创建用户、项目和多个运行任务
            user = self.base._create_user("testuser2", "test2@example.com")
            self.base._set_current_user(user)

            project = Project(
                name="Test Project",
                user_id=user.id,
                status="generating",
            )
            db.add(project)
            db.commit()
            db.refresh(project)

            # 多个任务
            task_ids = ["task-1", "task-2", "task-3"]
            for task_id in task_ids:
                task = GenerationTask(
                    project_id=project.id,
                    celery_task_id=task_id,
                    status="pending",
                )
                db.add(task)
            db.commit()

            with patch('celery_app.celery_app.control.revoke') as mock_revoke:
                # WHEN: 删除项目
                response = self.client.delete(
                    f"/api/projects/{project.id}"
                )

                # THEN: 应该成功删除
                self.assertEqual(response.status_code, 200)

                # THEN: 每个任务都被 revoke
                self.assertEqual(mock_revoke.call_count, 3)
                called_task_ids = [call[0][0] for call in mock_revoke.call_args_list]
                self.assertEqual(set(called_task_ids), set(task_ids))
        finally:
            db.close()

    def test_delete_project_no_tasks(self):
        """测试：删除没有运行任务的项目应该正常工作"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 创建用户、一个没有任何任务的项目
            user = self.base._create_user("testuser3", "test3@example.com")
            self.base._set_current_user(user)

            project = Project(
                name="Test Project",
                user_id=user.id,
                status="draft",
            )
            db.add(project)
            db.commit()
            db.refresh(project)

            with patch('celery_app.celery_app.control.revoke') as mock_revoke:
                # WHEN: 删除项目
                response = self.client.delete(
                    f"/api/projects/{project.id}"
                )

                # THEN: 应该成功删除
                self.assertEqual(response.status_code, 200)

                # THEN: revoke 不应该被调用
                mock_revoke.assert_not_called()
        finally:
            db.close()


if __name__ == '__main__':
    unittest.main()
