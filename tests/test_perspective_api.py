import unittest
from sqlalchemy import inspect
from backend.database import Base, engine
from fastapi.testclient import TestClient
from backend.main import app


class ModelFieldTests(unittest.TestCase):
    def test_project_has_perspective_fields(self):
        """Project 模型应该有所有视角相关字段"""
        # 先做一个简单的 import 测试
        from backend.models import Project

        # 检查类属性
        self.assertTrue(hasattr(Project, 'writer_perspective'))
        self.assertTrue(hasattr(Project, 'use_perspective_critic'))
        self.assertTrue(hasattr(Project, 'perspective_strength'))
        self.assertTrue(hasattr(Project, 'perspective_mix'))

        print("✅ Project 模型包含所有视角相关字段")


class PerspectiveAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_list_perspectives_endpoint_exists(self):
        """GET /api/perspectives 应该返回可用视角列表"""
        response = self.client.get("/api/perspectives/")

        # 端点应该存在
        self.assertNotEqual(response.status_code, 404)

        # 应该至少有一个视角（liu-cixin）
        data = response.json()
        self.assertIn('perspectives', data)
        perspectives = data['perspectives']

        # 找到刘慈欣视角
        liu_cixin = next((p for p in perspectives if p['id'] == 'liu-cixin'), None)
        self.assertIsNotNone(liu_cixin)
        self.assertEqual(liu_cixin['name'], '刘慈欣')
        self.assertEqual(liu_cixin['genre'], '科幻')

        print(f"✅ 获取到 {len(perspectives)} 个视角")

    def test_get_perspective_detail(self):
        """GET /api/perspectives/{id} 应该返回视角详情"""
        response = self.client.get("/api/perspectives/liu-cixin")

        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data['id'], 'liu-cixin')
        self.assertEqual(data['name'], '刘慈欣')
        self.assertIn('preview', data)
        self.assertIn('planner_injection', data['preview'])
        self.assertIn('writer_injection', data['preview'])
        self.assertIn('critic_injection', data['preview'])
        self.assertIn('strengths', data)
        self.assertIn('weaknesses', data)

    def test_get_nonexistent_perspective_returns_404(self):
        """获取不存在的视角应该返回 404"""
        response = self.client.get("/api/perspectives/nonexistent-writer-12345")
        self.assertEqual(response.status_code, 404)
