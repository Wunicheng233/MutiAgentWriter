"""测试：分享链接默认 7 天过期"""

import unittest
import secrets
from datetime import datetime, timedelta, timezone

from backend.main import app
from backend.models import ShareLink, Chapter


class TestShareDefaultExpiry(unittest.TestCase):
    """测试分享链接默认过期功能"""

    def setUp(self):
        """测试前的准备工作"""
        from tests.base import BaseWorkflowTestCase
        self.base = BaseWorkflowTestCase()
        self.base.setUp()
        self.client = self.base.client

    def tearDown(self):
        """测试后的清理工作"""
        self.base.tearDown()

    def test_new_share_link_has_default_expiry(self):
        """测试：新创建的分享链接应该有默认 7 天的过期时间"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 一个项目
            user = self.base._create_user("testowner", "owner@example.com")
            self.base._set_current_user(user)
            project = self.base._create_project(owner=user, name="Test Project")

            # WHEN: 创建分享链接
            response = self.client.post(
                f"/api/projects/{project.id}/share")

            # THEN: 应该创建成功
            self.assertEqual(response.status_code, 200)
            data = response.json()

            # 检查响应中包含 expires_at
            self.assertIn('expires_at', data, "响应中应该包含 expires_at 字段")
            self.assertIsNotNone(data['expires_at'], "expires_at 不应为 None")

            # 检查 expires_at 应该在 7 天左右（允许 1 分钟误差）
            expires_at = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00'))
            expected_expiry = datetime.now(timezone.utc) + timedelta(days=7)
            diff_seconds = abs((expires_at - expected_expiry).total_seconds())
            self.assertLess(diff_seconds, 60, f"分享链接应该默认 7 天后过期，实际差 {diff_seconds} 秒")

            # 数据库中也应该有正确的过期时间
            db_share = db.query(ShareLink).filter(ShareLink.project_id == project.id).first()
            self.assertIsNotNone(db_share.expires_at, "数据库中 expires_at 不应为 None")
        finally:
            db.close()

    def test_share_link_expired_after_7_days(self):
        """测试：过期的分享链接不能访问"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 一个项目和一个已过期的分享链接
            user = self.base._create_user("testuser2", "user2@example.com")
            self.base._set_current_user(user)
            project = self.base._create_project(owner=user, name="Test Project")

            # 创建已过期的分享链接（过期 1 天）
            expired_at = datetime.utcnow() - timedelta(days=1)
            share_token = secrets.token_urlsafe(32)
            share = ShareLink(
                project_id=project.id,
                share_token=share_token,
                is_active=True,
                expires_at=expired_at,
            )
            db.add(share)
            db.commit()

            # WHEN: 尝试访问过期的分享链接
            response = self.client.get(f"/api/share/{share_token}")

            # THEN: 应该返回 410 Gone
            self.assertEqual(response.status_code, 410)
            detail = response.json().get('detail', '')
            self.assertTrue("过期" in detail or "expired" in detail.lower(),
                            f"错误信息应该包含'过期'或'expired'，实际是: {detail}")

        finally:
            db.close()

    def test_share_link_chapter_expired_after_7_days(self):
        """测试：过期的分享链接不能访问章节内容"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 一个项目、已过期的分享链接和章节
            user = self.base._create_user("testuser3", "user3@example.com")
            self.base._set_current_user(user)
            project = self.base._create_project(owner=user, name="Test Project")

            # 创建已过期的分享链接
            expired_at = datetime.utcnow() - timedelta(days=1)
            share_token = secrets.token_urlsafe(32)
            share = ShareLink(
                project_id=project.id,
                share_token=share_token,
                is_active=True,
                expires_at=expired_at,
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

            # WHEN: 尝试访问过期的分享链接的章节
            response = self.client.get(f"/api/share/{share_token}/chapters/1")

            # THEN: 应该返回 410 Gone
            self.assertEqual(response.status_code, 410)

        finally:
            db.close()

    def test_share_link_not_expired_yet(self):
        """测试：未过期的分享链接可以正常访问"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 一个项目和一个未过期的分享链接
            user = self.base._create_user("testuser4", "user4@example.com")
            self.base._set_current_user(user)
            project = self.base._create_project(owner=user, name="Test Project")

            # 创建未过期的分享链接（还有 1 天过期）
            expires_at = datetime.utcnow() + timedelta(days=1)
            share_token = secrets.token_urlsafe(32)
            share = ShareLink(
                project_id=project.id,
                share_token=share_token,
                is_active=True,
                expires_at=expires_at,
            )
            db.add(share)
            db.commit()

            # WHEN: 访问未过期的分享链接
            response = self.client.get(f"/api/share/{share_token}")

            # THEN: 应该成功
            self.assertEqual(response.status_code, 200)

        finally:
            db.close()

    def test_null_expires_at_never_expires(self):
        """测试：expires_at 为 NULL 时永不过期（向后兼容）"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 旧版本创建的永不过期链接
            user = self.base._create_user("testuser5", "user5@example.com")
            self.base._set_current_user(user)
            project = self.base._create_project(owner=user, name="Test Project")

            share_token = secrets.token_urlsafe(32)
            share = ShareLink(
                project_id=project.id,
                share_token=share_token,
                is_active=True,
                expires_at=None,  # 永不过期
            )
            db.add(share)
            db.commit()

            # WHEN: 访问
            response = self.client.get(f"/api/share/{share_token}")

            # THEN: 应该成功（向后兼容）
            self.assertEqual(response.status_code, 200)

        finally:
            db.close()

    def test_reactivate_share_link_resets_expiry(self):
        """测试：重新激活已撤销的分享链接时，应该重置过期时间"""
        db = self.base.SessionLocal()
        try:
            # GIVEN: 一个项目和一个已撤销的分享链接
            user = self.base._create_user("testuser6", "user6@example.com")
            self.base._set_current_user(user)
            project = self.base._create_project(owner=user, name="Test Project")

            # 创建一个分享链接然后撤销
            share_token = secrets.token_urlsafe(32)
            old_expiry = datetime.utcnow() - timedelta(days=30)  # 很久以前过期
            share = ShareLink(
                project_id=project.id,
                share_token=share_token,
                is_active=False,
                expires_at=old_expiry,
            )
            db.add(share)
            db.commit()

            # WHEN: 重新创建分享链接（应该重新激活）
            response = self.client.post(
                f"/api/projects/{project.id}/share")

            # THEN: 应该成功且过期时间被重置为 7 天后
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertIn('expires_at', data)
            self.assertIsNotNone(data['expires_at'])

            # 检查过期时间是新的 7 天
            expires_at = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00'))
            expected_expiry = datetime.now(timezone.utc) + timedelta(days=7)
            diff_seconds = abs((expires_at - expected_expiry).total_seconds())
            self.assertLess(diff_seconds, 60, "重新激活的分享链接过期时间应重置为 7 天")

        finally:
            db.close()


if __name__ == '__main__':
    unittest.main()
