"""Task 6: add reading_progress table for reading progress tracking

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-17 22:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 创建 reading_progress 表
    op.create_table(
        'reading_progress',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('chapter_index', sa.Integer(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, default=1),
        sa.Column('percentage', sa.Float(), nullable=False, default=0.0),
        sa.Column('last_read_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('reading_progress')
