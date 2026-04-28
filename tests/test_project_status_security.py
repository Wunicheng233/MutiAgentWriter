"""
项目状态字段安全测试
验证用户不能通过 API 直接修改项目 status 字段
"""

import unittest

from backend.main import app


class TestProjectStatusSecurity(unittest.TestCase):
    """测试项目状态字段的安全性"""

    def setUp(self):
        """测试前的准备工作"""
        from tests.base import BaseWorkflowTestCase
        self.base = BaseWorkflowTestCase()
        self.base.setUp()
        self.client = self.base.client

    def tearDown(self):
        """测试后的清理工作"""
        self.base.tearDown()

    def test_project_update_cannot_change_status(self):
        """测试：不能通过 PATCH /projects/{id} 直接修改 status 字段"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 创建用户和项目
            user = self.base._create_user("testuser", "test@example.com")
            self.base._set_current_user(user)

            project = self.base._create_project(owner=user, name="Test Project")
            self.assertEqual(project.status, 'draft')

            # WHEN: 用户尝试将 status 改为 completed，同时修改 name
            response = self.client.put(
                f"/api/projects/{project.id}",
                json={"status": "completed", "name": "new name"}
            )

            # THEN: name 应该被修改，但 status 保持不变
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['status'], 'draft')  # 不变
            self.assertEqual(response.json()['name'], 'new name')  # 变了

            # 验证数据库中的状态也没有改变
            db_project = db.query(type(project)).filter(type(project).id == project.id).first()
            self.assertEqual(db_project.status, 'draft')
        finally:
            db.close()

    def test_project_update_can_change_other_fields(self):
        """测试：可以正常修改除 status 外的其他字段"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 创建用户和项目
            user = self.base._create_user("testuser2", "test2@example.com")
            self.base._set_current_user(user)

            project = self.base._create_project(owner=user, name="Test Project 2")
            self.assertEqual(project.status, 'draft')

            # WHEN: 用户尝试修改 description
            response = self.client.put(
                f"/api/projects/{project.id}",
                json={"description": "new description"}
            )

            # THEN: 应该成功修改
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['description'], 'new description')
        finally:
            db.close()


if __name__ == '__main__':
    unittest.main()
