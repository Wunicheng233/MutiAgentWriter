from __future__ import annotations

from backend.models import ProblemReport
from tests.base import BaseWorkflowTestCase


class ProblemReportTests(BaseWorkflowTestCase):
    def test_authenticated_user_can_submit_problem_report_with_context(self):
        owner = self._create_user("report_owner", "report-owner@example.com")
        project = self._create_project_full(owner, name="Report Project")
        self._set_current_user(owner)

        response = self.client.post(
            "/api/feedback/problem-reports",
            json={
                "category": "generation",
                "severity": "high",
                "title": "生成卡住",
                "description": "逐章共创确认后没有继续生成。",
                "page_url": "http://localhost:5173/projects/1/overview?confirm=1",
                "route": "/projects/1/overview",
                "project_id": project.id,
                "task_id": 123,
                "context": {
                    "project_status": "generating",
                    "task_status": "waiting_confirm",
                },
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["category"], "generation")
        self.assertEqual(payload["severity"], "high")
        self.assertEqual(payload["status"], "open")
        self.assertEqual(payload["project_id"], project.id)

        db = self.SessionLocal()
        try:
            report = db.query(ProblemReport).filter(ProblemReport.id == payload["id"]).one()
            self.assertEqual(report.user_id, owner.id)
            self.assertEqual(report.project_id, project.id)
            self.assertEqual(report.context["task_status"], "waiting_confirm")
        finally:
            db.close()

    def test_problem_report_rejects_project_user_cannot_access(self):
        owner = self._create_user("report_owner_2", "report-owner-2@example.com")
        other = self._create_user("report_other", "report-other@example.com")
        project = self._create_project_full(owner, name="Private Report Project")
        self._set_current_user(other)

        response = self.client.post(
            "/api/feedback/problem-reports",
            json={
                "category": "bug",
                "severity": "medium",
                "title": "看到了别人的项目",
                "description": "不应该能提交这个项目的上下文。",
                "route": "/projects/999/overview",
                "project_id": project.id,
            },
        )

        self.assertEqual(response.status_code, 404)
