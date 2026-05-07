"""
分享链接撤销 API 测试
验证项目所有者可以撤销分享链接，协作者不能撤销，以及撤销后链接失效
"""

import unittest
import secrets
import datetime

from backend.main import app
from backend.models import ShareLink, Chapter


class TestShareLinkRevoke(unittest.TestCase):
    """测试分享链接撤销功能"""

    def setUp(self):
        """测试前的准备工作"""
        from tests.base import BaseWorkflowTestCase
        self.base = BaseWorkflowTestCase()
        self.base.setUp()
        self.client = self.base.client

    def tearDown(self):
        """测试后的清理工作"""
        self.base.tearDown()

    def test_owner_can_revoke_share_link(self):
        """测试：项目所有者可以撤销分享链接"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 一个项目和一个有效的分享链接
            user = self.base._create_user("testowner", "owner@example.com")
            self.base._set_current_user(user)

            project = self.base._create_project(owner=user, name="Test Project")

            share_token = secrets.token_urlsafe(32)
            share = ShareLink(
                project_id=project.id,
                share_token=share_token,
                is_active=True,
            )
            db.add(share)
            db.commit()
            db.refresh(share)

            # BEFORE: 分享链接有效
            response = self.client.get(f"/api/share/{share_token}")
            self.assertEqual(response.status_code, 200)

            # WHEN: 所有者撤销分享链接
            response = self.client.delete(
                f"/api/projects/{project.id}/share",
            )

            # THEN: 应该成功撤销（204 No Content）
            self.assertEqual(response.status_code, 204)

            # THEN: 分享链接不再有效（应该返回 404）
            response = self.client.get(f"/api/share/{share_token}")
            self.assertEqual(response.status_code, 404)

            # THEN: 数据库中 is_active 应为 False
            # 使用新的 session 查询以避免缓存问题
            db2 = self.base.SessionLocal()
            try:
                db_share = db2.query(ShareLink).filter(ShareLink.id == share.id).first()
                self.assertFalse(db_share.is_active)
            finally:
                db2.close()
        finally:
            db.close()

    def test_collaborator_cannot_revoke_share_link(self):
        """测试：协作者不能撤销分享链接"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 项目所有者创建分享链接
            owner = self.base._create_user("testowner2", "owner2@example.com")
            collaborator = self.base._create_user("collaborator", "collab@example.com")

            project = self.base._create_project(owner=owner, name="Test Project 2")

            share_token = secrets.token_urlsafe(32)
            share = ShareLink(
                project_id=project.id,
                share_token=share_token,
                is_active=True,
            )
            db.add(share)
            db.commit()

            # WHEN: 协作者（不是所有者）尝试撤销
            self.base._set_current_user(collaborator)
            response = self.client.delete(
                f"/api/projects/{project.id}/share",
            )

            # THEN: 应该被拒绝（协作者没有所有者权限，返回404）
            self.assertEqual(response.status_code, 404)

            # THEN: 分享链接仍然有效
            response = self.client.get(f"/api/share/{share_token}")
            self.assertEqual(response.status_code, 200)
        finally:
            db.close()

    def test_revoke_nonexistent_share_link(self):
        """测试：撤销不存在的分享链接应该返回 404"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 一个没有分享链接的项目
            user = self.base._create_user("testuser3", "user3@example.com")
            self.base._set_current_user(user)

            project = self.base._create_project(owner=user, name="Test Project 3")

            # WHEN: 尝试撤销不存在的分享链接
            response = self.client.delete(
                f"/api/projects/{project.id}/share",
            )

            # THEN: 应该返回 404
            self.assertEqual(response.status_code, 404)
        finally:
            db.close()

    def test_revoke_already_inactive_share_link(self):
        """测试：撤销已失效的分享链接应该正常返回（幂等操作）"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 一个已被标记为 inactive 的分享链接
            user = self.base._create_user("testuser4", "user4@example.com")
            self.base._set_current_user(user)

            project = self.base._create_project(owner=user, name="Test Project 4")

            share_token = secrets.token_urlsafe(32)
            share = ShareLink(
                project_id=project.id,
                share_token=share_token,
                is_active=False,  # 已经失效
            )
            db.add(share)
            db.commit()

            # WHEN: 尝试撤销
            response = self.client.delete(
                f"/api/projects/{project.id}/share",
            )

            # THEN: 应该成功（幂等操作，返回204）
            self.assertEqual(response.status_code, 204)
        finally:
            db.close()

    def test_share_link_chapter_endpoint_respects_is_active(self):
        """测试：公开访问章节内容时也需要检查 is_active"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 一个项目、分享链接和章节
            user = self.base._create_user("testuser5", "user5@example.com")
            self.base._set_current_user(user)

            project = self.base._create_project(owner=user, name="Test Project 5")

            share_token = secrets.token_urlsafe(32)
            share = ShareLink(
                project_id=project.id,
                share_token=share_token,
                is_active=True,
            )
            db.add(share)

            # 添加章节
            chapter = Chapter(
                project_id=project.id,
                chapter_index=1,
                title="Chapter 1",
                content="Test content",
            )
            db.add(chapter)
            db.commit()

            # BEFORE: 章节访问有效
            response = self.client.get(f"/api/share/{share_token}/chapters/1")
            self.assertEqual(response.status_code, 200)

            # WHEN: 撤销分享链接
            response = self.client.delete(
                f"/api/projects/{project.id}/share",
            )
            self.assertEqual(response.status_code, 204)

            # THEN: 章节访问不再有效
            response = self.client.get(f"/api/share/{share_token}/chapters/1")
            self.assertEqual(response.status_code, 404)
        finally:
            db.close()

    def test_owner_can_create_share_link_with_custom_expiration_and_view_stats(self):
        """测试：创建分享链接时可以设置有效期，公开访问会累计访问次数"""
        db = self.base.SessionLocal()
        try:
            user = self.base._create_user("share_stats_owner", "share_stats@example.com")
            self.base._set_current_user(user)
            project = self.base._create_project(owner=user, name="Stats Project")

            response = self.client.post(
                f"/api/projects/{project.id}/share",
                json={"expires_in_days": 30},
            )
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["view_count"], 0)
            expires_at = datetime.datetime.fromisoformat(payload["expires_at"].replace("Z", "+00:00"))
            delta = expires_at.replace(tzinfo=None) - datetime.datetime.utcnow()
            self.assertGreater(delta.days, 28)
            self.assertLess(delta.days, 31)

            self.client.get(f"/api/share/{payload['share_token']}")
            self.client.get(f"/api/share/{payload['share_token']}")

            status_response = self.client.get(f"/api/projects/{project.id}/share")
            self.assertEqual(status_response.status_code, 200)
            status_payload = status_response.json()
            self.assertTrue(status_payload["exists"])
            self.assertEqual(status_payload["view_count"], 2)
            self.assertIsNotNone(status_payload["last_viewed_at"])
        finally:
            db.close()

    def test_share_link_rejects_too_long_expiration_window(self):
        """测试：公测阶段分享链接有效期不能无限延长"""
        db = self.base.SessionLocal()
        try:
            user = self.base._create_user("share_window_owner", "share_window@example.com")
            self.base._set_current_user(user)
            project = self.base._create_project(owner=user, name="Window Project")

            response = self.client.post(
                f"/api/projects/{project.id}/share",
                json={"expires_in_days": 365},
            )
            self.assertEqual(response.status_code, 422)
        finally:
            db.close()


if __name__ == '__main__':
    unittest.main()
