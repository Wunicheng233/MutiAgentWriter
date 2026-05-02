from __future__ import annotations

import json
import unittest
from pathlib import Path
from types import SimpleNamespace

import backend.api.projects as projects_api
import backend.api.chapters as chapters_api
import backend.api.tasks as tasks_api
import backend.tasks.export_tasks as export_tasks
import backend.tasks.writing_tasks as writing_tasks
from backend.auth import set_user_api_key
from backend.utils.runtime_context import get_current_output_dir_optional, get_current_run_context_optional, set_current_output_dir
from backend.models import Artifact, Chapter, FeedbackItem, GenerationTask, Project, User, WorkflowRun, WorkflowStepRun
from backend.chapter_sync import parse_chapter_file_content, sync_chapter_file_to_db
from backend.task_status import ACTIVE_TASK_STATUSES, get_active_project_task
from backend.workflow_service import create_artifact, create_feedback_item, create_generation_workflow_run, update_workflow_run_status
from unittest.mock import patch
from tests.base import BaseWorkflowTestCase


class WorkflowFoundationTests(BaseWorkflowTestCase):
    def test_trigger_generation_creates_workflow_run_and_project_snapshot_artifact(self):
        owner = self._create_user("workflow_owner", "workflow_owner@example.com")
        project_dir = self.workspace / "workflow-project"
        project_dir.mkdir()
        project = self._create_project_full(owner, name="Workflow Novel", file_path=str(project_dir))
        self._set_current_user(owner)

        dispatched_task_ids = []
        original_apply_async = projects_api.generate_novel_task.apply_async
        try:
            def fake_apply_async(args=None, task_id=None, **kwargs):
                db = self.SessionLocal()
                try:
                    persisted_task = db.query(GenerationTask).filter(
                        GenerationTask.celery_task_id == task_id
                    ).one_or_none()
                    self.assertIsNotNone(persisted_task)
                    dispatched_task_ids.append(task_id)
                    return SimpleNamespace(id=task_id)
                finally:
                    db.close()

            projects_api.generate_novel_task.apply_async = fake_apply_async
            response = self.client.post(f"/api/projects/{project.id}/generate")
        finally:
            projects_api.generate_novel_task.apply_async = original_apply_async

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(dispatched_task_ids), 1)

        db = self.SessionLocal()
        try:
            run = db.query(WorkflowRun).filter(WorkflowRun.project_id == project.id).one()
            self.assertEqual(run.status, "pending")
            self.assertEqual(run.run_kind, "generation")
            self.assertEqual(run.triggered_by_user_id, owner.id)
            self.assertIsNotNone(run.generation_task_id)

            artifact = db.query(Artifact).filter(Artifact.workflow_run_id == run.id).one()
            self.assertEqual(artifact.artifact_type, "project_config_snapshot")
            self.assertEqual(artifact.scope, "project")
            self.assertEqual(artifact.version_number, 1)
            self.assertTrue(artifact.is_current)
            self.assertEqual(artifact.content_json["novel_name"], "Workflow Novel")

            queued_step = db.query(WorkflowStepRun).filter(
                WorkflowStepRun.workflow_run_id == run.id,
                WorkflowStepRun.step_key == "queued_generation",
            ).one()
            self.assertEqual(queued_step.status, "completed")
            self.assertEqual(queued_step.step_type, "system")
        finally:
            db.close()

    def test_active_project_task_helper_includes_waiting_confirm_and_prefers_latest(self):
        """测试：活跃任务状态包含 waiting_confirm。

        注意：由于部分唯一索引约束，同一项目不能同时有多个活跃任务。
        测试先创建 progress 任务，完成后再创建 waiting_confirm 任务。
        """
        owner = self._create_user("active_helper_owner", "active_helper_owner@example.com")
        project = self._create_project_full(owner, name="Active Helper Novel")

        db = self.SessionLocal()
        try:
            # 第一步：创建 progress 状态的任务，然后标记为完成
            progress_task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-active-helper-old",
                status="progress",
                progress=0.4,
            )
            db.add(progress_task)
            db.commit()
            # 将旧任务标记为成功
            progress_task.status = "success"
            db.commit()

            # 第二步：创建已完成的终端状态任务（非活跃）
            completed_task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-active-helper-done",
                status="success",
                progress=1.0,
            )
            db.add(completed_task)
            db.commit()

            # 第三步：创建 waiting_confirm 状态的任务（活跃状态）
            waiting_task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-active-helper-waiting",
                status="waiting_confirm",
                progress=0.6,
                current_chapter=2,
            )
            db.add(waiting_task)
            db.commit()

            # 验证：当前活跃任务应该是 waiting_confirm 状态的任务
            active_task = get_active_project_task(db, project.id)
            self.assertEqual(active_task.celery_task_id, "celery-active-helper-waiting")
        finally:
            db.close()

    def test_create_artifact_versions_project_artifacts_and_keeps_single_current(self):
        owner = self._create_user("artifact_owner", "artifact_owner@example.com")
        project = self._create_project_full(owner, name="Artifact Novel")

        db = self.SessionLocal()
        try:
            first_artifact = create_artifact(
                db=db,
                project_id=project.id,
                artifact_type="project_config_snapshot",
                scope="project",
                source="system",
                content_json={"novel_name": "Artifact Novel v1"},
            )
            second_artifact = create_artifact(
                db=db,
                project_id=project.id,
                artifact_type="project_config_snapshot",
                scope="project",
                source="system",
                content_json={"novel_name": "Artifact Novel v2"},
            )
            db.commit()
            db.refresh(first_artifact)
            db.refresh(second_artifact)

            self.assertEqual(first_artifact.version_number, 1)
            self.assertFalse(first_artifact.is_current)
            self.assertEqual(second_artifact.version_number, 2)
            self.assertTrue(second_artifact.is_current)

            current_artifacts = db.query(Artifact).filter(
                Artifact.project_id == project.id,
                Artifact.artifact_type == "project_config_snapshot",
                Artifact.scope == "project",
                Artifact.is_current.is_(True),
            ).all()
            self.assertEqual([artifact.id for artifact in current_artifacts], [second_artifact.id])
        finally:
            db.close()

    def test_create_artifact_versions_chapter_artifacts_independently(self):
        owner = self._create_user("chapter_artifact_owner", "chapter_artifact_owner@example.com")
        project = self._create_project_full(owner, name="Chapter Artifact Novel")

        db = self.SessionLocal()
        try:
            chapter_one_v1 = create_artifact(
                db=db,
                project_id=project.id,
                artifact_type="chapter_draft",
                scope="chapter",
                chapter_index=1,
                source="agent",
                content_text="第一章初稿",
            )
            chapter_one_v2 = create_artifact(
                db=db,
                project_id=project.id,
                artifact_type="chapter_draft",
                scope="chapter",
                chapter_index=1,
                source="agent",
                content_text="第一章二稿",
            )
            chapter_two_v1 = create_artifact(
                db=db,
                project_id=project.id,
                artifact_type="chapter_draft",
                scope="chapter",
                chapter_index=2,
                source="agent",
                content_text="第二章初稿",
            )
            db.commit()
            db.refresh(chapter_one_v1)
            db.refresh(chapter_one_v2)
            db.refresh(chapter_two_v1)

            self.assertEqual(chapter_one_v1.version_number, 1)
            self.assertFalse(chapter_one_v1.is_current)
            self.assertEqual(chapter_one_v2.version_number, 2)
            self.assertTrue(chapter_one_v2.is_current)
            self.assertEqual(chapter_two_v1.version_number, 1)
            self.assertTrue(chapter_two_v1.is_current)
        finally:
            db.close()

    def test_create_artifact_rejects_unknown_scope_and_source(self):
        owner = self._create_user("invalid_artifact_owner", "invalid_artifact_owner@example.com")
        project = self._create_project_full(owner, name="Invalid Artifact Novel")

        db = self.SessionLocal()
        try:
            with self.assertRaises(ValueError):
                create_artifact(
                    db=db,
                    project_id=project.id,
                    artifact_type="chapter_draft",
                    scope="unknown",
                )
            with self.assertRaises(ValueError):
                create_artifact(
                    db=db,
                    project_id=project.id,
                    artifact_type="chapter_draft",
                    scope="chapter",
                    source="external",
                )
        finally:
            db.close()

    def test_rejected_chapter_confirmation_persists_structured_feedback_item(self):
        owner = self._create_user("feedback_owner", "feedback_owner@example.com")
        project_dir = self.workspace / "feedback-project"
        project_dir.mkdir()
        project = self._create_project_full(owner, name="Feedback Novel", file_path=str(project_dir))
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-feedback-1",
                status="waiting_confirm",
                progress=0.5,
                current_chapter=2,
            )
            db.add(task)
            db.commit()
            db.refresh(task)

            run = WorkflowRun(
                project_id=project.id,
                generation_task_id=task.id,
                run_kind="generation",
                status="waiting_confirm",
                triggered_by_user_id=owner.id,
            )
            db.add(run)
            db.commit()
        finally:
            db.close()

        dispatched_task_ids = []
        original_apply_async = tasks_api.generate_novel_task.apply_async
        try:
            def fake_apply_async(args=None, task_id=None, **kwargs):
                db = self.SessionLocal()
                try:
                    persisted_task = db.query(GenerationTask).filter(
                        GenerationTask.celery_task_id == task_id
                    ).one_or_none()
                    self.assertIsNotNone(persisted_task)
                    dispatched_task_ids.append(task_id)
                    return SimpleNamespace(id=task_id)
                finally:
                    db.close()

            tasks_api.generate_novel_task.apply_async = fake_apply_async
            response = self.client.post(
                "/api/tasks/celery-feedback-1/confirm",
                json={"approved": False, "feedback": "这一章主角存在感太弱，重写并增强冲突。"},
            )
        finally:
            tasks_api.generate_novel_task.apply_async = original_apply_async

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(dispatched_task_ids), 1)

        db = self.SessionLocal()
        try:
            feedback = db.query(FeedbackItem).filter(FeedbackItem.project_id == project.id).one()
            tasks = db.query(GenerationTask).filter(GenerationTask.project_id == project.id).order_by(GenerationTask.id).all()
            old_task, new_task = tasks
            old_run = db.query(WorkflowRun).filter(WorkflowRun.generation_task_id == old_task.id).one()
            new_run = db.query(WorkflowRun).filter(WorkflowRun.generation_task_id == new_task.id).one()

            self.assertEqual(feedback.workflow_run.run_kind, "generation")
            self.assertEqual(feedback.feedback_scope, "chapter")
            self.assertEqual(feedback.feedback_type, "user_rejection")
            self.assertEqual(feedback.action_type, "rewrite")
            self.assertEqual(feedback.chapter_index, 2)
            self.assertEqual(feedback.created_by_user_id, owner.id)
            self.assertIn("主角存在感太弱", feedback.content)
            self.assertEqual(old_task.status, "success")
            self.assertIsNotNone(old_task.completed_at)
            self.assertEqual(old_run.status, "completed")
            self.assertEqual(old_run.current_step_key, "completed")
            self.assertEqual(old_run.run_metadata["review_decision"], "rejected")
            self.assertEqual(old_run.run_metadata["continued_with_task_id"], new_task.celery_task_id)
            self.assertEqual(new_task.status, "pending")
            self.assertEqual(new_run.parent_run_id, old_run.id)

            active_tasks = db.query(GenerationTask).filter(
                GenerationTask.project_id == project.id,
                GenerationTask.status.in_(ACTIVE_TASK_STATUSES),
            ).all()
            self.assertEqual([task.celery_task_id for task in active_tasks], [new_task.celery_task_id])
        finally:
            db.close()

    def test_rejected_plan_confirmation_restarts_from_configured_generation_range(self):
        owner = self._create_user("plan_feedback_owner", "plan_feedback_owner@example.com")
        project_dir = self.workspace / "plan-feedback-project"
        project_dir.mkdir()
        project = self._create_project(
            owner,
            name="Plan Feedback Novel",
            file_path=str(project_dir),
            config={
                "novel_name": "Plan Feedback Novel",
                "core_requirement": "一个少年踏上修仙路",
                "chapter_word_count": 2000,
                "start_chapter": 1,
                "end_chapter": 4,
            },
        )
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-plan-feedback-1",
                status="waiting_confirm",
                progress=0.1,
                current_chapter=0,
            )
            db.add(task)
            db.commit()
            db.refresh(task)

            run = WorkflowRun(
                project_id=project.id,
                generation_task_id=task.id,
                run_kind="generation",
                status="waiting_confirm",
                triggered_by_user_id=owner.id,
            )
            db.add(run)
            db.commit()
        finally:
            db.close()

        dispatched_args = []
        original_apply_async = tasks_api.generate_novel_task.apply_async
        try:
            def fake_apply_async(args=None, task_id=None, **kwargs):
                db = self.SessionLocal()
                try:
                    persisted_task = db.query(GenerationTask).filter(
                        GenerationTask.celery_task_id == task_id
                    ).one_or_none()
                    self.assertIsNotNone(persisted_task)
                    dispatched_args.append(args)
                    return SimpleNamespace(id=task_id)
                finally:
                    db.close()

            tasks_api.generate_novel_task.apply_async = fake_apply_async
            response = self.client.post(
                "/api/tasks/celery-plan-feedback-1/confirm",
                json={"approved": False, "feedback": "请把主线目标改得更明确，再重新给我确认。"},
            )
        finally:
            tasks_api.generate_novel_task.apply_async = original_apply_async

        self.assertEqual(response.status_code, 200)
        self.assertEqual(dispatched_args, [(str(project_dir), str(owner.id), 1, 4)])
        self.assertEqual(
            (project_dir / "feedback_plan.txt").read_text(encoding="utf-8"),
            "请把主线目标改得更明确，再重新给我确认。",
        )

        db = self.SessionLocal()
        try:
            feedback = db.query(FeedbackItem).filter(FeedbackItem.project_id == project.id).one()
            tasks = db.query(GenerationTask).filter(GenerationTask.project_id == project.id).order_by(GenerationTask.id).all()
            old_task, new_task = tasks

            self.assertEqual(feedback.feedback_scope, "plan")
            self.assertEqual(feedback.chapter_index, 0)
            self.assertEqual(feedback.action_type, "adjust_plan")
            self.assertEqual(old_task.status, "success")
            self.assertEqual(new_task.status, "pending")
            self.assertEqual(new_task.current_chapter, 0)
        finally:
            db.close()

    def test_approved_final_chapter_confirmation_completes_without_dispatch(self):
        owner = self._create_user("final_confirm_owner", "final_confirm_owner@example.com")
        project_dir = self.workspace / "final-confirm-project"
        project_dir.mkdir()
        project = self._create_project(
            owner,
            name="Final Confirm Novel",
            file_path=str(project_dir),
            config={
                "novel_name": "Final Confirm Novel",
                "core_requirement": "一个少年踏上修仙路",
                "chapter_word_count": 2000,
                "start_chapter": 1,
                "end_chapter": 4,
            },
        )
        (project_dir / "info.json").write_text(
            json.dumps(
                {
                    "overall_quality_score": 8.6,
                    "dimension_average_scores": {"plot": 8.5, "writing": 8.7},
                    "chapter_scores": [{"chapter": 4, "score": 8.6}],
                }
            ),
            encoding="utf-8",
        )
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            db.add(
                Chapter(
                    project_id=project.id,
                    chapter_index=4,
                    title="第4章",
                    content="<p>最终章内容</p>",
                    word_count=5,
                    quality_score=0,
                    status="generated",
                )
            )
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-final-confirm-1",
                status="waiting_confirm",
                progress=0.95,
                current_chapter=4,
            )
            db.add(task)
            db.commit()
            db.refresh(task)

            run = WorkflowRun(
                project_id=project.id,
                generation_task_id=task.id,
                run_kind="generation",
                status="waiting_confirm",
                current_chapter=4,
                triggered_by_user_id=owner.id,
            )
            db.add(run)
            db.commit()
        finally:
            db.close()

        dispatched_args = []
        original_apply_async = tasks_api.generate_novel_task.apply_async
        try:
            def fake_apply_async(args=None, task_id=None, **kwargs):
                dispatched_args.append(args)
                return SimpleNamespace(id=task_id)

            tasks_api.generate_novel_task.apply_async = fake_apply_async
            response = self.client.post(
                "/api/tasks/celery-final-confirm-1/confirm",
                json={"approved": True, "feedback": ""},
            )
        finally:
            tasks_api.generate_novel_task.apply_async = original_apply_async

        self.assertEqual(response.status_code, 200)
        self.assertEqual(dispatched_args, [])
        self.assertTrue(response.json()["completed"])

        db = self.SessionLocal()
        try:
            tasks = db.query(GenerationTask).filter(GenerationTask.project_id == project.id).all()
            self.assertEqual(len(tasks), 1)
            completed_task = tasks[0]
            db_project = db.query(Project).filter(Project.id == project.id).one()
            db_run = db.query(WorkflowRun).filter(WorkflowRun.generation_task_id == completed_task.id).one()

            self.assertEqual(completed_task.status, "success")
            self.assertEqual(completed_task.progress, 1.0)
            self.assertEqual(db_project.status, "completed")
            self.assertEqual(db_project.overall_quality_score, 8.6)
            self.assertEqual(db_project.dimension_average_scores["plot"], 8.5)
            db_chapter = db.query(Chapter).filter(
                Chapter.project_id == project.id,
                Chapter.chapter_index == 4,
            ).one()
            self.assertEqual(db_chapter.quality_score, 8.6)
            self.assertEqual(db_run.status, "completed")
            self.assertTrue(db_run.run_metadata["completed_generation_range"])
            active_tasks = db.query(GenerationTask).filter(
                GenerationTask.project_id == project.id,
                GenerationTask.status.in_(ACTIVE_TASK_STATUSES),
            ).all()
            self.assertEqual(active_tasks, [])
        finally:
            db.close()

    def test_project_list_backfills_quality_score_from_info_json(self):
        owner = self._create_user("quality_backfill_owner", "quality_backfill_owner@example.com")
        project_dir = self.workspace / "quality-backfill-project"
        project_dir.mkdir()
        project = self._create_project_full(owner, name="Quality Backfill Novel", file_path=str(project_dir))
        (project_dir / "info.json").write_text(
            json.dumps(
                {
                    "overall_quality_score": 8.2,
                    "dimension_average_scores": {"plot": 8.1},
                    "chapter_scores": [{"chapter": 1, "score": 8.2}],
                }
            ),
            encoding="utf-8",
        )
        self._set_current_user(owner)

        response = self.client.get("/api/projects")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["items"][0]["overall_quality_score"], 8.2)

        db = self.SessionLocal()
        try:
            db_project = db.query(Project).filter(Project.id == project.id).one()
            self.assertEqual(db_project.overall_quality_score, 8.2)
            self.assertEqual(db_project.dimension_average_scores["plot"], 8.1)
        finally:
            db.close()

    def test_create_project_accepts_novel_name_without_separate_project_name(self):
        owner = self._create_user("novel_only_owner", "novel_only_owner@example.com")
        self._set_current_user(owner)

        response = self.client.post(
            "/api/projects",
            json={
                "novel_name": "时间余额不足",
                "novel_description": "一个关于时间债务的故事",
                "core_requirement": "主角发现每一次加班都在扣除寿命。",
                "content_type": "full_novel",
                "chapter_word_count": 2000,
                "start_chapter": 1,
                "end_chapter": 3,
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["name"], "时间余额不足")
        self.assertEqual(payload["description"], "一个关于时间债务的故事")
        self.assertEqual(payload["config"]["novel_name"], "时间余额不足")
        self.assertEqual(payload["config"]["novel_description"], "一个关于时间债务的故事")

    def test_create_feedback_item_supersedes_previous_open_feedback_for_same_target(self):
        owner = self._create_user("supersede_owner", "supersede_owner@example.com")
        project = self._create_project_full(owner, name="Supersede Novel")

        db = self.SessionLocal()
        try:
            first_feedback = create_feedback_item(
                db=db,
                project_id=project.id,
                workflow_run_id=None,
                created_by_user_id=owner.id,
                content="请增强第二章的冲突感。",
                chapter_index=2,
                feedback_scope="chapter",
                feedback_type="user_rejection",
                action_type="rewrite",
            )
            second_feedback = create_feedback_item(
                db=db,
                project_id=project.id,
                workflow_run_id=None,
                created_by_user_id=owner.id,
                content="请保留剧情但重写第二章文风。",
                chapter_index=2,
                feedback_scope="chapter",
                feedback_type="user_rejection",
                action_type="rewrite",
            )
            db.commit()
            db.refresh(first_feedback)
            db.refresh(second_feedback)

            self.assertEqual(first_feedback.status, "ignored")
            self.assertIsNotNone(first_feedback.resolved_at)
            self.assertEqual(first_feedback.feedback_metadata["resolution_reason"], "superseded")
            self.assertEqual(
                first_feedback.feedback_metadata["superseded_by_feedback_item_id"],
                second_feedback.id,
            )
            self.assertEqual(second_feedback.status, "open")
            self.assertIsNone(second_feedback.resolved_at)
        finally:
            db.close()

    def test_sync_chapter_file_to_db_parses_title_html_and_word_count(self):
        owner = self._create_user("sync_owner", "sync_owner@example.com")
        project_dir = self.workspace / "sync-project"
        project_dir.mkdir()
        project = self._create_project_full(owner, name="Sync Novel", file_path=str(project_dir))
        chapter_file = project_dir / "chapters" / "chapter_1.txt"
        chapter_file.parent.mkdir(parents=True, exist_ok=True)
        chapter_file.write_text("第1章 初见\n\n山雨欲来。\n\n主角登场。", encoding="utf-8")

        title, html_content, word_count = parse_chapter_file_content(chapter_file.read_text(encoding="utf-8"))
        self.assertEqual(title, "第1章 初见")
        self.assertEqual(html_content, "<p>山雨欲来。</p>\n<p>主角登场。</p>")
        self.assertEqual(word_count, 8)

        db = self.SessionLocal()
        try:
            chapter = sync_chapter_file_to_db(
                db=db,
                project=project,
                chapter_index=1,
                chapter_file=chapter_file,
                status="generated",
            )
            db.commit()
            self.assertIsNotNone(chapter)

            db_chapter = db.query(Chapter).filter(
                Chapter.project_id == project.id,
                Chapter.chapter_index == 1,
            ).one()
            self.assertEqual(db_chapter.title, "第1章 初见")
            self.assertEqual(db_chapter.content, "<p>山雨欲来。</p>\n<p>主角登场。</p>")
            self.assertEqual(db_chapter.word_count, 8)
            self.assertEqual(db_chapter.status, "generated")
        finally:
            db.close()

    def test_update_workflow_run_status_tracks_lifecycle_and_completion(self):
        owner = self._create_user("status_owner", "status_owner@example.com")
        project = self._create_project_full(owner, name="Status Novel")

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-status-1",
                status="pending",
                progress=0.0,
            )
            db.add(task)
            db.commit()
            db.refresh(task)

            run = WorkflowRun(
                project_id=project.id,
                generation_task_id=task.id,
                run_kind="generation",
                trigger_source="manual",
                status="pending",
                current_step_key="queued_generation",
                triggered_by_user_id=owner.id,
            )
            db.add(run)
            db.commit()
            db.refresh(run)

            update_workflow_run_status(
                db=db,
                generation_task=task,
                task_status="started",
                current_step_key="booting",
            )
            db.refresh(run)
            self.assertEqual(run.status, "running")
            self.assertEqual(run.current_step_key, "booting")
            booting_step = db.query(WorkflowStepRun).filter(
                WorkflowStepRun.workflow_run_id == run.id,
                WorkflowStepRun.step_key == "booting",
            ).one()
            self.assertEqual(booting_step.status, "running")

            update_workflow_run_status(
                db=db,
                generation_task=task,
                task_status="progress",
                current_step_key="generating_chapter",
                current_chapter=3,
                metadata_updates={"last_message": "正在生成第 3 章..."},
            )
            db.refresh(run)
            self.assertEqual(run.status, "running")
            self.assertEqual(run.current_step_key, "generating_chapter")
            self.assertEqual(run.current_chapter, 3)
            self.assertEqual(run.run_metadata["last_message"], "正在生成第 3 章...")
            db.refresh(booting_step)
            self.assertEqual(booting_step.status, "completed")
            chapter_step = db.query(WorkflowStepRun).filter(
                WorkflowStepRun.workflow_run_id == run.id,
                WorkflowStepRun.step_key == "generating_chapter",
                WorkflowStepRun.chapter_index == 3,
            ).one()
            self.assertEqual(chapter_step.status, "running")
            self.assertEqual(chapter_step.step_type, "generator")
            self.assertEqual(chapter_step.step_data["last_message"], "正在生成第 3 章...")
            self.assertEqual(chapter_step.step_data["agent_contract"]["agent_key"], "writer")
            self.assertEqual(chapter_step.step_data["agent_contract"]["output_schema_ref"], "ChapterDraftArtifact.v1")

            update_workflow_run_status(
                db=db,
                generation_task=task,
                task_status="waiting_confirm",
                current_step_key="waiting_confirm",
                current_chapter=3,
            )
            db.refresh(run)
            self.assertEqual(run.status, "waiting_confirm")
            self.assertEqual(run.current_step_key, "waiting_confirm")
            db.refresh(chapter_step)
            self.assertEqual(chapter_step.status, "completed")
            waiting_step = db.query(WorkflowStepRun).filter(
                WorkflowStepRun.workflow_run_id == run.id,
                WorkflowStepRun.step_key == "waiting_confirm",
                WorkflowStepRun.chapter_index == 3,
            ).one()
            self.assertEqual(waiting_step.status, "waiting_confirm")
            self.assertEqual(waiting_step.step_type, "approval")

            update_workflow_run_status(
                db=db,
                generation_task=task,
                task_status="success",
                current_step_key="completed",
            )
            db.refresh(run)
            self.assertEqual(run.status, "completed")
            self.assertEqual(run.current_step_key, "completed")
            self.assertIsNotNone(run.completed_at)
            db.refresh(waiting_step)
            self.assertEqual(waiting_step.status, "completed")
            completed_step = db.query(WorkflowStepRun).filter(
                WorkflowStepRun.workflow_run_id == run.id,
                WorkflowStepRun.step_key == "completed",
            ).one()
            self.assertEqual(completed_step.status, "completed")
            self.assertEqual(completed_step.step_type, "system")
        finally:
            db.close()

    def test_generate_novel_task_waiting_confirm_updates_workflow_run_status(self):
        owner = self._create_user("waiting_owner", "waiting_owner@example.com")
        project_dir = self.workspace / "waiting-project"
        project_dir.mkdir()
        project = self._create_project_full(owner, name="Waiting Novel", file_path=str(project_dir))

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-waiting-1",
                status="pending",
                progress=0.0,
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            create_generation_workflow_run(
                db=db,
                project=project,
                generation_task=task,
                triggered_by_user_id=owner.id,
            )
            db.commit()
        finally:
            db.close()

        class FakeOrchestrator:
            def __init__(self, project_dir, progress_callback, user_api_key, cancellation_checker=None, writer_perspective=None, perspective_strength=0.7, use_perspective_critic=True):
                self.project_dir = Path(project_dir)
                self.progress_callback = progress_callback

            def run_full_novel(self):
                self.progress_callback(35, "正在生成第 2 章...")
                chapters_dir = self.project_dir / "chapters"
                chapters_dir.mkdir(parents=True, exist_ok=True)
                (chapters_dir / "chapter_2.txt").write_text("第2章 待确认标题\n\n待审阅章节正文", encoding="utf-8")
                raise writing_tasks.WaitingForConfirmationError(2, "待审阅章节")

        original_session_local = writing_tasks.SessionLocal
        original_orchestrator = writing_tasks.NovelOrchestrator
        try:
            writing_tasks.SessionLocal = self.SessionLocal
            writing_tasks.NovelOrchestrator = FakeOrchestrator
            writing_tasks.generate_novel_task.push_request(id="celery-waiting-1", retries=0)
            result = writing_tasks.generate_novel_task.run(project_dir=str(project_dir), user_id=str(owner.id))
        finally:
            writing_tasks.generate_novel_task.pop_request()
            writing_tasks.SessionLocal = original_session_local
            writing_tasks.NovelOrchestrator = original_orchestrator

        self.assertTrue(result["waiting_confirmation"])
        self.assertEqual(result["chapter_index"], 2)

        db = self.SessionLocal()
        try:
            task = db.query(GenerationTask).filter(GenerationTask.celery_task_id == "celery-waiting-1").one()
            run = db.query(WorkflowRun).filter(WorkflowRun.generation_task_id == task.id).one()
            self.assertEqual(task.status, "waiting_confirm")
            self.assertEqual(run.status, "waiting_confirm")
            self.assertEqual(run.current_step_key, "waiting_confirm")
            self.assertEqual(run.current_chapter, 2)
            self.assertTrue(run.run_metadata["waiting_confirmation"])
            chapter = db.query(Chapter).filter(
                Chapter.project_id == project.id,
                Chapter.chapter_index == 2,
            ).one()
            self.assertEqual(chapter.title, "第2章 待确认标题")
            self.assertIn("待审阅章节正文", chapter.content)
            chapter_artifact = db.query(Artifact).filter(
                Artifact.project_id == project.id,
                Artifact.artifact_type == "chapter_draft",
                Artifact.chapter_index == 2,
                Artifact.is_current.is_(True),
            ).one()
            self.assertEqual(chapter_artifact.workflow_run_id, run.id)
            step_keys = [
                (step.step_key, step.status, step.chapter_index)
                for step in db.query(WorkflowStepRun)
                .filter(WorkflowStepRun.workflow_run_id == run.id)
                .order_by(WorkflowStepRun.id)
            ]
            self.assertEqual(
                step_keys,
                [
                    ("queued_generation", "completed", None),
                    ("booting", "completed", None),
                    ("generating_chapter", "completed", 2),
                    ("waiting_confirm", "waiting_confirm", 2),
                ],
            )
        finally:
            db.close()

    def test_generate_novel_task_success_updates_workflow_run_status(self):
        owner = self._create_user("success_owner", "success_owner@example.com")
        project_dir = self.workspace / "success-project"
        project_dir.mkdir()
        chapters_dir = project_dir / "chapters"
        chapters_dir.mkdir()
        (chapters_dir / "chapter_1.txt").write_text("第1章 标题\n\n章节内容", encoding="utf-8")
        project = self._create_project_full(owner, name="Success Novel", file_path=str(project_dir))
        custom_api_key = "abcd1234efgh5678"

        db = self.SessionLocal()
        try:
            user = db.query(User).filter(User.id == owner.id).one()
            set_user_api_key(user, custom_api_key)
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-success-1",
                status="pending",
                progress=0.0,
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            run = create_generation_workflow_run(
                db=db,
                project=project,
                generation_task=task,
                triggered_by_user_id=owner.id,
            )
            task_db_id = task.id
            run_id = run.id
            db.commit()
        finally:
            db.close()

        test_case = self

        class FakeOrchestrator:
            def __init__(self, project_dir, progress_callback, user_api_key, cancellation_checker=None, writer_perspective=None, perspective_strength=0.7, use_perspective_critic=True):
                self.project_dir = Path(project_dir)
                self.progress_callback = progress_callback
                test_case.assertEqual(user_api_key, custom_api_key)

            def run_full_novel(self):
                test_case.assertEqual(get_current_output_dir_optional(), self.project_dir)
                run_context = get_current_run_context_optional()
                test_case.assertIsNotNone(run_context)
                test_case.assertEqual(run_context.project_id, project.id)
                test_case.assertEqual(run_context.project_path, self.project_dir)
                test_case.assertEqual(run_context.generation_task_id, task_db_id)
                test_case.assertEqual(run_context.celery_task_id, "celery-success-1")
                test_case.assertEqual(run_context.workflow_run_id, run_id)
                test_case.assertEqual(run_context.user_id, owner.id)
                self.progress_callback(80, "正在生成第 1 章...")
                self.progress_callback(90, "第 1 章生成完成")
                (self.project_dir / "info.json").write_text(
                    json.dumps(
                        {
                            "chapter_scores": [
                                {"chapter": 1, "score": 9, "passed": True, "issues": []}
                            ],
                            "overall_quality_score": 9,
                            "dimension_average_scores": {"plot": 9},
                            "evaluation_harness_version": "chapter-evaluation-v1",
                            "evaluation_reports": [
                                {
                                    "harness_version": "chapter-evaluation-v1",
                                    "chapter_index": 1,
                                    "passed": True,
                                    "score": 9.0,
                                    "dimensions": {"plot": 9.0},
                                    "issues": [],
                                    "evaluator_agent": "critic",
                                    "content_type": "novel",
                                    "revision_round": 0,
                                    "created_at": "2026-04-23T00:00:00",
                                    "metadata": {},
                                }
                            ],
                        },
                        ensure_ascii=False,
                    ),
                    encoding="utf-8",
                )
                self.progress_callback(100, "🎉 完成")
                return {"generated_chapters": 1}

        original_session_local = writing_tasks.SessionLocal
        original_orchestrator = writing_tasks.NovelOrchestrator
        previous_output_dir = self.workspace / "previous-runtime-project"
        set_current_output_dir(previous_output_dir)
        try:
            writing_tasks.SessionLocal = self.SessionLocal
            writing_tasks.NovelOrchestrator = FakeOrchestrator
            writing_tasks.generate_novel_task.push_request(id="celery-success-1", retries=0)
            result = writing_tasks.generate_novel_task.run(project_dir=str(project_dir), user_id=str(owner.id))
        finally:
            writing_tasks.generate_novel_task.pop_request()
            writing_tasks.SessionLocal = original_session_local
            writing_tasks.NovelOrchestrator = original_orchestrator

        self.assertTrue(result["success"])
        self.assertTrue(result["completed"])
        self.assertEqual(get_current_output_dir_optional(), previous_output_dir)
        self.assertIsNone(get_current_run_context_optional())

        db = self.SessionLocal()
        try:
            task = db.query(GenerationTask).filter(GenerationTask.celery_task_id == "celery-success-1").one()
            run = db.query(WorkflowRun).filter(WorkflowRun.generation_task_id == task.id).one()
            self.assertEqual(task.status, "success")
            self.assertEqual(run.status, "completed")
            self.assertEqual(run.current_step_key, "completed")
            self.assertIsNotNone(run.completed_at)
            self.assertTrue(run.run_metadata["completed"])
            chapter_artifacts = db.query(Artifact).filter(
                Artifact.project_id == project.id,
                Artifact.artifact_type == "chapter_draft",
                Artifact.scope == "chapter",
                Artifact.chapter_index == 1,
            ).all()
            self.assertEqual(len(chapter_artifacts), 1)
            chapter_artifact = chapter_artifacts[0]
            self.assertEqual(chapter_artifact.workflow_run_id, run.id)
            self.assertEqual(chapter_artifact.version_number, 1)
            self.assertTrue(chapter_artifact.is_current)
            self.assertIn("章节内容", chapter_artifact.content_text)
            self.assertEqual(chapter_artifact.content_json["title"], "第1章 标题")
            evaluation_artifact = db.query(Artifact).filter(
                Artifact.project_id == project.id,
                Artifact.artifact_type == "chapter_evaluation",
                Artifact.scope == "chapter",
                Artifact.chapter_index == 1,
            ).one()
            self.assertEqual(evaluation_artifact.workflow_run_id, run.id)
            self.assertEqual(evaluation_artifact.content_json["harness_version"], "chapter-evaluation-v1")
            self.assertEqual(evaluation_artifact.content_json["score"], 9.0)
            step_keys = [
                (step.step_key, step.status, step.chapter_index)
                for step in db.query(WorkflowStepRun)
                .filter(WorkflowStepRun.workflow_run_id == run.id)
                .order_by(WorkflowStepRun.id)
            ]
            self.assertEqual(
                step_keys,
                [
                    ("queued_generation", "completed", None),
                    ("booting", "completed", None),
                    ("generating_chapter", "completed", 1),
                    ("completed", "completed", None),
                ],
            )
            generating_step = db.query(WorkflowStepRun).filter(
                WorkflowStepRun.workflow_run_id == run.id,
                WorkflowStepRun.step_key == "generating_chapter",
                WorkflowStepRun.chapter_index == 1,
            ).one()
            self.assertEqual(generating_step.output_artifact_id, chapter_artifact.id)
        finally:
            db.close()

    def test_generate_novel_task_empty_range_completes_without_orchestrator(self):
        owner = self._create_user("empty_range_owner", "empty_range_owner@example.com")
        project_dir = self.workspace / "empty-range-project"
        project_dir.mkdir()
        project = self._create_project(
            owner,
            name="Empty Range Novel",
            file_path=str(project_dir),
            config={
                "novel_name": "Empty Range Novel",
                "core_requirement": "一个少年踏上修仙路",
                "chapter_word_count": 2000,
                "start_chapter": 1,
                "end_chapter": 4,
            },
        )

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-empty-range-1",
                status="pending",
                progress=0.0,
                current_chapter=5,
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            create_generation_workflow_run(
                db=db,
                project=project,
                generation_task=task,
                triggered_by_user_id=owner.id,
            )
            db.commit()
        finally:
            db.close()

        class ExplodingOrchestrator:
            def __init__(self, *args, **kwargs):
                raise AssertionError("orchestrator should not run for an empty chapter range")

        original_session_local = writing_tasks.SessionLocal
        original_orchestrator = writing_tasks.NovelOrchestrator
        try:
            writing_tasks.SessionLocal = self.SessionLocal
            writing_tasks.NovelOrchestrator = ExplodingOrchestrator
            writing_tasks.generate_novel_task.push_request(id="celery-empty-range-1", retries=0)
            result = writing_tasks.generate_novel_task.run(
                project_dir=str(project_dir),
                user_id=str(owner.id),
                start_chapter=5,
                end_chapter=4,
            )
        finally:
            writing_tasks.generate_novel_task.pop_request()
            writing_tasks.SessionLocal = original_session_local
            writing_tasks.NovelOrchestrator = original_orchestrator

        self.assertTrue(result["success"])
        self.assertTrue(result["completed"])
        self.assertTrue(result["no_remaining_chapters"])

        db = self.SessionLocal()
        try:
            task = db.query(GenerationTask).filter(GenerationTask.celery_task_id == "celery-empty-range-1").one()
            run = db.query(WorkflowRun).filter(WorkflowRun.generation_task_id == task.id).one()
            db_project = db.query(Project).filter(Project.id == project.id).one()

            self.assertEqual(task.status, "success")
            self.assertEqual(task.progress, 1.0)
            self.assertEqual(db_project.status, "completed")
            self.assertEqual(run.status, "completed")
            self.assertTrue(run.run_metadata["no_remaining_chapters"])
        finally:
            db.close()

    def test_generate_novel_task_cancelled_during_execution_updates_workflow_run_status(self):
        owner = self._create_user("cancel_owner", "cancel_owner@example.com")
        project_dir = self.workspace / "cancel-project"
        project_dir.mkdir()
        project = self._create_project_full(owner, name="Cancel Novel", file_path=str(project_dir))

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-cancel-1",
                status="pending",
                progress=0.0,
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            create_generation_workflow_run(
                db=db,
                project=project,
                generation_task=task,
                triggered_by_user_id=owner.id,
            )
            db.commit()
        finally:
            db.close()

        test_case = self

        class FakeOrchestrator:
            def __init__(self, project_dir, progress_callback, user_api_key, cancellation_checker=None, writer_perspective=None, perspective_strength=0.7, use_perspective_critic=True):
                self.progress_callback = progress_callback
                self.cancellation_checker = cancellation_checker

            def run_full_novel(self):
                db = test_case.SessionLocal()
                try:
                    task = db.query(GenerationTask).filter(
                        GenerationTask.celery_task_id == "celery-cancel-1"
                    ).one()
                    task.status = "cancelled"
                    db.commit()
                finally:
                    db.close()

                self.progress_callback(45, "正在生成第 2 章...")
                raise AssertionError("progress callback should stop cancelled tasks before continuing")

        original_session_local = writing_tasks.SessionLocal
        original_orchestrator = writing_tasks.NovelOrchestrator
        try:
            writing_tasks.SessionLocal = self.SessionLocal
            writing_tasks.NovelOrchestrator = FakeOrchestrator
            writing_tasks.generate_novel_task.push_request(id="celery-cancel-1", retries=0)
            result = writing_tasks.generate_novel_task.run(project_dir=str(project_dir), user_id=str(owner.id))
        finally:
            writing_tasks.generate_novel_task.pop_request()
            writing_tasks.SessionLocal = original_session_local
            writing_tasks.NovelOrchestrator = original_orchestrator

        self.assertTrue(result["cancelled"])
        self.assertIn("cancelled", result["message"])

        db = self.SessionLocal()
        try:
            task = db.query(GenerationTask).filter(GenerationTask.celery_task_id == "celery-cancel-1").one()
            run = db.query(WorkflowRun).filter(WorkflowRun.generation_task_id == task.id).one()
            self.assertEqual(task.status, "cancelled")
            self.assertIn("cancelled", task.error_message)
            self.assertIsNotNone(task.completed_at)
            self.assertEqual(run.status, "cancelled")
            self.assertEqual(run.current_step_key, "cancelled")
            self.assertTrue(run.run_metadata["cancelled_during_execution"])
        finally:
            db.close()

    def test_trigger_generation_blocks_when_waiting_confirm_task_exists(self):
        owner = self._create_user("active_generation_owner", "active_generation_owner@example.com")
        project_dir = self.workspace / "active-generation-project"
        project_dir.mkdir()
        project = self._create_project_full(owner, name="Active Generation Novel", file_path=str(project_dir))
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            db.add(
                GenerationTask(
                    project_id=project.id,
                    celery_task_id="celery-active-generate-1",
                    status="waiting_confirm",
                    progress=0.6,
                    current_chapter=2,
                )
            )
            db.commit()
        finally:
            db.close()

        response = self.client.post(f"/api/projects/{project.id}/generate")
        self.assertEqual(response.status_code, 400)
        self.assertIn("已有运行中的任务", response.json()["detail"])

    def test_trigger_export_blocks_when_waiting_confirm_task_exists(self):
        owner = self._create_user("active_export_owner", "active_export_owner@example.com")
        project_dir = self.workspace / "active-export-project"
        project_dir.mkdir()
        project = self._create_project_full(owner, name="Active Export Novel", file_path=str(project_dir))
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            db.add(
                GenerationTask(
                    project_id=project.id,
                    celery_task_id="celery-active-export-1",
                    status="waiting_confirm",
                    progress=0.6,
                    current_chapter=2,
                )
            )
            db.commit()
        finally:
            db.close()

        response = self.client.post(f"/api/projects/{project.id}/export?format=epub")
        self.assertEqual(response.status_code, 400)
        self.assertIn("已有运行中的任务", response.json()["detail"])

    def test_trigger_export_persists_task_before_dispatch(self):
        owner = self._create_user("export_dispatch_owner", "export_dispatch_owner@example.com")
        project_dir = self.workspace / "export-dispatch-project"
        project_dir.mkdir()
        project = self._create_project_full(owner, name="Export Dispatch Novel", file_path=str(project_dir))
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            db.add(
                Chapter(
                    project_id=project.id,
                    chapter_index=1,
                    title="第1章",
                    content="<p>章节内容</p>",
                    word_count=4,
                    status="generated",
                )
            )
            db.commit()
        finally:
            db.close()

        dispatched_task_ids = []
        original_apply_async = export_tasks.export_project_task.apply_async
        try:
            def fake_apply_async(args=None, task_id=None, **kwargs):
                db = self.SessionLocal()
                try:
                    persisted_task = db.query(GenerationTask).filter(
                        GenerationTask.celery_task_id == task_id
                    ).one_or_none()
                    self.assertIsNotNone(persisted_task)
                    dispatched_task_ids.append(task_id)
                    return SimpleNamespace(id=task_id)
                finally:
                    db.close()

            export_tasks.export_project_task.apply_async = fake_apply_async
            response = self.client.post(f"/api/projects/{project.id}/export?format=html")
        finally:
            export_tasks.export_project_task.apply_async = original_apply_async

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(dispatched_task_ids), 1)

    def test_regenerate_chapter_blocks_when_waiting_confirm_task_exists(self):
        owner = self._create_user("active_regen_owner", "active_regen_owner@example.com")
        project_dir = self.workspace / "active-regen-project"
        project_dir.mkdir()
        project = self._create_project_full(owner, name="Active Regen Novel", file_path=str(project_dir))
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            db.add(
                Chapter(
                    project_id=project.id,
                    chapter_index=1,
                    title="第1章",
                    content="<p>章节内容</p>",
                    word_count=4,
                    status="generated",
                )
            )
            db.add(
                GenerationTask(
                    project_id=project.id,
                    celery_task_id="celery-active-regen-1",
                    status="waiting_confirm",
                    progress=0.6,
                    current_chapter=1,
                )
            )
            db.commit()
        finally:
            db.close()

        response = self.client.post(f"/api/projects/{project.id}/chapters/1/regenerate")
        self.assertEqual(response.status_code, 400)
        self.assertIn("已有运行中的任务", response.json()["detail"])

    def test_regenerate_chapter_persists_task_before_dispatch(self):
        owner = self._create_user("regen_dispatch_owner", "regen_dispatch_owner@example.com")
        project_dir = self.workspace / "regen-dispatch-project"
        project_dir.mkdir()
        project = self._create_project_full(owner, name="Regen Dispatch Novel", file_path=str(project_dir))
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            db.add(
                Chapter(
                    project_id=project.id,
                    chapter_index=1,
                    title="第1章",
                    content="<p>章节内容</p>",
                    word_count=4,
                    status="generated",
                )
            )
            db.commit()
        finally:
            db.close()

        dispatched_task_ids = []
        original_apply_async = chapters_api.generate_novel_task.apply_async
        try:
            def fake_apply_async(args=None, task_id=None, **kwargs):
                db = self.SessionLocal()
                try:
                    persisted_task = db.query(GenerationTask).filter(
                        GenerationTask.celery_task_id == task_id
                    ).one_or_none()
                    self.assertIsNotNone(persisted_task)
                    dispatched_task_ids.append(task_id)
                    return SimpleNamespace(id=task_id)
                finally:
                    db.close()

            chapters_api.generate_novel_task.apply_async = fake_apply_async
            response = self.client.post(f"/api/projects/{project.id}/chapters/1/regenerate")
        finally:
            chapters_api.generate_novel_task.apply_async = original_apply_async

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(dispatched_task_ids), 1)

    def test_clean_stuck_tasks_marks_task_and_workflow_failed(self):
        owner = self._create_user("clean_stuck_owner", "clean_stuck_owner@example.com")
        project = self._create_project_full(owner, name="Clean Stuck Novel")
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-clean-stuck-1",
                status="progress",
                progress=0.4,
                current_chapter=2,
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            run = create_generation_workflow_run(
                db=db,
                project=project,
                generation_task=task,
                triggered_by_user_id=owner.id,
            )
            update_workflow_run_status(
                db=db,
                generation_task=task,
                task_status="progress",
                current_step_key="generating_chapter",
                current_chapter=2,
            )
            run_id = run.id
            db.commit()
        finally:
            db.close()

        response = self.client.post(f"/api/projects/{project.id}/clean-stuck-tasks")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["cleaned_count"], 1)

        db = self.SessionLocal()
        try:
            task = db.query(GenerationTask).filter(GenerationTask.celery_task_id == "celery-clean-stuck-1").one()
            run = db.query(WorkflowRun).filter(WorkflowRun.id == run_id).one()
            failed_step = db.query(WorkflowStepRun).filter(
                WorkflowStepRun.workflow_run_id == run.id,
                WorkflowStepRun.step_key == "failed",
            ).one()

            self.assertEqual(task.status, "failure")
            self.assertEqual(task.error_message, "User manually cleaned up stuck task")
            self.assertIsNotNone(task.completed_at)
            self.assertEqual(run.status, "failed")
            self.assertEqual(run.current_step_key, "failed")
            self.assertEqual(run.run_metadata["failed_by"], "manual_cleanup")
            self.assertIsNotNone(run.completed_at)
            self.assertEqual(failed_step.status, "failed")
        finally:
            db.close()

    def test_reset_project_marks_active_tasks_cancelled_even_without_celery(self):
        owner = self._create_user("reset_cancel_owner", "reset_cancel_owner@example.com")
        project_dir = self.workspace / "reset-cancel-project"
        chapters_dir = project_dir / "chapters"
        chapters_dir.mkdir(parents=True)
        (chapters_dir / "chapter_1.txt").write_text("旧章节", encoding="utf-8")
        project = self._create_project_full(owner, name="Reset Cancel Novel", file_path=str(project_dir))
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            chapter = Chapter(
                project_id=project.id,
                chapter_index=1,
                title="第1章",
                content="<p>旧章节</p>",
                word_count=3,
                status="generated",
            )
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-reset-cancel-1",
                status="waiting_confirm",
                progress=0.6,
                current_chapter=1,
            )
            db.add_all([chapter, task])
            db.commit()
            db.refresh(task)
            run = create_generation_workflow_run(
                db=db,
                project=project,
                generation_task=task,
                triggered_by_user_id=owner.id,
            )
            update_workflow_run_status(
                db=db,
                generation_task=task,
                task_status="waiting_confirm",
                current_step_key="waiting_confirm",
                current_chapter=1,
            )
            run_id = run.id
            db.commit()
        finally:
            db.close()

        original_celery_available = projects_api.CELERY_AVAILABLE
        try:
            projects_api.CELERY_AVAILABLE = False
            response = self.client.post(f"/api/projects/{project.id}/reset")
        finally:
            projects_api.CELERY_AVAILABLE = original_celery_available

        self.assertEqual(response.status_code, 200)
        self.assertFalse((chapters_dir / "chapter_1.txt").exists())

        db = self.SessionLocal()
        try:
            task = db.query(GenerationTask).filter(GenerationTask.celery_task_id == "celery-reset-cancel-1").one()
            run = db.query(WorkflowRun).filter(WorkflowRun.id == run_id).one()
            project_after_reset = db.query(Project).filter(Project.id == project.id).one()

            self.assertEqual(task.status, "cancelled")
            self.assertEqual(task.error_message, "Project reset cancelled this task")
            self.assertIsNotNone(task.completed_at)
            self.assertEqual(run.status, "cancelled")
            self.assertEqual(run.current_step_key, "cancelled")
            self.assertEqual(run.run_metadata["cancelled_by"], "project_reset")
            self.assertEqual(project_after_reset.status, "draft")
            self.assertEqual(db.query(Chapter).filter(Chapter.project_id == project.id).count(), 0)
        finally:
            db.close()

    def test_task_status_endpoint_includes_workflow_run_steps_and_feedback(self):
        owner = self._create_user("status_api_owner", "status_api_owner@example.com")
        project = self._create_project_full(owner, name="Status API Novel")
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-status-api-1",
                status="waiting_confirm",
                progress=0.6,
                current_chapter=2,
                current_step="第2章生成完成，等待你审阅确认",
            )
            db.add(task)
            db.commit()
            db.refresh(task)

            run = create_generation_workflow_run(
                db=db,
                project=project,
                generation_task=task,
                triggered_by_user_id=owner.id,
            )
            update_workflow_run_status(
                db=db,
                generation_task=task,
                task_status="progress",
                current_step_key="generating_chapter",
                current_chapter=2,
                metadata_updates={"last_message": "正在生成第 2 章..."},
            )
            chapter_artifact = create_artifact(
                db=db,
                project_id=project.id,
                workflow_run_id=run.id,
                artifact_type="chapter_draft",
                scope="chapter",
                chapter_index=2,
                source="agent",
                content_text="第二章草稿",
            )
            chapter_step = db.query(WorkflowStepRun).filter(
                WorkflowStepRun.workflow_run_id == run.id,
                WorkflowStepRun.step_key == "generating_chapter",
                WorkflowStepRun.chapter_index == 2,
            ).one()
            chapter_step.output_artifact_id = chapter_artifact.id
            chapter_artifact_id = chapter_artifact.id
            update_workflow_run_status(
                db=db,
                generation_task=task,
                task_status="waiting_confirm",
                current_step_key="waiting_confirm",
                current_chapter=2,
                metadata_updates={"waiting_confirmation": True},
            )
            feedback = FeedbackItem(
                project_id=project.id,
                workflow_run_id=run.id,
                created_by_user_id=owner.id,
                feedback_scope="chapter",
                feedback_type="user_rejection",
                action_type="rewrite",
                chapter_index=2,
                status="open",
                content="请增强这一章的冲突感。",
            )
            db.add(feedback)
            db.commit()
        finally:
            db.close()

        class FakeAsyncResult:
            def __init__(self, task_id, app=None):
                self.state = "PROGRESS"
                self.info = {"percent": 60, "message": "正在生成第 2 章..."}
                self.result = None

        original_async_result = tasks_api.AsyncResult
        try:
            tasks_api.AsyncResult = FakeAsyncResult
            response = self.client.get("/api/tasks/celery-status-api-1")
        finally:
            tasks_api.AsyncResult = original_async_result

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("workflow_run", payload)
        self.assertEqual(payload["workflow_run"]["status"], "waiting_confirm")
        self.assertEqual(payload["workflow_run"]["current_step_key"], "waiting_confirm")
        self.assertEqual(payload["workflow_run"]["current_chapter"], 2)
        self.assertEqual(
            [step["step_key"] for step in payload["workflow_run"]["steps"]],
            ["queued_generation", "generating_chapter", "waiting_confirm"],
        )
        generating_step = payload["workflow_run"]["steps"][1]
        self.assertEqual(generating_step["output_artifact_id"], chapter_artifact_id)
        self.assertEqual(generating_step["output_artifact"]["artifact_type"], "chapter_draft")
        self.assertEqual(generating_step["output_artifact"]["chapter_index"], 2)
        self.assertEqual(payload["workflow_run"]["feedback_items"][0]["content"], "请增强这一章的冲突感。")

    def test_project_detail_includes_current_generation_task_workflow_summary(self):
        owner = self._create_user("project_api_owner", "project_api_owner@example.com")
        project = self._create_project_full(owner, name="Project API Novel")
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-project-api-1",
                status="progress",
                progress=0.4,
                current_chapter=1,
                current_step="正在生成第 1 章...",
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            create_generation_workflow_run(
                db=db,
                project=project,
                generation_task=task,
                triggered_by_user_id=owner.id,
            )
            update_workflow_run_status(
                db=db,
                generation_task=task,
                task_status="progress",
                current_step_key="generating_chapter",
                current_chapter=1,
                metadata_updates={"last_message": "正在生成第 1 章..."},
            )
            db.commit()
        finally:
            db.close()

        response = self.client.get(f"/api/projects/{project.id}")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("current_generation_task", payload)
        self.assertEqual(payload["current_generation_task"]["celery_task_id"], "celery-project-api-1")
        self.assertEqual(payload["current_generation_task"]["current_workflow_run"]["status"], "running")
        self.assertEqual(payload["current_generation_task"]["current_workflow_run"]["current_step_key"], "generating_chapter")

    def test_workflow_runs_endpoint_returns_recent_runs_with_steps_and_feedback(self):
        owner = self._create_user("workflow_runs_owner", "workflow_runs_owner@example.com")
        project = self._create_project_full(owner, name="Workflow Runs Novel")
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            first_task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-workflow-runs-1",
                status="success",
                progress=1.0,
                current_chapter=1,
            )
            second_task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-workflow-runs-2",
                status="waiting_confirm",
                progress=0.8,
                current_chapter=2,
            )
            db.add_all([first_task, second_task])
            db.commit()
            db.refresh(first_task)
            db.refresh(second_task)

            first_run = create_generation_workflow_run(
                db=db,
                project=project,
                generation_task=first_task,
                triggered_by_user_id=owner.id,
            )
            second_run = create_generation_workflow_run(
                db=db,
                project=project,
                generation_task=second_task,
                triggered_by_user_id=owner.id,
                parent_run=first_run,
            )
            update_workflow_run_status(
                db=db,
                generation_task=first_task,
                task_status="success",
                current_step_key="completed",
                current_chapter=1,
                metadata_updates={"summary": "第一轮已完成"},
            )
            update_workflow_run_status(
                db=db,
                generation_task=second_task,
                task_status="waiting_confirm",
                current_step_key="waiting_confirm",
                current_chapter=2,
                metadata_updates={"summary": "第二轮等待确认"},
            )
            db.add(
                FeedbackItem(
                    project_id=project.id,
                    workflow_run_id=second_run.id,
                    created_by_user_id=owner.id,
                    feedback_scope="chapter",
                    feedback_type="user_note",
                    action_type="revise",
                    chapter_index=2,
                    status="open",
                    content="请补强第二章结尾钩子。",
                )
            )
            db.commit()
            first_run_id = first_run.id
            second_run_id = second_run.id
            first_task_id = first_task.id
            second_task_id = second_task.id
        finally:
            db.close()

        response = self.client.get(f"/api/projects/{project.id}/workflow-runs")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total"], 2)
        self.assertEqual([item["id"] for item in payload["items"]], [second_run_id, first_run_id])
        latest_run = payload["items"][0]
        self.assertEqual(latest_run["generation_task_id"], second_task_id)
        self.assertEqual(latest_run["parent_run_id"], first_run_id)
        self.assertEqual(latest_run["run_kind"], "generation")
        self.assertEqual(latest_run["trigger_source"], "feedback")
        self.assertEqual(latest_run["status"], "waiting_confirm")
        self.assertEqual(latest_run["steps"][-1]["step_key"], "waiting_confirm")
        self.assertEqual(latest_run["feedback_items"][0]["content"], "请补强第二章结尾钩子。")

    def test_artifacts_endpoint_filters_by_scope_current_only_and_workflow_run(self):
        owner = self._create_user("artifact_api_owner", "artifact_api_owner@example.com")
        project = self._create_project_full(owner, name="Artifact API Novel")
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-artifact-api-1",
                status="progress",
                progress=0.5,
                current_chapter=2,
            )
            db.add(task)
            db.commit()
            db.refresh(task)

            run = create_generation_workflow_run(
                db=db,
                project=project,
                generation_task=task,
                triggered_by_user_id=owner.id,
            )
            initial_project_snapshot = db.query(Artifact).filter(
                Artifact.workflow_run_id == run.id,
                Artifact.artifact_type == "project_config_snapshot",
                Artifact.scope == "project",
            ).one()
            project_artifact_v1 = create_artifact(
                db=db,
                project_id=project.id,
                workflow_run_id=run.id,
                artifact_type="project_config_snapshot",
                scope="project",
                source="system",
                content_json={"version": 1},
            )
            project_artifact_v2 = create_artifact(
                db=db,
                project_id=project.id,
                workflow_run_id=run.id,
                artifact_type="project_config_snapshot",
                scope="project",
                source="system",
                content_json={"version": 2},
            )
            chapter_artifact_v1 = create_artifact(
                db=db,
                project_id=project.id,
                workflow_run_id=run.id,
                artifact_type="chapter_draft",
                scope="chapter",
                chapter_index=2,
                source="agent",
                content_text="第二章初稿",
            )
            chapter_artifact_v2 = create_artifact(
                db=db,
                project_id=project.id,
                workflow_run_id=run.id,
                artifact_type="chapter_draft",
                scope="chapter",
                chapter_index=2,
                source="agent",
                content_text="第二章二稿",
            )
            db.commit()
            run_id = run.id
            initial_project_snapshot_id = initial_project_snapshot.id
            project_artifact_v1_id = project_artifact_v1.id
            project_artifact_v2_id = project_artifact_v2.id
            chapter_artifact_v1_id = chapter_artifact_v1.id
            chapter_artifact_v2_id = chapter_artifact_v2.id
        finally:
            db.close()

        response = self.client.get(
            f"/api/projects/{project.id}/artifacts",
            params={
                "artifact_type": "chapter_draft",
                "scope": "chapter",
                "chapter_index": 2,
                "current_only": True,
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total"], 1)
        self.assertEqual(payload["items"][0]["id"], chapter_artifact_v2_id)
        self.assertTrue(payload["items"][0]["is_current"])

        project_scope_response = self.client.get(
            f"/api/projects/{project.id}/artifacts",
            params={
                "artifact_type": "project_config_snapshot",
                "scope": "project",
            },
        )
        self.assertEqual(project_scope_response.status_code, 200)
        project_scope_payload = project_scope_response.json()
        self.assertEqual(project_scope_payload["total"], 3)
        self.assertEqual(
            [item["id"] for item in project_scope_payload["items"]],
            [project_artifact_v2_id, project_artifact_v1_id, initial_project_snapshot_id],
        )

        run_filtered_response = self.client.get(
            f"/api/projects/{project.id}/artifacts",
            params={
                "workflow_run_id": run_id,
                "scope": "chapter",
            },
        )
        self.assertEqual(run_filtered_response.status_code, 200)
        run_filtered_payload = run_filtered_response.json()
        self.assertEqual(
            [item["id"] for item in run_filtered_payload["items"]],
            [chapter_artifact_v2_id, chapter_artifact_v1_id],
        )

    def test_artifact_detail_endpoint_returns_full_content(self):
        owner = self._create_user("artifact_detail_owner", "artifact_detail_owner@example.com")
        project = self._create_project_full(owner, name="Artifact Detail Novel")
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            artifact = create_artifact(
                db=db,
                project_id=project.id,
                artifact_type="chapter_evaluation",
                scope="chapter",
                chapter_index=3,
                source="agent",
                content_json={
                    "overall_score": 8.7,
                    "strengths": ["节奏稳定", "结尾钩子清晰"],
                    "issues": [{"dimension": "冲突", "summary": "中段张力略弱"}],
                },
            )
            db.commit()
            artifact_id = artifact.id
        finally:
            db.close()

        response = self.client.get(f"/api/projects/{project.id}/artifacts/{artifact_id}")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], artifact_id)
        self.assertEqual(payload["artifact_type"], "chapter_evaluation")
        self.assertEqual(payload["scope"], "chapter")
        self.assertEqual(payload["chapter_index"], 3)
        self.assertIsNone(payload["content_text"])
        self.assertEqual(payload["content_json"]["overall_score"], 8.7)
        self.assertEqual(payload["content_json"]["issues"][0]["dimension"], "冲突")

    def test_generate_task_materializes_feedback_file_from_database_if_missing(self):
        owner = self._create_user("materialize_owner", "materialize_owner@example.com")
        project_dir = self.workspace / "materialize-project"
        project_dir.mkdir()
        project = self._create_project_full(owner, name="Materialize Novel", file_path=str(project_dir))

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-materialize-1",
                status="pending",
                progress=0.0,
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            create_generation_workflow_run(
                db=db,
                project=project,
                generation_task=task,
                triggered_by_user_id=owner.id,
            )
            db.add(
                FeedbackItem(
                    project_id=project.id,
                    workflow_run_id=task.workflow_run.id,
                    created_by_user_id=owner.id,
                    feedback_scope="chapter",
                    feedback_type="user_rejection",
                    action_type="rewrite",
                    chapter_index=2,
                    status="open",
                    content="请重写第二章，并增强主角与反派的冲突。",
                )
            )
            db.commit()
        finally:
            db.close()

        feedback_file = project_dir / "feedback_2.txt"
        self.assertFalse(feedback_file.exists())

        class FakeOrchestrator:
            def __init__(self, project_dir, progress_callback, user_api_key, cancellation_checker=None, writer_perspective=None, perspective_strength=0.7, use_perspective_critic=True):
                self.project_dir = Path(project_dir)

            def run_full_novel(self):
                assert (self.project_dir / "feedback_2.txt").exists(), "structured feedback should be materialized before orchestration"
                raise writing_tasks.WaitingForConfirmationError(2, "待确认")

        original_session_local = writing_tasks.SessionLocal
        original_orchestrator = writing_tasks.NovelOrchestrator
        try:
            writing_tasks.SessionLocal = self.SessionLocal
            writing_tasks.NovelOrchestrator = FakeOrchestrator
            writing_tasks.generate_novel_task.push_request(id="celery-materialize-1", retries=0)
            result = writing_tasks.generate_novel_task.run(project_dir=str(project_dir), user_id=str(owner.id))
        finally:
            writing_tasks.generate_novel_task.pop_request()
            writing_tasks.SessionLocal = original_session_local
            writing_tasks.NovelOrchestrator = original_orchestrator

        self.assertTrue(result["waiting_confirmation"])
        self.assertTrue(feedback_file.exists())
        self.assertEqual(
            feedback_file.read_text(encoding="utf-8"),
            "请重写第二章，并增强主角与反派的冲突。",
        )

    def test_generate_task_overwrites_stale_feedback_bridge_and_marks_latest_feedback_applied(self):
        owner = self._create_user("applied_owner", "applied_owner@example.com")
        project_dir = self.workspace / "applied-project"
        project_dir.mkdir()
        project = self._create_project_full(owner, name="Applied Novel", file_path=str(project_dir))
        feedback_file = project_dir / "feedback_2.txt"
        feedback_file.write_text("这是陈旧的反馈文件内容。", encoding="utf-8")

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-applied-1",
                status="pending",
                progress=0.0,
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            run = create_generation_workflow_run(
                db=db,
                project=project,
                generation_task=task,
                triggered_by_user_id=owner.id,
            )
            feedback = create_feedback_item(
                db=db,
                project_id=project.id,
                workflow_run_id=run.id,
                created_by_user_id=owner.id,
                content="请重写第二章，并加强结尾悬念。",
                chapter_index=2,
                feedback_scope="chapter",
                feedback_type="user_rejection",
                action_type="rewrite",
            )
            feedback_id = feedback.id
            db.commit()
        finally:
            db.close()

        class FakeOrchestrator:
            def __init__(self, project_dir, progress_callback, user_api_key, cancellation_checker=None, writer_perspective=None, perspective_strength=0.7, use_perspective_critic=True):
                self.project_dir = Path(project_dir)

            def run_full_novel(self):
                feedback_file = self.project_dir / "feedback_2.txt"
                assert feedback_file.exists(), "structured feedback bridge file should exist before orchestration"
                assert feedback_file.read_text(encoding="utf-8") == "请重写第二章，并加强结尾悬念。", "latest structured feedback should overwrite stale bridge file content"
                feedback_file.unlink()
                raise writing_tasks.WaitingForConfirmationError(2, "待确认")

        original_session_local = writing_tasks.SessionLocal
        original_orchestrator = writing_tasks.NovelOrchestrator
        try:
            writing_tasks.SessionLocal = self.SessionLocal
            writing_tasks.NovelOrchestrator = FakeOrchestrator
            writing_tasks.generate_novel_task.push_request(id="celery-applied-1", retries=0)
            result = writing_tasks.generate_novel_task.run(project_dir=str(project_dir), user_id=str(owner.id))
        finally:
            writing_tasks.generate_novel_task.pop_request()
            writing_tasks.SessionLocal = original_session_local
            writing_tasks.NovelOrchestrator = original_orchestrator

        self.assertTrue(result["waiting_confirmation"])

        db = self.SessionLocal()
        try:
            db_feedback = db.query(FeedbackItem).filter(FeedbackItem.id == feedback_id).one()
            db_task = db.query(GenerationTask).filter(GenerationTask.celery_task_id == "celery-applied-1").one()
            db_run = db.query(WorkflowRun).filter(WorkflowRun.generation_task_id == db_task.id).one()

            self.assertEqual(db_feedback.status, "applied")
            self.assertIsNotNone(db_feedback.resolved_at)
            self.assertEqual(db_run.status, "waiting_confirm")
            self.assertEqual(db_run.run_metadata["applied_feedback_item_ids"], [feedback_id])
        finally:
            db.close()


class RateLimiterIntegrationTests(BaseWorkflowTestCase):
    def test_rate_limiter_module_exists_and_has_expected_interface(self):
        from backend.rate_limiter import RateLimiter, rate_limiter, limit_requests, get_ip_from_request

        self.assertIsInstance(rate_limiter, RateLimiter)
        self.assertTrue(hasattr(rate_limiter, 'check'))
        self.assertTrue(callable(limit_requests(10)))

    def test_rate_limiter_basic_functionality(self):
        from backend.rate_limiter import RateLimiter

        limiter = RateLimiter()
        self.assertTrue(limiter.check("test-ip", 3, 60))
        self.assertTrue(limiter.check("test-ip", 3, 60))
        self.assertTrue(limiter.check("test-ip", 3, 60))
        self.assertFalse(limiter.check("test-ip", 3, 60))

    def test_rate_limiter_respects_different_keys(self):
        from backend.rate_limiter import RateLimiter

        limiter = RateLimiter()
        self.assertTrue(limiter.check("ip-1", 1, 60))
        self.assertFalse(limiter.check("ip-1", 1, 60))
        self.assertTrue(limiter.check("ip-2", 1, 60))

    def test_rate_limiter_is_instantiated_in_module(self):
        import backend.rate_limiter as rl_module
        self.assertIsNotNone(rl_module.rate_limiter)

    def test_rate_limiter_is_attached_to_fastapi_app(self):
        from backend.main import app
        self.assertTrue(hasattr(app, 'rate_limiter'))
        self.assertIsNotNone(app.rate_limiter)
        from backend.rate_limiter import RateLimiter
        self.assertIsInstance(app.rate_limiter, RateLimiter)


if __name__ == "__main__":
    unittest.main()
