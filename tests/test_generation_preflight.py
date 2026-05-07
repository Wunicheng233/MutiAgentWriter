from __future__ import annotations

from unittest.mock import patch

from backend.auth import set_user_api_key
from backend.models import TokenUsage
from backend.services import generation_quota
from tests.base import BaseWorkflowTestCase


class GenerationPreflightTests(BaseWorkflowTestCase):
    def test_generation_preflight_warns_when_estimate_exceeds_platform_budget(self):
        owner = self._create_user("preflight_owner", "preflight@example.com")
        project = self._create_project(
            owner,
            name="Preflight Novel",
            config={
                "novel_name": "Preflight Novel",
                "core_requirement": "一个关于时间裂缝的故事",
                "chapter_word_count": 1000,
                "start_chapter": 2,
                "end_chapter": 3,
            },
        )

        db = self.SessionLocal()
        try:
            db.add(
                TokenUsage(
                    user_id=owner.id,
                    project_id=project.id,
                    agent_name="writer",
                    model="demo-model",
                    prompt_tokens=400,
                    completion_tokens=500,
                    total_tokens=900,
                )
            )
            db.commit()
        finally:
            db.close()

        self._set_current_user(owner)
        with patch.object(generation_quota.settings, "public_beta_monthly_token_limit", 5000):
            response = self.client.get(f"/api/projects/{project.id}/generation-preflight")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["chapter_count"], 2)
        self.assertEqual(payload["estimated_output_words"], 2000)
        self.assertEqual(payload["estimated_token_count"], 14100)
        self.assertEqual(payload["monthly_tokens_remaining"], 4100)
        self.assertEqual(payload["risk_level"], "warning")
        self.assertTrue(payload["platform_token_budget_applies"])
        self.assertIn("预计本次生成可能超过本月平台 Token 预算", payload["messages"][0])

    def test_user_owned_api_key_preflight_does_not_warn_on_platform_budget(self):
        owner = self._create_user("preflight_byok_owner", "preflight-byok@example.com")
        project = self._create_project_full(owner, name="Preflight BYOK Novel")

        db = self.SessionLocal()
        try:
            user = db.query(type(owner)).filter(type(owner).id == owner.id).one()
            user.llm_provider = "deepseek"
            user.llm_base_url = "https://api.deepseek.com"
            user.llm_model = "deepseek-chat"
            set_user_api_key(user, "sk-user-owned-key")
            db.commit()
        finally:
            db.close()

        owner.llm_provider = "deepseek"
        owner.llm_base_url = "https://api.deepseek.com"
        owner.llm_model = "deepseek-chat"
        set_user_api_key(owner, "sk-user-owned-key")

        self._set_current_user(owner)
        with patch.object(generation_quota.settings, "public_beta_monthly_token_limit", 1000):
            response = self.client.get(f"/api/projects/{project.id}/generation-preflight")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["api_source"], "user")
        self.assertFalse(payload["platform_token_budget_applies"])
        self.assertIsNone(payload["monthly_token_limit"])
        self.assertEqual(payload["risk_level"], "ok")
        self.assertIn("自带 Key 不占用平台 Token 预算", payload["messages"][0])

    def test_preflight_blocks_incomplete_user_llm_settings(self):
        owner = self._create_user("preflight_bad_llm", "preflight-bad-llm@example.com")
        project = self._create_project_full(owner, name="Preflight Bad LLM Novel")

        db = self.SessionLocal()
        try:
            user = db.query(type(owner)).filter(type(owner).id == owner.id).one()
            user.llm_provider = "volcengine"
            user.llm_base_url = "https://api.example.com/v1"
            user.llm_model = None
            set_user_api_key(user, "volc-user-key")
            db.commit()
        finally:
            db.close()

        owner.llm_provider = "volcengine"
        owner.llm_base_url = "https://api.example.com/v1"
        owner.llm_model = None
        set_user_api_key(owner, "volc-user-key")

        self._set_current_user(owner)
        response = self.client.get(f"/api/projects/{project.id}/generation-preflight")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["risk_level"], "blocked")
        self.assertFalse(payload["quota_allowed"])
        self.assertTrue(any("模型配置不完整" in msg for msg in payload["messages"]))
