"""测试：并发创建任务时的竞态条件防护

使用数据库部分唯一索引防止同一项目有多个活跃任务。

注意：部分唯一索引是 PostgreSQL 特有功能，SQLite 不支持。
在 SQLite 测试环境下会跳过数据库约束验证，只验证 API 行为。
"""
from __future__ import annotations

import unittest
from sqlalchemy.exc import IntegrityError

from backend.models import GenerationTask
from backend.task_status import ACTIVE_TASK_STATUSES
from tests.base import BaseWorkflowTestCase


class TestTaskConcurrentCreation(BaseWorkflowTestCase):
    """测试并发任务创建防护"""

    def setUp(self):
        super().setUp()
        self.user = self._create_user("testuser", "test@example.com")
        self._set_current_user(self.user)
        self.project = self._create_project_full(self.user, "Test Novel")

    def test_active_statuses_are_properly_defined(self):
        """测试：ACTIVE_TASK_STATUSES 包含所有活跃状态"""
        # 这些状态应该被唯一索引约束
        expected_active_states = {'pending', 'started', 'progress', 'waiting_confirm'}
        actual_active_states = set(ACTIVE_TASK_STATUSES)

        # 验证所有期望的活跃状态都在定义中
        for state in expected_active_states:
            self.assertIn(
                state, ACTIVE_TASK_STATUSES,
                f"{state} 应该在 ACTIVE_TASK_STATUSES 中，否则索引不完整"
            )

        # 验证没有多余状态（防止添加新状态时忘记更新索引）
        for state in actual_active_states:
            self.assertIn(
                state, expected_active_states,
                f"意外的活跃状态 {state}，需要更新部分唯一索引条件"
            )

    def test_can_create_task_when_no_active_tasks(self):
        """测试：没有活跃任务时可以正常创建新任务"""
        # GIVEN: 一个项目，所有任务都是 success/failure/cancelled（终端状态）
        terminal_states = ['success', 'failure', 'cancelled']
        db = self.SessionLocal()
        try:
            for i, status in enumerate(terminal_states):
                task = GenerationTask(
                    project_id=self.project.id,
                    celery_task_id=f"task-{i}",
                    status=status,
                )
                db.add(task)
            db.commit()

            # WHEN: 创建新任务（活跃状态）
            new_task = GenerationTask(
                project_id=self.project.id,
                celery_task_id="task-new",
                status="pending",
            )
            db.add(new_task)

            # THEN: 应该成功（没有异常）
            db.commit()
            self.assertIsNotNone(new_task.id)
        finally:
            db.close()

    def test_postgresql_partial_unique_index_sql(self):
        """测试：验证模型中定义的部分唯一索引 SQL 条件正确"""
        from backend.models import GenerationTask

        # 检查表索引
        unique_indexes = [
            idx for idx in GenerationTask.__table__.indexes
            if idx.unique and idx.name == 'idx_one_active_task_per_project'
        ]

        # 索引应该存在
        self.assertEqual(len(unique_indexes), 1, "应该存在部分唯一索引 idx_one_active_task_per_project")

        idx = unique_indexes[0]

        # 应该包含 project_id 列
        col_names = [col.name for col in idx.columns]
        self.assertEqual(col_names, ['project_id'], "唯一索引应该只在 project_id 列上")

        # 验证 postgresql_where 条件（存储在 idx.kwargs 中）
        pg_where = idx.kwargs.get('postgresql_where')
        self.assertIsNotNone(pg_where, "索引应该定义 postgresql_where 条件")

        # 验证 WHERE 条件包含所有活跃状态
        where_str = str(pg_where)
        for state in ACTIVE_TASK_STATUSES:
            self.assertIn(
                state, where_str,
                f"索引 WHERE 条件应该包含状态 '{state}'"
            )

    def test_multiple_terminal_tasks_allowed(self):
        """测试：同一项目可以有多个已完成（终端状态）的任务"""
        terminal_states = ['success', 'failure', 'cancelled']
        db = self.SessionLocal()
        try:
            # GIVEN: 创建多个终端状态的任务
            for i, status in enumerate(terminal_states):
                for j in range(2):  # 每个终端状态创建2个任务
                    task = GenerationTask(
                        project_id=self.project.id,
                        celery_task_id=f"task-{status}-{j}",
                        status=status,
                    )
                    db.add(task)

            # THEN: 所有终端状态任务都应该成功创建
            db.commit()

            count = db.query(GenerationTask).filter(
                GenerationTask.project_id == self.project.id
            ).count()
            self.assertEqual(count, 6, "应该有6个终端状态任务")
        finally:
            db.close()


if __name__ == '__main__':
    unittest.main()
