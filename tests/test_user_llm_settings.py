from __future__ import annotations

from backend.auth import get_user_api_key, merge_user_llm_config, set_user_api_key
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
