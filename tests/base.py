from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.deps import get_current_user
from backend.main import app
from backend.models import Project, User
from backend.rate_limiter import rate_limiter
from backend.utils.runtime_context import set_current_output_dir


class BaseWorkflowTestCase(unittest.TestCase):
    """Base test case with common fixtures for workflow and review tests."""

    def setUp(self):
        rate_limiter.reset()
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
        rate_limiter.reset()
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

    def _create_project(
        self,
        owner: User,
        name: str = "Project",
        file_path: str | None = None,
        config: dict | None = None,
    ) -> Project:
        """Create a test project.

        Args:
            owner: Project owner user
            name: Project name
            file_path: Optional file path
            config: Optional config dict, defaults to minimal config
        """
        db = self.SessionLocal()
        try:
            project_config = config or {"novel_name": name}
            project = Project(
                user_id=owner.id,
                name=name,
                description="demo",
                content_type="full_novel",
                status="draft",
                file_path=file_path,
                config=project_config,
            )
            db.add(project)
            db.commit()
            db.refresh(project)
            db.expunge(project)
            return project
        finally:
            db.close()

    def _create_project_full(self, owner: User, name: str = "Project", file_path: str | None = None) -> Project:
        """Create a test project with full workflow config."""
        return self._create_project(
            owner=owner,
            name=name,
            file_path=file_path,
            config={
                "novel_name": name,
                "core_requirement": "一个少年踏上修仙路",
                "chapter_word_count": 2000,
                "start_chapter": 1,
                "end_chapter": 3,
            },
        )
