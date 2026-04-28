"""Add partial unique index for active generation tasks

防止同一项目有多个活跃状态的生成任务，解决 TOCTOU 竞态条件问题。

Revision ID: 679252911d65
Revises: 0006
Create Date: 2026-04-28 18:36:27.142903

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '679252911d65'
down_revision: Union[str, Sequence[str], None] = '0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建部分唯一索引：同一项目只能有一个活跃状态的生成任务"""
    op.create_index(
        'idx_one_active_task_per_project',
        'generation_tasks',
        ['project_id'],
        unique=True,
        postgresql_where=sa.text(
            "status IN ('pending', 'started', 'progress', 'waiting_confirm')"
        ),
    )


def downgrade() -> None:
    """移除部分唯一索引"""
    op.drop_index('idx_one_active_task_per_project', table_name='generation_tasks')
