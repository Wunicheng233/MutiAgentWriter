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

    def test_delete_project_handles_active_and_completed_tasks(self):
        """测试：删除项目时活跃任务应该被取消

        注意：由于部分唯一索引约束，同一项目不能同时有多个活跃任务。
        测试验证：
        - 删除项目时活跃任务会被取消
        - 已完成的任务不会被处理
        """
        db = self.base.SessionLocal()
        try:
            # GIVEN: 创建用户、项目
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

            # GIVEN: 一个活跃任务和两个已完成任务
            # 由于部分唯一索引约束，同一项目只能有一个活跃任务
            completed_tasks = ["task-done-1", "task-done-2"]
            for task_id in completed_tasks:
                task = GenerationTask(
                    project_id=project.id,
                    celery_task_id=task_id,
                    status="success",
                )
                db.add(task)
            db.commit()

            active_task_id = "task-active-1"
            active_task = GenerationTask(
                project_id=project.id,
                celery_task_id=active_task_id,
                status="pending",
            )
            db.add(active_task)
            db.commit()

            with patch('celery_app.celery_app.control.revoke') as mock_revoke:
                # WHEN: 删除项目
                response = self.client.delete(
                    f"/api/projects/{project.id}"
                )

                # THEN: 应该成功删除
                self.assertEqual(response.status_code, 200)

                # THEN: 只有活跃任务被 revoke，已完成任务不会被处理
                self.assertEqual(mock_revoke.call_count, 1)
                called_task_ids = [call[0][0] for call in mock_revoke.call_args_list]
                self.assertEqual(called_task_ids, [active_task_id])
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
