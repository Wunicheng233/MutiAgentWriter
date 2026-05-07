from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import backend.api.projects as projects_api
from backend.auth import set_user_api_key
from backend.models import Chapter, GenerationTask, Project, WorkflowRun
from tests.base import BaseWorkflowTestCase


class TaskGovernanceTests(BaseWorkflowTestCase):
    def test_user_cannot_start_second_generation_while_another_project_generation_is_active(self):
        owner = self._create_user("task_guard_owner", "task-guard@example.com")
        first_project = self._create_project_full(owner, name="Active Novel")
        second_project = self._create_project_full(owner, name="Next Novel")

        db = self.SessionLocal()
        try:
            first_task = GenerationTask(
                project_id=first_project.id,
                celery_task_id="active-user-generation",
                status="progress",
                progress=0.2,
                current_chapter=1,
            )
            db.add(first_task)
            db.flush()
            db.add(
                WorkflowRun(
                    project_id=first_project.id,
                    generation_task_id=first_task.id,
                    run_kind="generation",
                    trigger_source="manual",
                    status="running",
                    current_chapter=1,
                    triggered_by_user_id=owner.id,
                )
            )
            db.commit()
        finally:
            db.close()

        self._set_current_user(owner)
        response = self.client.post(f"/api/projects/{second_project.id}/generate")

        self.assertEqual(response.status_code, 409)
        self.assertIn("已有生成任务正在运行", response.json()["detail"])

    def test_generation_start_blocks_incomplete_user_llm_settings_before_dispatch(self):
        owner = self._create_user("bad_llm_owner", "bad-llm@example.com")
        project = self._create_project_full(owner, name="Bad LLM Novel")

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
        response = self.client.post(f"/api/projects/{project.id}/generate")

        self.assertEqual(response.status_code, 400)
        self.assertIn("模型配置不完整", response.json()["detail"])

    def test_cancel_active_generation_marks_task_cancelled_and_releases_project(self):
        owner = self._create_user("cancel_api_owner", "cancel-api@example.com")
        project = self._create_project_full(owner, name="Cancelable Novel")

        db = self.SessionLocal()
        try:
            persisted_project = db.query(Project).filter(Project.id == project.id).one()
            persisted_project.status = "generating"
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="cancel-api-task",
                status="progress",
                progress=0.4,
                current_chapter=2,
            )
            db.add(task)
            db.flush()
            db.add(
                WorkflowRun(
                    project_id=project.id,
                    generation_task_id=task.id,
                    run_kind="generation",
                    trigger_source="manual",
                    status="running",
                    current_chapter=2,
                    triggered_by_user_id=owner.id,
                )
            )
            db.commit()
        finally:
            db.close()

        self._set_current_user(owner)
        with patch("backend.api.projects.celery_app.control.revoke") as mock_revoke:
            response = self.client.post(f"/api/projects/{project.id}/cancel-generation")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["cancelled_count"], 1)
        mock_revoke.assert_called_once_with("cancel-api-task")

        db = self.SessionLocal()
        try:
            persisted_project = db.query(Project).filter(Project.id == project.id).one()
            persisted_task = db.query(GenerationTask).filter_by(celery_task_id="cancel-api-task").one()
            self.assertEqual(persisted_project.status, "draft")
            self.assertEqual(persisted_task.status, "cancelled")
            self.assertEqual(persisted_task.error_message, "User cancelled this generation task")
            self.assertEqual(persisted_task.workflow_run.status, "cancelled")
            self.assertEqual(persisted_task.workflow_run.run_metadata["cancelled_by"], "user")
        finally:
            db.close()

    def test_resume_failed_generation_starts_after_last_existing_chapter(self):
        owner = self._create_user("resume_owner", "resume@example.com")
        project_dir = self.workspace / "resume-project"
        project_dir.mkdir()
        project = self._create_project(
            owner,
            name="Resume Novel",
            file_path=str(project_dir),
            config={
                "novel_name": "Resume Novel",
                "core_requirement": "一个关于地下城市的故事",
                "chapter_word_count": 1200,
                "start_chapter": 1,
                "end_chapter": 4,
            },
        )

        db = self.SessionLocal()
        try:
            persisted_project = db.query(Project).filter(Project.id == project.id).one()
            persisted_project.status = "failed"
            db.add_all([
                Chapter(
                    project_id=project.id,
                    chapter_index=1,
                    title="第一章",
                    content="第一章正文",
                    word_count=1000,
                    status="generated",
                ),
                Chapter(
                    project_id=project.id,
                    chapter_index=2,
                    title="第二章",
                    content="第二章正文",
                    word_count=1100,
                    status="generated",
                ),
                GenerationTask(
                    project_id=project.id,
                    celery_task_id="failed-before-resume",
                    status="failure",
                    progress=0.5,
                    current_chapter=2,
                    error_message="writer failed",
                ),
            ])
            db.commit()
        finally:
            db.close()

        dispatched_args = []
        original_apply_async = projects_api.generate_novel_task.apply_async
        try:
            def fake_apply_async(args=None, task_id=None, **kwargs):
                dispatched_args.append(args)
                return SimpleNamespace(id=task_id)

            projects_api.generate_novel_task.apply_async = fake_apply_async
            self._set_current_user(owner)
            response = self.client.post(f"/api/projects/{project.id}/resume-generation")
        finally:
            projects_api.generate_novel_task.apply_async = original_apply_async

        self.assertEqual(response.status_code, 200)
        self.assertEqual(dispatched_args, [(str(project_dir), str(owner.id), 3, 4)])

        db = self.SessionLocal()
        try:
            persisted_project = db.query(Project).filter(Project.id == project.id).one()
            task = (
                db.query(GenerationTask)
                .filter(GenerationTask.project_id == project.id, GenerationTask.status == "pending")
                .order_by(GenerationTask.id.desc())
                .first()
            )
            self.assertEqual(persisted_project.status, "generating")
            self.assertIsNotNone(task)
            self.assertEqual(task.current_chapter, 3)
            self.assertEqual(task.workflow_run.run_metadata["resume_from_chapter"], 3)
            self.assertEqual(task.workflow_run.run_metadata["resume_after_chapter"], 2)
        finally:
            db.close()
