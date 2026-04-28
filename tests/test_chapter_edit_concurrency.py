"""
测试：章节正在生成时禁止编辑
防止并发写入导致数据丢失
"""

import unittest

from backend.main import app
from backend.models import Chapter, GenerationTask


class TestChapterEditConcurrency(unittest.TestCase):
    """测试章节编辑的并发安全性"""

    def setUp(self):
        """测试前的准备工作"""
        from tests.base import BaseWorkflowTestCase
        self.base = BaseWorkflowTestCase()
        self.base.setUp()
        self.client = self.base.client

    def tearDown(self):
        """测试后的清理工作"""
        self.base.tearDown()

    def test_cannot_edit_chapter_while_generating(self):
        """测试：项目正在生成章节时，用户不能编辑该章节"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 一个项目，一个章节，项目正在生成中
            user = self.base._create_user("testuser", "test@example.com")
            self.base._set_current_user(user)

            project = self.base._create_project(owner=user, name="Test Project")
            project.status = "generating"
            db.add(project)
            db.commit()
            db.refresh(project)

            chapter = Chapter(
                project_id=project.id,
                chapter_index=0,
                title="Chapter 1",
                content="Original content",
                status="generated",
            )
            db.add(chapter)
            db.commit()
            db.refresh(chapter)

            # 添加一个运行中的任务，当前正在处理第 0 章
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="test-task-123",
                status="progress",
                current_chapter=0,  # 正在生成第 0 章
            )
            db.add(task)
            db.commit()

            # WHEN: 用户尝试编辑正在生成的章节
            response = self.client.put(
                f"/api/projects/{project.id}/chapters/{chapter.chapter_index}",
                json={
                    "title": "Edited title",
                    "content": "Edited content",
                },
            )

            # THEN: 应该返回 409 冲突错误
            self.assertEqual(response.status_code, 409)
            detail = response.json()['detail']
            self.assertTrue("正在生成" in detail or "generating" in detail)
        finally:
            db.close()

    def test_can_edit_chapter_when_not_generating(self):
        """测试：项目不在生成状态时，可以正常编辑章节"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 一个项目，一个章节，项目是 completed 状态
            user = self.base._create_user("testuser2", "test2@example.com")
            self.base._set_current_user(user)

            project = self.base._create_project(owner=user, name="Test Project")
            project.status = "completed"
            db.add(project)
            db.commit()
            db.refresh(project)

            chapter = Chapter(
                project_id=project.id,
                chapter_index=0,
                title="Chapter 1",
                content="Original content",
                status="generated",
            )
            db.add(chapter)
            db.commit()
            db.refresh(chapter)

            # WHEN: 用户编辑章节
            response = self.client.put(
                f"/api/projects/{project.id}/chapters/{chapter.chapter_index}",
                json={
                    "title": "Edited title",
                    "content": "Edited content",
                },
            )

            # THEN: 应该成功
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['title'], "Edited title")
        finally:
            db.close()

    def test_can_edit_other_chapter_while_generating(self):
        """测试：正在生成第 0 章时，可以编辑其他章节"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 一个项目，两个章节，正在生成第 0 章
            user = self.base._create_user("testuser3", "test3@example.com")
            self.base._set_current_user(user)

            project = self.base._create_project(owner=user, name="Test Project")
            project.status = "generating"
            db.add(project)
            db.commit()
            db.refresh(project)

            # 章节 0：正在生成
            chapter0 = Chapter(
                project_id=project.id,
                chapter_index=0,
                title="Chapter 1",
                content="Content 1",
                status="generated",
            )
            # 章节 1：不在生成
            chapter1 = Chapter(
                project_id=project.id,
                chapter_index=1,
                title="Chapter 2",
                content="Content 2",
                status="generated",
            )
            db.add_all([chapter0, chapter1])
            db.commit()

            # 添加一个运行中的任务，当前正在处理第 0 章
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="test-task-123",
                status="progress",
                current_chapter=0,
            )
            db.add(task)
            db.commit()

            # WHEN: 用户尝试编辑第 1 章（不是正在生成的章节）
            response = self.client.put(
                f"/api/projects/{project.id}/chapters/1",
                json={
                    "title": "Edited Chapter 2",
                    "content": "Edited content 2",
                },
            )

            # THEN: 应该可以编辑（允许编辑其他章节）
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['title'], "Edited Chapter 2")
        finally:
            db.close()

    def test_cannot_restore_version_while_generating(self):
        """测试：章节正在生成时，不能恢复版本"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 一个项目，一个章节，项目正在生成中
            user = self.base._create_user("testuser4", "test4@example.com")
            self.base._set_current_user(user)

            project = self.base._create_project(owner=user, name="Test Project")
            project.status = "generating"
            db.add(project)
            db.commit()
            db.refresh(project)

            chapter = Chapter(
                project_id=project.id,
                chapter_index=0,
                title="Chapter 1",
                content="Original content",
                status="generated",
            )
            db.add(chapter)
            db.commit()
            db.refresh(chapter)

            # 创建一个版本
            from backend.models import ChapterVersion
            version = ChapterVersion(
                chapter_id=chapter.id,
                version_number=1,
                content="Old version content",
                word_count=10,
            )
            db.add(version)
            db.commit()
            db.refresh(version)

            # 添加一个运行中的任务，当前正在处理第 0 章
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="test-task-123",
                status="progress",
                current_chapter=0,
            )
            db.add(task)
            db.commit()

            # WHEN: 用户尝试恢复版本
            response = self.client.post(
                f"/api/projects/{project.id}/chapters/{chapter.chapter_index}/versions/{version.id}/restore",
            )

            # THEN: 应该返回 409 冲突错误
            self.assertEqual(response.status_code, 409)
        finally:
            db.close()


if __name__ == '__main__':
    unittest.main()
