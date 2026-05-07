from __future__ import annotations

from backend.models import TokenUsage
from tests.base import BaseWorkflowTestCase


class TokenUsageStatsTests(BaseWorkflowTestCase):
    def test_project_token_stats_splits_system_and_user_owned_api_usage(self):
        owner = self._create_user("token_stats_owner", "token-stats@example.com")
        project = self._create_project_full(owner, name="Token Stats Novel")

        db = self.SessionLocal()
        try:
            db.add_all([
                TokenUsage(
                    user_id=owner.id,
                    project_id=project.id,
                    agent_name="writer",
                    model="system-model",
                    provider="volcengine",
                    api_source="system",
                    prompt_tokens=400,
                    completion_tokens=500,
                    total_tokens=900,
                ),
                TokenUsage(
                    user_id=owner.id,
                    project_id=project.id,
                    agent_name="writer",
                    model="deepseek-chat",
                    provider="deepseek",
                    api_source="user",
                    prompt_tokens=300,
                    completion_tokens=800,
                    total_tokens=1100,
                ),
            ])
            db.commit()
        finally:
            db.close()

        self._set_current_user(owner)
        response = self.client.get(f"/api/projects/{project.id}/token-stats")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total_tokens"], 2000)
        self.assertEqual(payload["system_api_tokens"], 900)
        self.assertEqual(payload["user_api_tokens"], 1100)
