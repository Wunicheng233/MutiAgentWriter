from __future__ import annotations

from backend.models import GenerationTask, Project
from tests.base import BaseWorkflowTestCase


class FailureRecoveryTests(BaseWorkflowTestCase):
    def test_clean_stuck_tasks_does_not_clear_waiting_confirmation(self):
        owner = self._create_user("recover_owner", "recover@example.com")
        project = self._create_project_full(owner, name="Waiting Confirm Novel")

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="waiting-confirm-task",
                status="waiting_confirm",
                progress=0.5,
                current_chapter=2,
            )
            db.add(task)
            db.commit()
        finally:
            db.close()

        self._set_current_user(owner)
        response = self.client.post(f"/api/projects/{project.id}/clean-stuck-tasks")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["cleaned_count"], 0)

        db = self.SessionLocal()
        try:
            persisted_task = db.query(GenerationTask).filter_by(celery_task_id="waiting-confirm-task").one()
            self.assertEqual(persisted_task.status, "waiting_confirm")
            self.assertEqual(persisted_task.current_chapter, 2)
        finally:
            db.close()

    def test_clean_stuck_tasks_marks_running_task_failed_and_project_recoverable(self):
        owner = self._create_user("recover_running_owner", "recover-running@example.com")
        project = self._create_project_full(owner, name="Running Novel")

        db = self.SessionLocal()
        try:
            persisted_project = db.query(Project).filter(Project.id == project.id).one()
            persisted_project.status = "generating"
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="running-stuck-task",
                status="progress",
                progress=0.2,
                current_chapter=1,
            )
            db.add(task)
            db.commit()
        finally:
            db.close()

        self._set_current_user(owner)
        response = self.client.post(f"/api/projects/{project.id}/clean-stuck-tasks")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["cleaned_count"], 1)

        db = self.SessionLocal()
        try:
            persisted_project = db.query(Project).filter(Project.id == project.id).one()
            persisted_task = db.query(GenerationTask).filter_by(celery_task_id="running-stuck-task").one()
            self.assertEqual(persisted_project.status, "failed")
            self.assertEqual(persisted_task.status, "failure")
            self.assertIn("cleaned up stuck task", persisted_task.error_message)
        finally:
            db.close()
