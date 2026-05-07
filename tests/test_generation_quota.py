from __future__ import annotations

import datetime
from unittest.mock import patch

from backend.auth import set_user_api_key
from backend.models import GenerationTask, TokenUsage, WorkflowRun
from backend.services import generation_quota
from tests.base import BaseWorkflowTestCase


class GenerationQuotaTests(BaseWorkflowTestCase):
    def test_generation_quota_endpoint_reports_daily_remaining_uses(self):
        owner = self._create_user("quota_owner", "quota_owner@example.com")
        self._set_current_user(owner)

        with patch.object(generation_quota.settings, "public_beta_daily_generation_limit", 2):
            response = self.client.get("/api/auth/me/generation-quota")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["daily_limit"], 2)
        self.assertEqual(payload["used_today"], 0)
        self.assertEqual(payload["remaining_today"], 2)
        self.assertTrue(payload["allowed"])
        self.assertIsNone(payload["reason"])
        self.assertIn("reset_at", payload)
        self.assertEqual(payload["monthly_tokens_used"], 0)

    def test_generation_quota_counts_existing_generation_runs(self):
        owner = self._create_user("quota_used_owner", "quota_used_owner@example.com")
        project = self._create_project_full(owner, name="Quota Used Novel")

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="quota-used-task",
                status="success",
                progress=1.0,
            )
            db.add(task)
            db.flush()
            db.add(
                WorkflowRun(
                    project_id=project.id,
                    generation_task_id=task.id,
                    run_kind="generation",
                    trigger_source="manual",
                    status="completed",
                    triggered_by_user_id=owner.id,
                    started_at=datetime.datetime.utcnow(),
                )
            )
            db.commit()
        finally:
            db.close()

        self._set_current_user(owner)
        with patch.object(generation_quota.settings, "public_beta_daily_generation_limit", 2):
            response = self.client.get("/api/auth/me/generation-quota")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["used_today"], 1)
        self.assertEqual(payload["remaining_today"], 1)
        self.assertTrue(payload["allowed"])

    def test_trigger_generation_rejects_when_daily_quota_exhausted(self):
        owner = self._create_user("quota_blocked_owner", "quota_blocked_owner@example.com")
        project = self._create_project_full(owner, name="Quota Blocked Novel")

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="quota-blocked-existing",
                status="success",
                progress=1.0,
            )
            db.add(task)
            db.flush()
            db.add(
                WorkflowRun(
                    project_id=project.id,
                    generation_task_id=task.id,
                    run_kind="generation",
                    trigger_source="manual",
                    status="completed",
                    triggered_by_user_id=owner.id,
                    started_at=datetime.datetime.utcnow(),
                )
            )
            db.commit()
        finally:
            db.close()

        self._set_current_user(owner)
        with patch.object(generation_quota.settings, "public_beta_daily_generation_limit", 1):
            response = self.client.post(f"/api/projects/{project.id}/generate")

        self.assertEqual(response.status_code, 429)
        self.assertIn("今日生成次数已用完", response.json()["detail"])

    def test_generation_quota_reports_monthly_token_budget(self):
        owner = self._create_user("quota_token_owner", "quota-token@example.com")
        project = self._create_project_full(owner, name="Quota Token Novel")

        db = self.SessionLocal()
        try:
            db.add(
                TokenUsage(
                    user_id=owner.id,
                    project_id=project.id,
                    agent_name="writer",
                    model="demo-model",
                    prompt_tokens=350,
                    completion_tokens=650,
                    total_tokens=1000,
                )
            )
            db.commit()
        finally:
            db.close()

        self._set_current_user(owner)
        with patch.object(generation_quota.settings, "public_beta_monthly_token_limit", 2500):
            response = self.client.get("/api/auth/me/generation-quota")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["monthly_token_limit"], 2500)
        self.assertEqual(payload["monthly_tokens_used"], 1000)
        self.assertEqual(payload["monthly_tokens_remaining"], 1500)
        self.assertTrue(payload["allowed"])
        self.assertIn("monthly_reset_at", payload)

    def test_trigger_generation_rejects_when_monthly_token_budget_exhausted(self):
        owner = self._create_user("quota_token_blocked_owner", "quota-token-blocked@example.com")
        project = self._create_project_full(owner, name="Quota Token Blocked Novel")

        db = self.SessionLocal()
        try:
            db.add(
                TokenUsage(
                    user_id=owner.id,
                    project_id=project.id,
                    agent_name="writer",
                    model="demo-model",
                    prompt_tokens=500,
                    completion_tokens=500,
                    total_tokens=1000,
                )
            )
            db.commit()
        finally:
            db.close()

        self._set_current_user(owner)
        with patch.object(generation_quota.settings, "public_beta_daily_generation_limit", 3), \
             patch.object(generation_quota.settings, "public_beta_monthly_token_limit", 1000):
            response = self.client.post(f"/api/projects/{project.id}/generate")

        self.assertEqual(response.status_code, 429)
        self.assertIn("本月 Token 预算已用完", response.json()["detail"])

    def test_user_supplied_api_key_is_not_blocked_by_platform_monthly_token_budget(self):
        owner = self._create_user("quota_byok_owner", "quota-byok@example.com")
        project = self._create_project_full(owner, name="Quota BYOK Novel")

        db = self.SessionLocal()
        try:
            user = db.query(type(owner)).filter(type(owner).id == owner.id).one()
            user.llm_provider = "deepseek"
            user.llm_base_url = "https://api.deepseek.com"
            user.llm_model = "deepseek-chat"
            set_user_api_key(user, "sk-user-owned-key")
            db.add(
                TokenUsage(
                    user_id=owner.id,
                    project_id=project.id,
                    agent_name="writer",
                    model="deepseek-chat",
                    prompt_tokens=500,
                    completion_tokens=500,
                    total_tokens=1000,
                )
            )
            db.commit()
        finally:
            db.close()

        owner.llm_provider = "deepseek"
        owner.llm_base_url = "https://api.deepseek.com"
        owner.llm_model = "deepseek-chat"
        set_user_api_key(owner, "sk-user-owned-key")

        self._set_current_user(owner)
        with patch.object(generation_quota.settings, "public_beta_daily_generation_limit", 3), \
             patch.object(generation_quota.settings, "public_beta_monthly_token_limit", 1000):
            response = self.client.get("/api/auth/me/generation-quota")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["api_source"], "user")
        self.assertFalse(payload["platform_token_budget_applies"])
        self.assertIsNone(payload["monthly_token_limit"])
        self.assertTrue(payload["allowed"])
        self.assertIsNone(payload["reason"])

    def test_platform_monthly_token_budget_ignores_user_owned_api_usage_history(self):
        owner = self._create_user("quota_source_owner", "quota-source@example.com")
        project = self._create_project_full(owner, name="Quota Source Novel")

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
                    prompt_tokens=5000,
                    completion_tokens=5000,
                    total_tokens=10000,
                ),
            ])
            db.commit()
        finally:
            db.close()

        self._set_current_user(owner)
        with patch.object(generation_quota.settings, "public_beta_monthly_token_limit", 1000):
            response = self.client.get("/api/auth/me/generation-quota")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["api_source"], "system")
        self.assertEqual(payload["monthly_tokens_used"], 900)
        self.assertEqual(payload["monthly_tokens_remaining"], 100)
        self.assertTrue(payload["allowed"])
