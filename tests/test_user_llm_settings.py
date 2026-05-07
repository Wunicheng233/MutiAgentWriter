from __future__ import annotations

from unittest.mock import patch

from backend.auth import get_user_api_key, merge_user_llm_config, set_user_api_key
from backend.core.llm.types import LLMError, LLMResponse
from backend.models import User
from tests.base import BaseWorkflowTestCase


class UserLLMSettingsTests(BaseWorkflowTestCase):
    def test_update_llm_settings_persists_provider_route_and_masks_key(self):
        owner = self._create_user("llm_owner", "llm_owner@example.com")
        self._set_current_user(owner)

        response = self.client.put(
            "/api/auth/llm-settings",
            json={
                "provider": "deepseek",
                "base_url": "https://api.deepseek.com",
                "model": "deepseek-chat",
                "api_key": "sk-user-deepseek-123456",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["llm_provider"], "deepseek")
        self.assertEqual(payload["llm_base_url"], "https://api.deepseek.com")
        self.assertEqual(payload["llm_model"], "deepseek-chat")
        self.assertEqual(payload["api_key"], "sk-u...3456")

        db = self.SessionLocal()
        try:
            user = db.query(User).filter(User.id == owner.id).one()
            self.assertEqual(user.llm_provider, "deepseek")
            self.assertEqual(user.llm_base_url, "https://api.deepseek.com")
            self.assertEqual(user.llm_model, "deepseek-chat")
            self.assertIsNone(user.api_key)
            self.assertIsNotNone(user.encrypted_api_key)
            self.assertEqual(get_user_api_key(user), "sk-user-deepseek-123456")
        finally:
            db.close()

    def test_reset_llm_settings_returns_user_to_system_defaults(self):
        owner = self._create_user("llm_reset_owner", "llm_reset_owner@example.com")
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            user = db.query(User).filter(User.id == owner.id).one()
            user.llm_provider = "openai"
            user.llm_base_url = "https://api.openai.com/v1"
            user.llm_model = "gpt-custom"
            set_user_api_key(user, "sk-openai")
            db.commit()
        finally:
            db.close()

        response = self.client.delete("/api/auth/llm-settings")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["llm_provider"], "system")
        self.assertIsNone(payload["llm_base_url"])
        self.assertIsNone(payload["llm_model"])
        self.assertIsNone(payload["api_key"])

    def test_update_llm_settings_rejects_non_system_provider_without_api_key(self):
        owner = self._create_user("llm_no_key_owner", "llm_no_key_owner@example.com")
        self._set_current_user(owner)

        response = self.client.put(
            "/api/auth/llm-settings",
            json={
                "provider": "openai",
                "base_url": "https://api.openai.com/v1",
                "model": "gpt-custom",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("API Key", response.json()["detail"])

    def test_update_llm_settings_rejects_placeholder_base_url(self):
        owner = self._create_user("llm_placeholder_owner", "llm-placeholder@example.com")
        self._set_current_user(owner)

        response = self.client.put(
            "/api/auth/llm-settings",
            json={
                "provider": "custom",
                "base_url": "https://api.example.com/v1",
                "model": "demo-model",
                "api_key": "sk-placeholder",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("示例占位符", response.json()["detail"])

    def test_update_llm_settings_requires_volcengine_endpoint_model_for_user_key(self):
        owner = self._create_user("llm_volc_owner", "llm-volc@example.com")
        self._set_current_user(owner)

        response = self.client.put(
            "/api/auth/llm-settings",
            json={
                "provider": "volcengine",
                "base_url": "",
                "api_key": "volc-user-key",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("模型 ID", response.json()["detail"])

    def test_update_llm_settings_rejects_provider_base_url_mismatch(self):
        owner = self._create_user("llm_url_mismatch_owner", "llm-url-mismatch@example.com")
        self._set_current_user(owner)

        response = self.client.put(
            "/api/auth/llm-settings",
            json={
                "provider": "volcengine",
                "base_url": "https://api.deepseek.com",
                "model": "ep-20260507",
                "api_key": "volc-user-key",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("不匹配", response.json()["detail"])

    def test_user_llm_config_feeds_runtime_route_without_overwriting_project_overrides(self):
        user = User(
            username="runtime_user",
            email="runtime@example.com",
            hashed_password="hashed",
            llm_provider="deepseek",
            llm_base_url="https://api.deepseek.com",
            llm_model="deepseek-chat",
        )
        set_user_api_key(user, "sk-user-deepseek")
        project_config = {
            "novel_name": "Override Novel",
            "llm": {
                "agents": {
                    "critic": {
                        "provider": "volcengine",
                        "model": "critic-special",
                    }
                }
            },
        }

        merged = merge_user_llm_config(project_config, user)

        self.assertEqual(merged["llm"]["default_provider"], "deepseek")
        self.assertEqual(merged["llm"]["providers"]["deepseek"]["api_key"], "sk-user-deepseek")
        self.assertEqual(merged["llm"]["providers"]["deepseek"]["base_url"], "https://api.deepseek.com")
        self.assertEqual(merged["llm"]["providers"]["deepseek"]["model"], "deepseek-chat")
        self.assertEqual(merged["llm"]["agents"]["critic"]["provider"], "volcengine")
        self.assertEqual(merged["llm"]["agents"]["critic"]["model"], "critic-special")

    def test_llm_settings_test_uses_submitted_route_without_persisting(self):
        owner = self._create_user("llm_test_owner", "llm-test@example.com")
        self._set_current_user(owner)

        captured_requests = []

        def fake_complete(request, *, sleep):
            captured_requests.append(request)
            return LLMResponse(content="OK", model=request.model, provider=request.provider)

        with patch("backend.api.auth._llm_router.complete", side_effect=fake_complete):
            response = self.client.post(
                "/api/auth/llm-settings/test",
                json={
                    "provider": "deepseek",
                    "base_url": "https://api.deepseek.com",
                    "model": "deepseek-chat",
                    "api_key": "sk-test-connection",
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["provider"], "deepseek")
        self.assertEqual(payload["model"], "deepseek-chat")
        self.assertEqual(captured_requests[0].api_key, "sk-test-connection")
        self.assertEqual(captured_requests[0].base_url, "https://api.deepseek.com")

        db = self.SessionLocal()
        try:
            user = db.query(User).filter(User.id == owner.id).one()
            self.assertIn(user.llm_provider, (None, "system"))
            self.assertIsNone(user.encrypted_api_key)
        finally:
            db.close()

    def test_llm_settings_test_returns_normalized_provider_error(self):
        owner = self._create_user("llm_test_error_owner", "llm-test-error@example.com")
        self._set_current_user(owner)

        with patch(
            "backend.api.auth._llm_router.complete",
            side_effect=LLMError(
                "auth",
                "模型认证失败，请检查该供应商 API Key。",
                retryable=False,
                provider="deepseek",
                status_code=401,
            ),
        ):
            response = self.client.post(
                "/api/auth/llm-settings/test",
                json={
                    "provider": "deepseek",
                    "base_url": "https://api.deepseek.com",
                    "model": "deepseek-chat",
                    "api_key": "bad-key",
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload["success"])
        self.assertEqual(payload["error_category"], "auth")
        self.assertIn("API Key", payload["message"])
