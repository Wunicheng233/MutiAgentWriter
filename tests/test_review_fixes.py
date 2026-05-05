from __future__ import annotations

import asyncio
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

import backend.api.projects as projects_api
import backend.database as database_module
import backend.deps as deps
import backend.agents.writer_agent as writer_agent
import backend.config as config
import backend.core.orchestrator as orchestrator_module
import backend.utils.file_utils as file_utils
import backend.utils.volc_engine as volc_engine
import backend.utils.vector_db as vector_db
from backend.api.auth import clear_api_key, refresh_api_key, register
from backend.auth import get_password_hash, get_user_api_key, set_user_api_key
from backend.api.chapters import restore_version, update_chapter
from backend.chapter_sync import html_content_to_plain_text
from backend.models import Chapter, ChapterVersion, GenerationTask, Project, ProjectCollaborator, ShareLink, User
from backend.utils.runtime_context import set_current_output_dir
from backend.schemas import ChapterUpdate, UserCreate
from backend.core.orchestrator import NovelOrchestrator
from tests.base import BaseWorkflowTestCase


class ReviewFixRegressionTests(BaseWorkflowTestCase):
    def test_shared_project_endpoint_loads_related_project(self):
        owner = self._create_user("owner", "owner@example.com")
        project = self._create_project(owner, name="Shared Novel")

        db = self.SessionLocal()
        try:
            db.add(Chapter(project_id=project.id, chapter_index=1, title="第一章", content="<p>内容</p>", word_count=2))
            db.add(ShareLink(project_id=project.id, share_token="public-token"))
            db.commit()
        finally:
            db.close()

        response = self.client.get("/api/share/public-token")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["title"], "Shared Novel")
        self.assertEqual(payload["author"], "owner")
        self.assertEqual(len(payload["chapters"]), 1)

    def test_collaborator_list_can_access_related_user(self):
        owner = self._create_user("owner2", "owner2@example.com")
        teammate = self._create_user("teammate", "teammate@example.com")
        project = self._create_project(owner, name="Team Novel")

        db = self.SessionLocal()
        try:
            db.add(
                ProjectCollaborator(
                    project_id=project.id,
                    user_id=teammate.id,
                    role="viewer",
                )
            )
            db.commit()
        finally:
            db.close()

        self._set_current_user(owner)
        response = self.client.get(f"/api/projects/{project.id}/collaborators")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["username"], "teammate")

    def test_register_does_not_seed_random_model_api_key(self):
        db = self.SessionLocal()
        try:
            user = register(
                UserCreate(username="newbie", email="newbie@example.com", password="secret123"),
                db=db,
            )
            self.assertIsNone(user.api_key)
        finally:
            db.close()

    def test_refresh_api_key_compat_endpoint_clears_custom_model_api_key(self):
        owner = self._create_user("api_owner", "api_owner@example.com")

        db = self.SessionLocal()
        try:
            user = db.query(User).filter(User.id == owner.id).one()
            set_user_api_key(user, "custom-model-key")
            db.commit()

            refreshed_user = refresh_api_key(current_user=user, db=db)
            self.assertIsNone(refreshed_user.api_key)
            self.assertIsNone(db.query(User).filter(User.id == owner.id).one().encrypted_api_key)

            set_user_api_key(user, "another-custom-key")
            db.commit()
            cleared_user = clear_api_key(current_user=user, db=db)
            self.assertIsNone(cleared_user.api_key)
            self.assertIsNone(db.query(User).filter(User.id == owner.id).one().encrypted_api_key)
        finally:
            db.close()

    def test_update_api_key_endpoint_stores_encrypted_value_and_masks_response(self):
        owner = self._create_user("encrypted_owner", "encrypted_owner@example.com")
        self._set_current_user(owner)

        response = self.client.put(
            "/api/auth/api-key",
            json={"api_key": "abcd1234efgh5678"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["api_key"], "abcd...5678")

        db = self.SessionLocal()
        try:
            user = db.query(User).filter(User.id == owner.id).one()
            self.assertIsNone(user.api_key)
            self.assertIsNotNone(user.encrypted_api_key)
            self.assertNotEqual(user.encrypted_api_key, "abcd1234efgh5678")
            self.assertEqual(get_user_api_key(user), "abcd1234efgh5678")
        finally:
            db.close()

    def test_user_response_masks_api_key_in_auth_payloads(self):
        owner = self._create_user("masked_owner", "masked_owner@example.com")
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            user = db.query(User).filter(User.id == owner.id).one()
            set_user_api_key(user, "abcd1234efgh5678")
            user.hashed_password = get_password_hash("secret123")
            db.commit()
            db.refresh(user)
            db.expunge(user)
            refreshed_user = user
        finally:
            db.close()

        self._set_current_user(refreshed_user)
        me_response = self.client.get("/api/auth/me")
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.json()["api_key"], "abcd...5678")

        login_response = self.client.post(
            "/api/auth/login",
            json={"username": "masked_owner", "password": "secret123"},
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.json()["user"]["api_key"], "abcd...5678")

    def test_auth_dependency_does_not_log_raw_token_or_payload(self):
        owner = self._create_user("auth_log_owner", "auth_log_owner@example.com")
        raw_token = "super-secret-token"

        class FakeRequest:
            headers = {"Authorization": f"Bearer {raw_token}"}

        db = self.SessionLocal()
        original_decode_token = deps.decode_token
        try:
            deps.decode_token = lambda token: {"sub": str(owner.id), "role": "sensitive-payload"}
            with self.assertLogs("backend.deps", level="DEBUG") as logs:
                user = asyncio.run(deps.get_current_user(FakeRequest(), db=db))

            self.assertEqual(user.id, owner.id)
            log_text = "\n".join(logs.output)
            self.assertNotIn(raw_token, log_text)
            self.assertNotIn("Bearer", log_text)
            self.assertNotIn("sensitive-payload", log_text)
        finally:
            deps.decode_token = original_decode_token
            db.close()

    def test_html_content_to_plain_text_removes_editor_markup(self):
        content = "<p>第一段</p><p>第二段<br/>换行</p>"
        plain_text = html_content_to_plain_text(content)

        self.assertIn("第一段", plain_text)
        self.assertIn("第二段", plain_text)
        self.assertIn("换行", plain_text)
        self.assertNotIn("<p>", plain_text)

    def test_volc_retry_preserves_client_and_context(self):
        captured_contexts = []

        class FakeMessage:
            content = "成功"

        class FakeChoice:
            message = FakeMessage()

        class FakeUsage:
            prompt_tokens = 0
            completion_tokens = 0
            total_tokens = 0

        class FakeResponse:
            choices = [FakeChoice()]
            usage = FakeUsage()

        class FakeCompletions:
            def __init__(self):
                self.calls = 0

            def create(self, **kwargs):
                self.calls += 1
                if self.calls == 1:
                    raise RuntimeError("temporary")
                return FakeResponse()

        class FakeClient:
            def __init__(self):
                self.chat = SimpleNamespace(completions=FakeCompletions())

        fake_client = FakeClient()
        original_load_prompt = volc_engine.load_prompt
        original_sleep = volc_engine.time.sleep
        try:
            volc_engine.load_prompt = lambda agent_role, content_type=None, context=None, perspective=None, perspective_strength=None, **kwargs: captured_contexts.append(context) or "system"
            volc_engine.time.sleep = lambda seconds: None
            result = volc_engine.call_volc_api(
                agent_role="writer",
                user_input="input",
                client=fake_client,
                context={"world_bible": "设定"},
                max_retries=2,
            )
        finally:
            volc_engine.load_prompt = original_load_prompt
            volc_engine.time.sleep = original_sleep

        self.assertEqual(result, "成功")
        self.assertEqual(captured_contexts, [{"world_bible": "设定"}, {"world_bible": "设定"}])

    def test_volc_token_usage_failure_rolls_back_and_closes_session(self):
        class FakeMessage:
            content = "成功"

        class FakeChoice:
            message = FakeMessage()

        class FakeUsage:
            prompt_tokens = 10
            completion_tokens = 5
            total_tokens = 15

        class FakeResponse:
            choices = [FakeChoice()]
            usage = FakeUsage()

        class FakeCompletions:
            def create(self, **kwargs):
                return FakeResponse()

        class FakeClient:
            def __init__(self):
                self.chat = SimpleNamespace(completions=FakeCompletions())

        class FakeSession:
            def __init__(self):
                self.added = False
                self.rolled_back = False
                self.closed = False

            def add(self, usage):
                self.added = True

            def commit(self):
                raise RuntimeError("db write failed")

            def rollback(self):
                self.rolled_back = True

            def close(self):
                self.closed = True

        fake_session = FakeSession()
        original_load_prompt = file_utils.load_prompt
        original_session_local = database_module.SessionLocal
        try:
            file_utils.load_prompt = lambda *args, **kwargs: "system"
            database_module.SessionLocal = lambda: fake_session
            result = volc_engine.call_volc_api(
                agent_role="writer",
                user_input="input",
                client=FakeClient(),
                user_id=1,
                project_id=1,
            )
        finally:
            file_utils.load_prompt = original_load_prompt
            database_module.SessionLocal = original_session_local

        self.assertEqual(result, "成功")
        self.assertTrue(fake_session.added)
        self.assertTrue(fake_session.rolled_back)
        self.assertTrue(fake_session.closed)

    def test_volc_skips_token_recording_when_provider_omits_usage(self):
        class FakeMessage:
            content = "成功"

        class FakeChoice:
            message = FakeMessage()

        class FakeResponse:
            choices = [FakeChoice()]
            usage = None

        class FakeCompletions:
            def create(self, **kwargs):
                return FakeResponse()

        class FakeClient:
            def __init__(self):
                self.chat = SimpleNamespace(completions=FakeCompletions())

        original_load_prompt = volc_engine.load_prompt
        original_warning = volc_engine.logger.warning
        warnings = []
        try:
            volc_engine.load_prompt = lambda *args, **kwargs: "system"
            volc_engine.logger.warning = lambda message, *args, **kwargs: warnings.append(str(message))
            result = volc_engine.call_volc_api(
                agent_role="writer",
                user_input="input",
                client=FakeClient(),
                user_id=1,
                project_id=1,
            )
        finally:
            volc_engine.load_prompt = original_load_prompt
            volc_engine.logger.warning = original_warning

        self.assertEqual(result, "成功")
        self.assertFalse(any("Failed to record token usage" in warning for warning in warnings))

    def test_vector_db_writes_use_upsert_for_chapter_and_setting(self):
        class FakeCollection:
            def __init__(self):
                self.calls = []

            def add(self, **kwargs):
                raise AssertionError("should use upsert instead of add")

            def upsert(self, **kwargs):
                self.calls.append(kwargs)

        chapter_collection = FakeCollection()
        setting_collection = FakeCollection()
        project_dir = self.workspace / "vector-project"
        project_dir.mkdir()
        (project_dir / "setting_bible.md").write_text("核心设定", encoding="utf-8")

        original_chapter_collection = vector_db.get_chapter_collection
        original_setting_collection = vector_db.get_setting_collection
        try:
            set_current_output_dir(project_dir)
            vector_db.get_chapter_collection = lambda: chapter_collection
            vector_db.get_setting_collection = lambda: setting_collection

            vector_db.add_chapter_to_db(1, "第一章", "这是正文内容")
            vector_db.load_setting_bible_to_db()
        finally:
            vector_db.get_chapter_collection = original_chapter_collection
            vector_db.get_setting_collection = original_setting_collection
            set_current_output_dir(None)

        self.assertEqual(len(chapter_collection.calls), 1)
        self.assertEqual(chapter_collection.calls[0]["ids"], ["chapter_1_chunk_0"])
        self.assertEqual(len(setting_collection.calls), 1)
        self.assertEqual(setting_collection.calls[0]["ids"], ["core_setting_bible"])

    def test_reset_current_db_ignores_missing_collections_and_continues(self):
        class NotFoundError(Exception):
            pass

        class FakeClient:
            def __init__(self):
                self.deleted_names = []

            def delete_collection(self, name):
                self.deleted_names.append(name)
                raise NotFoundError(f"Collection [{name}] does not exist")

        fake_client = FakeClient()
        project_dir = self.workspace / "missing-vector-collections"
        project_dir.mkdir()

        original_get_client = vector_db._get_client
        try:
            set_current_output_dir(project_dir)
            vector_db._get_client = lambda: fake_client

            vector_db.reset_current_db()
        finally:
            vector_db._get_client = original_get_client
            set_current_output_dir(None)

        self.assertEqual(len(fake_client.deleted_names), 2)
        self.assertTrue(fake_client.deleted_names[0].startswith("chapters_"))
        self.assertTrue(fake_client.deleted_names[1].startswith("settings_"))

    def test_init_reference_collection_uses_project_root_reference_dir(self):
        class FakeReferenceCollection:
            def __init__(self):
                self.items = []

            def count(self):
                return 0

            def add(self, **kwargs):
                raise AssertionError("should use upsert instead of add")

            def upsert(self, **kwargs):
                self.items.append(kwargs)

        fake_collection = FakeReferenceCollection()
        references_dir = self.workspace / "references"
        references_dir.mkdir()
        (references_dir / "sample.txt").write_text("参考文风内容", encoding="utf-8")

        original_root_dir = vector_db.settings.root_dir
        original_reference_collection = vector_db.get_reference_collection
        try:
            vector_db.settings.root_dir = self.workspace
            vector_db.get_reference_collection = lambda: fake_collection
            vector_db.init_reference_collection()
        finally:
            vector_db.settings.root_dir = original_root_dir
            vector_db.get_reference_collection = original_reference_collection

        self.assertEqual(len(fake_collection.items), 1)
        self.assertEqual(fake_collection.items[0]["ids"], ["sample.txt"])

    def test_writer_title_retry_preserves_prompt_context(self):
        captured_contexts = []

        def fake_call_volc_api(*args, **kwargs):
            captured_contexts.append(kwargs.get("context"))
            if len(captured_contexts) == 1:
                return "没有标题的正文"
            return "第1章 标题\n\n正文"

        original_call = writer_agent.call_volc_api
        original_search_ref = writer_agent.search_reference_style
        try:
            writer_agent.call_volc_api = fake_call_volc_api
            writer_agent.search_reference_style = lambda *args, **kwargs: ""
            result = writer_agent.generate_chapter(
                setting_bible="设定",
                plan="第1章 大纲",
                chapter_num=1,
                content_type="novel",
            )
        finally:
            writer_agent.call_volc_api = original_call
            writer_agent.search_reference_style = original_search_ref

        self.assertTrue(result.startswith("第1章"))
        self.assertEqual(captured_contexts[0], captured_contexts[1])
        self.assertEqual(captured_contexts[0]["world_bible"], "设定")

    def test_update_chapter_writes_back_to_chapters_subdirectory(self):
        owner = self._create_user("owner3", "owner3@example.com")
        project_dir = self.workspace / "project-update"
        project_dir.mkdir()
        project = self._create_project(owner, file_path=str(project_dir))

        db = self.SessionLocal()
        try:
            db.add(
                Chapter(
                    project_id=project.id,
                    chapter_index=1,
                    title="第一章",
                    content="<p>旧内容</p>",
                    word_count=3,
                    status="generated",
                )
            )
            db.commit()
        finally:
            db.close()

        db = self.SessionLocal()
        try:
            chapter = update_chapter(
                project.id,
                1,
                ChapterUpdate(content="<p>新内容</p>"),
                current_user=owner,
                db=db,
            )
            chapter_path = project_dir / "chapters" / "chapter_1.txt"
            self.assertTrue(chapter_path.exists())
            self.assertEqual(chapter.content, "<p>新内容</p>")
            self.assertEqual(chapter_path.read_text(encoding="utf-8"), "第一章\n\n新内容")
        finally:
            db.close()

    def test_restore_version_writes_back_to_chapters_subdirectory(self):
        owner = self._create_user("owner4", "owner4@example.com")
        project_dir = self.workspace / "project-restore"
        project_dir.mkdir()
        project = self._create_project(owner, file_path=str(project_dir))

        db = self.SessionLocal()
        try:
            chapter = Chapter(
                project_id=project.id,
                chapter_index=1,
                title="第一章",
                content="<p>当前内容</p>",
                word_count=4,
                status="generated",
            )
            db.add(chapter)
            db.commit()
            db.refresh(chapter)

            version = ChapterVersion(
                chapter_id=chapter.id,
                version_number=1,
                content="<p>历史内容</p>",
                word_count=4,
            )
            db.add(version)
            db.commit()
            version_id = version.id
        finally:
            db.close()

        db = self.SessionLocal()
        try:
            chapter = restore_version(
                project.id,
                1,
                version_id,
                current_user=owner,
                db=db,
            )
            chapter_path = project_dir / "chapters" / "chapter_1.txt"
            self.assertTrue(chapter_path.exists())
            self.assertEqual(chapter.content, "<p>历史内容</p>")
            self.assertEqual(chapter_path.read_text(encoding="utf-8"), "第一章\n\n历史内容")
        finally:
            db.close()

    def test_resume_with_feedback_rewrites_existing_chapter_instead_of_skipping(self):
        project_dir = self.workspace / "orchestrator-project"
        chapters_dir = project_dir / "chapters"
        chapters_dir.mkdir(parents=True)
        chapter_path = chapters_dir / "chapter_1.txt"
        chapter_path.write_text("旧章节内容", encoding="utf-8")
        feedback_path = project_dir / "feedback_1.txt"
        feedback_path.write_text("请重写", encoding="utf-8")

        orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        orchestrator.output_dir = project_dir
        orchestrator.info_path = project_dir / "info.json"
        orchestrator.start_chapter = 1
        orchestrator.end_chapter = 1
        orchestrator.chapter_word_count = "2000"
        orchestrator.chapter_outlines = [{"chapter_num": 1, "title": "第一章", "outline": "剧情", "target_word_count": 2000}]
        orchestrator.novel_name = "Test Novel"
        orchestrator.plan = "plan"
        orchestrator.setting_bible = "bible"
        orchestrator.req = {"content_type": "novel"}
        orchestrator.content_type = "novel"
        orchestrator.dimension_scores = {"plot": [], "character": [], "hook": [], "writing": [], "setting": []}
        orchestrator.allow_plot_adjustment = False
        # 视角配置（默认值）
        orchestrator.writer_perspective = None
        orchestrator.perspective_strength = 0.7
        orchestrator.use_perspective_critic = True
        orchestrator.run_planner = lambda confirmation_handler=None: "bible"
        orchestrator._report_progress = lambda *args, **kwargs: None
        orchestrator.run_chapter_generation = lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("should use feedback rewrite path"))

        class FakeRevise:
            def revise_chapter(self, existing_content, issues, setting_bible, perspective: str = None, perspective_strength: float = 0.7):
                return "重写后的章节内容"

        class FakeCritic:
            def critic_chapter(self, current_content, setting_bible, outline, content_type, perspective: str = None, perspective_strength: float = 0.7):
                return True, 9, {"plot": 9, "character": 9, "hook": 9, "writing": 9, "setting": 9}, []

        orchestrator.revise = FakeRevise()
        orchestrator.critic = FakeCritic()

        original_guardrails = orchestrator_module.run_system_guardrails
        original_add_chapter_to_db = orchestrator_module.add_chapter_to_db
        synced_chapters = []
        try:
            orchestrator_module.add_chapter_to_db = lambda chapter_num, chapter_title, content: synced_chapters.append(
                (chapter_num, chapter_title, content)
            )
            orchestrator_module.run_system_guardrails = lambda content, context: SimpleNamespace(corrected_content=content)
            result = orchestrator.run_full_novel()
        finally:
            orchestrator_module.run_system_guardrails = original_guardrails
            orchestrator_module.add_chapter_to_db = original_add_chapter_to_db

        self.assertEqual(chapter_path.read_text(encoding="utf-8"), "重写后的章节内容")
        self.assertFalse(feedback_path.exists())
        self.assertEqual(synced_chapters, [(1, "第1章", "重写后的章节内容")])
        self.assertEqual(result["generated_chapters"], 1)
        info = json.loads((project_dir / "info.json").read_text(encoding="utf-8"))
        self.assertEqual(info["evaluation_harness_version"], "chapter-evaluation-v1")
        self.assertEqual(info["evaluation_reports"][0]["chapter_index"], 1)
        self.assertEqual(info["evaluation_reports"][0]["score"], 9.0)

    def test_resume_skip_existing_chapter_rehydrates_vector_index(self):
        project_dir = self.workspace / "orchestrator-skip-project"
        chapters_dir = project_dir / "chapters"
        chapters_dir.mkdir(parents=True)
        chapter_path = chapters_dir / "chapter_1.txt"
        chapter_path.write_text("已存在章节内容", encoding="utf-8")

        orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        orchestrator.output_dir = project_dir
        orchestrator.info_path = project_dir / "info.json"
        orchestrator.start_chapter = 1
        orchestrator.end_chapter = 1
        orchestrator.chapter_word_count = "2000"
        orchestrator.chapter_outlines = [{"chapter_num": 1, "title": "第一章", "outline": "剧情", "target_word_count": 2000}]
        orchestrator.novel_name = "Test Novel"
        orchestrator.plan = "plan"
        orchestrator.setting_bible = "bible"
        orchestrator.req = {"content_type": "novel"}
        orchestrator.content_type = "novel"
        orchestrator.dimension_scores = {"plot": [], "character": [], "hook": [], "writing": [], "setting": []}
        orchestrator.allow_plot_adjustment = False
        # 视角配置（默认值）
        orchestrator.writer_perspective = None
        orchestrator.perspective_strength = 0.7
        orchestrator.use_perspective_critic = True
        orchestrator.run_planner = lambda confirmation_handler=None: "bible"
        orchestrator._report_progress = lambda *args, **kwargs: None
        orchestrator.run_chapter_generation = lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("should skip existing chapter instead of regenerating")
        )

        original_add_chapter_to_db = orchestrator_module.add_chapter_to_db
        synced_chapters = []
        try:
            orchestrator_module.add_chapter_to_db = lambda chapter_num, chapter_title, content: synced_chapters.append(
                (chapter_num, chapter_title, content)
            )
            result = orchestrator.run_full_novel()
        finally:
            orchestrator_module.add_chapter_to_db = original_add_chapter_to_db

        self.assertEqual(synced_chapters, [(1, "第1章", "已存在章节内容")])
        self.assertEqual(result["generated_chapters"], 1)

    def test_chapter_confirmation_pauses_before_following_chapters(self):
        project_dir = self.workspace / "orchestrator-confirm-project"
        chapters_dir = project_dir / "chapters"
        chapters_dir.mkdir(parents=True)

        orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        orchestrator.output_dir = project_dir
        orchestrator.info_path = project_dir / "info.json"
        orchestrator.start_chapter = 1
        orchestrator.end_chapter = 4
        orchestrator.chapter_word_count = "2000"
        orchestrator.chapter_outlines = [
            {"chapter_num": index, "title": f"第{index}章", "outline": f"剧情{index}", "target_word_count": 2000}
            for index in range(1, 5)
        ]
        orchestrator.novel_name = "Test Novel"
        orchestrator.plan = "plan"
        orchestrator.setting_bible = "bible"
        orchestrator.req = {"content_type": "novel"}
        orchestrator.content_type = "novel"
        orchestrator.dimension_scores = {"plot": [], "character": [], "hook": [], "writing": [], "setting": []}
        orchestrator.allow_plot_adjustment = False
        orchestrator.writer_perspective = None
        orchestrator.perspective_strength = 0.7
        orchestrator.use_perspective_critic = True
        orchestrator.run_planner = lambda confirmation_handler=None: "bible"
        progress_events = []
        orchestrator._report_progress = lambda percent, message: progress_events.append((percent, message))
        orchestrator._check_cancellation = lambda: None

        generated_chapters = []

        def pause_after_draft(chapter_index, prev_chapter_end=""):
            generated_chapters.append(chapter_index)
            (chapters_dir / f"chapter_{chapter_index}.txt").write_text(
                f"第{chapter_index}章正文",
                encoding="utf-8",
            )
            raise orchestrator_module.WaitingForConfirmationError(chapter_index, f"第{chapter_index}章正文")

        orchestrator.run_chapter_generation = pause_after_draft

        with self.assertRaises(orchestrator_module.WaitingForConfirmationError) as context:
            orchestrator.run_full_novel()

        self.assertEqual(context.exception.chapter_index, 1)
        self.assertEqual(generated_chapters, [1])
        self.assertTrue((chapters_dir / "chapter_1.txt").exists())
        self.assertFalse((chapters_dir / "chapter_2.txt").exists())
        self.assertFalse(any(percent == -1 for percent, _ in progress_events))

    def test_chapter_confirmation_persists_quality_summary_before_pause(self):
        project_dir = self.workspace / "orchestrator-confirm-quality-project"
        (project_dir / "chapters").mkdir(parents=True)

        orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        orchestrator.output_dir = project_dir
        orchestrator.info_path = project_dir / "info.json"
        orchestrator.plan = "plan"
        orchestrator.setting_bible = "bible"
        orchestrator.novel_name = "Test Novel"
        orchestrator.req = {"content_type": "novel"}
        orchestrator.content_type = "novel"
        orchestrator.dimension_scores = {"plot": [], "character": [], "hook": [], "writing": [], "setting": []}
        orchestrator.chapter_scores = []
        orchestrator.evaluation_reports = []
        orchestrator.scene_anchor_plans = []
        orchestrator.repair_traces = []
        orchestrator.stitching_reports = []
        orchestrator.novel_state_snapshots = []
        orchestrator.skip_chapter_confirm = False
        orchestrator.writer_perspective = None
        orchestrator.perspective_strength = 0.7
        orchestrator.use_perspective_critic = True
        from backend.core.word_count_policy import WordCountPolicy
        orchestrator.word_count_policy = WordCountPolicy(min_ratio=0.001, max_ratio=10)
        orchestrator._check_cancellation = lambda: None
        orchestrator.get_chapter_outline = lambda chapter_index: "剧情"
        orchestrator.get_target_word_count = lambda chapter_index: 1000
        orchestrator.build_chapter_context = lambda *args, **kwargs: ("", [])
        orchestrator._run_critic_harness = lambda **kwargs: (
            True,
            8.4,
            {"plot": 8.0, "character": 8.2, "hook": 8.5, "writing": 8.7, "setting": 8.6},
            [],
        )

        class FakeWriter:
            def generate_chapter(self, *args, **kwargs):
                return "第一段。\n\n第二段。"

        orchestrator.writer = FakeWriter()

        original_search_chapter = orchestrator_module.search_related_chapter_content
        original_search_setting = orchestrator_module.search_core_setting
        original_guardrails = orchestrator_module.run_system_guardrails
        original_add_chapter_to_db = orchestrator_module.add_chapter_to_db
        original_enable_validator = orchestrator_module.settings.enable_novel_state_validator
        try:
            orchestrator_module.search_related_chapter_content = lambda *args, **kwargs: ""
            orchestrator_module.search_core_setting = lambda *args, **kwargs: ""
            orchestrator_module.run_system_guardrails = lambda content, context: SimpleNamespace(
                corrected_content=content,
                passed=True,
                warnings=[],
                suggestions=[],
                metrics={"word_count": 1000},
                violations={},
            )
            orchestrator_module.add_chapter_to_db = lambda *args, **kwargs: None
            orchestrator_module.settings.enable_novel_state_validator = False

            with self.assertRaises(orchestrator_module.WaitingForConfirmationError):
                orchestrator.run_chapter_generation(1)
        finally:
            orchestrator_module.search_related_chapter_content = original_search_chapter
            orchestrator_module.search_core_setting = original_search_setting
            orchestrator_module.run_system_guardrails = original_guardrails
            orchestrator_module.add_chapter_to_db = original_add_chapter_to_db
            orchestrator_module.settings.enable_novel_state_validator = original_enable_validator

        info = json.loads((project_dir / "info.json").read_text(encoding="utf-8"))
        self.assertEqual(info["overall_quality_score"], 8.4)
        self.assertEqual(info["chapter_scores"][0]["chapter"], 1)
        self.assertEqual(info["chapter_scores"][0]["score"], 8.4)
        self.assertEqual(info["dimension_average_scores"]["writing"], 8.7)

    def test_skip_chapter_confirmation_generates_full_requested_range(self):
        project_dir = self.workspace / "orchestrator-range-project"
        chapters_dir = project_dir / "chapters"
        chapters_dir.mkdir(parents=True)

        orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        orchestrator.output_dir = project_dir
        orchestrator.info_path = project_dir / "info.json"
        orchestrator.start_chapter = 1
        orchestrator.end_chapter = 4
        orchestrator.chapter_word_count = "2000"
        orchestrator.chapter_outlines = [
            {"chapter_num": index, "title": f"第{index}章", "outline": f"剧情{index}", "target_word_count": 2000}
            for index in range(1, 5)
        ]
        orchestrator.novel_name = "Test Novel"
        orchestrator.plan = "plan"
        orchestrator.setting_bible = "bible"
        orchestrator.req = {"content_type": "novel"}
        orchestrator.content_type = "novel"
        orchestrator.dimension_scores = {"plot": [], "character": [], "hook": [], "writing": [], "setting": []}
        orchestrator.allow_plot_adjustment = False
        orchestrator.writer_perspective = None
        orchestrator.perspective_strength = 0.7
        orchestrator.use_perspective_critic = True
        orchestrator.run_planner = lambda confirmation_handler=None: "bible"
        orchestrator._report_progress = lambda *args, **kwargs: None
        orchestrator._check_cancellation = lambda: None

        generated_chapters = []

        def generate_chapter(chapter_index, prev_chapter_end=""):
            generated_chapters.append(chapter_index)
            content = f"第{chapter_index}章正文"
            (chapters_dir / f"chapter_{chapter_index}.txt").write_text(content, encoding="utf-8")
            return content, 9, True, []

        orchestrator.run_chapter_generation = generate_chapter

        result = orchestrator.run_full_novel()

        self.assertEqual(generated_chapters, [1, 2, 3, 4])
        self.assertEqual(result["generated_chapters"], 4)
        self.assertTrue((chapters_dir / "chapter_4.txt").exists())

    def test_run_planner_normalizes_full_novel_content_type_for_agents(self):
        project_dir = self.workspace / "orchestrator-content-type-project"
        project_dir.mkdir(parents=True)
        (project_dir / "user_requirements.yaml").write_text(
            "\n".join([
                "novel_name: 类型规范测试",
                "core_requirement: 写一个悬疑故事",
                "target_platform: 网络小说",
                "chapter_word_count: 2000",
                "start_chapter: 1",
                "end_chapter: 1",
                "skip_plan_confirmation: true",
                "skip_chapter_confirmation: true",
                "content_type: full_novel",
            ]),
            encoding="utf-8",
        )

        orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        orchestrator.output_dir = project_dir
        orchestrator.project_dir = str(project_dir)
        orchestrator.writer_perspective = None
        orchestrator.perspective_strength = 0.7
        orchestrator.project_config = {}
        orchestrator._check_cancellation = lambda: None
        orchestrator._report_progress = lambda *args, **kwargs: None

        captured_content_types = []

        class FakePlanner:
            def generate_plan(self, *args, **kwargs):
                captured_content_types.append(args[3])
                return (
                    "# 《测试》设定与大纲\n\n"
                    "## 四、分章大纲\n\n"
                    "| 章节 | 本章目标（情节推进） | 核心冲突/爽点 | 结尾钩子 |\n"
                    "| :--- | :--- | :--- | :--- |\n"
                    "| 第1章 | 开始 | 冲突 | 钩子 |"
                )

        orchestrator.planner = FakePlanner()

        orchestrator.run_planner()

        self.assertEqual(captured_content_types, ["novel"])
        self.assertEqual(orchestrator.content_type, "novel")
        self.assertEqual(orchestrator.req["content_type"], "novel")

    def test_run_planner_reconfirms_revised_plan_after_plan_feedback(self):
        project_dir = self.workspace / "orchestrator-plan-feedback-project"
        project_dir.mkdir(parents=True)
        (project_dir / "user_requirements.yaml").write_text(
            "\n".join([
                "novel_name: 策划反馈测试",
                "core_requirement: 写一个悬疑故事",
                "target_platform: 网络小说",
                "chapter_word_count: 2000",
                "start_chapter: 1",
                "end_chapter: 4",
                "skip_plan_confirmation: false",
                "skip_chapter_confirmation: true",
                "content_type: novel",
            ]),
            encoding="utf-8",
        )
        (project_dir / "novel_plan.md").write_text("旧策划", encoding="utf-8")
        (project_dir / "setting_bible.md").write_text("旧设定", encoding="utf-8")
        (project_dir / "feedback_plan.txt").write_text("请增强核心悬念", encoding="utf-8")

        orchestrator = NovelOrchestrator.__new__(NovelOrchestrator)
        orchestrator.output_dir = project_dir
        orchestrator.project_dir = str(project_dir)
        orchestrator.writer_perspective = None
        orchestrator.perspective_strength = 0.7
        orchestrator.project_config = {}
        orchestrator._check_cancellation = lambda: None
        orchestrator._report_progress = lambda *args, **kwargs: None

        class FakePlanner:
            def revise_plan(self, plan, feedback, original_requirement, perspective=None, perspective_strength=0.7):
                self.call = (plan, feedback, original_requirement, perspective, perspective_strength)
                return "修订后的策划\n\n| 章节 | 本章目标（情节推进） | 核心冲突/爽点 | 结尾钩子 |\n| :--- | :--- | :--- | :--- |\n| 第1章 | 开始 | 冲突 | 钩子 |"

        fake_planner = FakePlanner()
        orchestrator.planner = fake_planner

        original_stdin = sys.stdin
        original_reset_current_db = orchestrator_module.reset_current_db
        try:
            sys.stdin = SimpleNamespace(isatty=lambda: False)
            orchestrator_module.reset_current_db = lambda: None
            with self.assertRaises(orchestrator_module.WaitingForConfirmationError) as context:
                orchestrator.run_planner()
        finally:
            sys.stdin = original_stdin
            orchestrator_module.reset_current_db = original_reset_current_db

        self.assertEqual(context.exception.chapter_index, 0)
        self.assertFalse((project_dir / "feedback_plan.txt").exists())
        self.assertIn("修订后的策划", (project_dir / "novel_plan.md").read_text(encoding="utf-8"))
        self.assertEqual(fake_planner.call[0], "旧策划")
        self.assertEqual(fake_planner.call[1], "请增强核心悬念")

    def test_export_download_requires_authenticated_access(self):
        owner = self._create_user("owner5", "owner5@example.com")
        project = self._create_project(owner, name="Export Novel")
        export_file = self.workspace / "story.html"
        export_file.write_text("<html></html>", encoding="utf-8")

        db = self.SessionLocal()
        try:
            db.add(
                GenerationTask(
                    project_id=project.id,
                    celery_task_id="celery-export-1",
                    status="success",
                    progress=1.0,
                )
            )
            db.commit()
        finally:
            db.close()

        class FakeAsyncResult:
            def __init__(self, task_id):
                self.task_id = task_id
                self.result = {
                    "file_path": str(export_file),
                    "filename": "story.html",
                    "format": "html",
                }

            def ready(self):
                return True

            def failed(self):
                return False

        original_async_result = projects_api.AsyncResult if hasattr(projects_api, "AsyncResult") else None
        import celery.result

        celery_async_result = celery.result.AsyncResult
        try:
            celery.result.AsyncResult = FakeAsyncResult
            response = self.client.get(f"/api/projects/{project.id}/export/download?task_id=1")
        finally:
            celery.result.AsyncResult = celery_async_result
            if original_async_result is not None:
                projects_api.AsyncResult = original_async_result

        self.assertEqual(response.status_code, 401)

    def test_editor_navigation_uses_registered_route_pattern(self):
        editor_source = Path("/Users/nobody1/Desktop/project/writer/frontend/src/pages/Editor.tsx").read_text(encoding="utf-8")
        # Editor 现在使用 useParams 从路由获取 id 和 chapterIndex，不直接硬编码路径
        self.assertIn("useParams", editor_source)
        # 安全的空值处理：三元运算符而非非空断言
        self.assertIn("id ? parseInt(id)", editor_source)  # 确认安全的路由参数提取
        self.assertIn("Number.isNaN", editor_source)  # 确认有 NaN 检查

    def test_workflow_detail_routes_plan_confirmation_to_overview_confirm_modal(self):
        source = Path("/Users/nobody1/Desktop/project/writer/frontend/src/pages/WorkflowRunDetail.tsx").read_text(encoding="utf-8")

        self.assertIn("overview?confirm-plan=true", source)

    def test_collaborator_cannot_create_public_share_link(self):
        owner = self._create_user("share_owner", "share_owner@example.com")
        collaborator = self._create_user("share_collab", "share_collab@example.com")
        project = self._create_project(owner, name="Shared Control Novel")

        db = self.SessionLocal()
        try:
            db.add(ProjectCollaborator(project_id=project.id, user_id=collaborator.id, role="editor"))
            db.commit()
        finally:
            db.close()

        self._set_current_user(collaborator)
        response = self.client.post(f"/api/projects/{project.id}/share")
        self.assertEqual(response.status_code, 404)

        self._set_current_user(owner)
        response = self.client.post(f"/api/projects/{project.id}/share")
        self.assertEqual(response.status_code, 200)

    def test_reset_project_revokes_tasks_without_force_terminate(self):
        owner = self._create_user("reset_revoke_owner", "reset_revoke_owner@example.com")
        project = self._create_project(owner, name="Reset Revoke Novel")
        self._set_current_user(owner)

        db = self.SessionLocal()
        try:
            task = GenerationTask(
                project_id=project.id,
                celery_task_id="celery-reset-revoke-1",
                status="progress",
                progress=0.5,
            )
            db.add(task)
            db.commit()
        finally:
            db.close()

        captured_calls = []
        original_celery_available = projects_api.CELERY_AVAILABLE
        original_revoke = projects_api.celery_app.control.revoke
        try:
            projects_api.CELERY_AVAILABLE = True
            projects_api.celery_app.control.revoke = lambda task_id, **kwargs: captured_calls.append((task_id, kwargs))
            response = self.client.post(f"/api/projects/{project.id}/reset")
        finally:
            projects_api.CELERY_AVAILABLE = original_celery_available
            projects_api.celery_app.control.revoke = original_revoke

        self.assertEqual(response.status_code, 200)
        self.assertEqual(captured_calls, [("celery-reset-revoke-1", {})])


if __name__ == "__main__":
    unittest.main()
