import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import backend.api.projects as projects_api
import backend.api.tasks as tasks_api
import tasks.writing_tasks as writing_tasks
from utils.runtime_context import get_current_output_dir_optional, get_current_run_context_optional, set_current_output_dir
from backend.database import Base, get_db
from backend.deps import get_current_user
from backend.main import app
from backend.models import Artifact, Chapter, FeedbackItem, GenerationTask, Project, User, WorkflowRun, WorkflowStepRun
from backend.chapter_sync import parse_chapter_file_content, sync_chapter_file_to_db
from backend.task_status import ACTIVE_TASK_STATUSES
from backend.workflow_service import create_feedback_item, create_generation_workflow_run, update_workflow_run_status


class WorkflowFoundationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp_dir.name)
        self.db_path = self.workspace / "test.db"
        self.engine = create_engine(
            f"sqlite:///{self.db_path}",
            connect_args={"check_same_thread": False},
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

        app.dependency_overrides.clear()
        app.dependency_overrides[get_db] = self._override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        set_current_output_dir(None)
        self.engine.dispose()
        self.temp_dir.cleanup()

    def _override_get_db(self):
        db = self.SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def _set_current_user(self, user):
        async def override_current_user():
            return user

        app.dependency_overrides[get_current_user] = override_current_user

    def _create_user(self, username: str, email: str) -> User:
        db = self.SessionLocal()
        try:
            user = User(
                username=username,
                email=email,
                hashed_password="hashed",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            db.expunge(user)
            return user
        finally:
            db.close()

    def _create_project(self, owner: User, name: str = "Project", file_path: str | None = None) -> Project:
        db = self.SessionLocal()
        try:
            project = Project(
                user_id=owner.id,
                name=name,
                description="demo",
                content_type="full_novel",
                status="draft",
                file_path=file_path,
                config={
                    "novel_name": name,
                    "core_requirement": "一个少年踏上修仙路",
                    "chapter_word_count": 2000,
                    "start_chapter": 1,
                    "end_chapter": 3,
                },
            )
            db.add(project)
            db.commit()
            db.refresh(project)
            db.expunge(project)
            return project
        finally:
            db.close()

    def test_trigger_generation_creates_workflow_run_and_project_snapshot_artifact(self):
        owner = self._create_user("workflow_owner", "workflow_owner@example.com")
        project_dir = self.workspace / "workflow-project"
        project_dir.mkdir()
        project = self._create_project(owner, name="Workflow Novel", file_path=str(project_dir))
        self._set_current_user(owner)

        original_delay = projects_api.generate_novel_task.delay
        try:
            projects_api.generate_novel_task.delay = lambda project_dir, user_id: SimpleNamespace(id="celery-workflow-1")
            response = self.client.post(f"/api/projects/{project.id}/generate")
        finally:
            projects_api.generate_novel_task.delay = original_delay

        self.assertEqual(response.status_code, 200)

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

    def test_rejected_chapter_confirmation_persists_structured_feedback_item(self):
        owner = self._create_user("feedback_owner", "feedback_owner@example.com")
        project_dir = self.workspace / "feedback-project"
        project_dir.mkdir()
        project = self._create_project(owner, name="Feedback Novel", file_path=str(project_dir))
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

        original_delay = tasks_api.generate_novel_task.delay
        try:
            tasks_api.generate_novel_task.delay = lambda project_dir, user_id: SimpleNamespace(id="celery-feedback-2")
            response = self.client.post(
                "/api/tasks/celery-feedback-1/confirm",
                json={"approved": False, "feedback": "这一章主角存在感太弱，重写并增强冲突。"},
            )
        finally:
            tasks_api.generate_novel_task.delay = original_delay

        self.assertEqual(response.status_code, 200)

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

    def test_create_feedback_item_supersedes_previous_open_feedback_for_same_target(self):
        owner = self._create_user("supersede_owner", "supersede_owner@example.com")
        project = self._create_project(owner, name="Supersede Novel")

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
        project = self._create_project(owner, name="Sync Novel", file_path=str(project_dir))
        chapter_file = project_dir / "chapters" / "chapter_1.txt"
        chapter_file.parent.mkdir(parents=True, exist_ok=True)
        chapter_file.write_text("第1章 初见\n\n山雨欲来。\n\n主角登场。", encoding="utf-8")

        title, html_content, word_count = parse_chapter_file_content(chapter_file.read_text(encoding="utf-8"))
        self.assertEqual(title, "第1章 初见")
        self.assertEqual(html_content, "<p>山雨欲来。\n主角登场。</p>")
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
            self.assertEqual(db_chapter.content, "<p>山雨欲来。\n主角登场。</p>")
            self.assertEqual(db_chapter.word_count, 8)
            self.assertEqual(db_chapter.status, "generated")
        finally:
            db.close()

    def test_update_workflow_run_status_tracks_lifecycle_and_completion(self):
        owner = self._create_user("status_owner", "status_owner@example.com")
        project = self._create_project(owner, name="Status Novel")

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
        project = self._create_project(owner, name="Waiting Novel", file_path=str(project_dir))

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
            def __init__(self, project_dir, progress_callback, user_api_key):
                self.progress_callback = progress_callback

            def run_full_novel(self):
                self.progress_callback(35, "正在生成第 2 章...")
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
        project = self._create_project(owner, name="Success Novel", file_path=str(project_dir))

        db = self.SessionLocal()
        try:
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
            def __init__(self, project_dir, progress_callback, user_api_key):
                self.project_dir = Path(project_dir)
                self.progress_callback = progress_callback

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
        finally:
            db.close()

    def test_trigger_generation_blocks_when_waiting_confirm_task_exists(self):
        owner = self._create_user("active_generation_owner", "active_generation_owner@example.com")
        project_dir = self.workspace / "active-generation-project"
        project_dir.mkdir()
        project = self._create_project(owner, name="Active Generation Novel", file_path=str(project_dir))
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
        project = self._create_project(owner, name="Active Export Novel", file_path=str(project_dir))
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

    def test_regenerate_chapter_blocks_when_waiting_confirm_task_exists(self):
        owner = self._create_user("active_regen_owner", "active_regen_owner@example.com")
        project_dir = self.workspace / "active-regen-project"
        project_dir.mkdir()
        project = self._create_project(owner, name="Active Regen Novel", file_path=str(project_dir))
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

    def test_task_status_endpoint_includes_workflow_run_steps_and_feedback(self):
        owner = self._create_user("status_api_owner", "status_api_owner@example.com")
        project = self._create_project(owner, name="Status API Novel")
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
        self.assertEqual(payload["workflow_run"]["feedback_items"][0]["content"], "请增强这一章的冲突感。")

    def test_project_detail_includes_current_generation_task_workflow_summary(self):
        owner = self._create_user("project_api_owner", "project_api_owner@example.com")
        project = self._create_project(owner, name="Project API Novel")
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

    def test_generate_task_materializes_feedback_file_from_database_if_missing(self):
        owner = self._create_user("materialize_owner", "materialize_owner@example.com")
        project_dir = self.workspace / "materialize-project"
        project_dir.mkdir()
        project = self._create_project(owner, name="Materialize Novel", file_path=str(project_dir))

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
            def __init__(self, project_dir, progress_callback, user_api_key):
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
        project = self._create_project(owner, name="Applied Novel", file_path=str(project_dir))
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
            def __init__(self, project_dir, progress_callback, user_api_key):
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


if __name__ == "__main__":
    unittest.main()
