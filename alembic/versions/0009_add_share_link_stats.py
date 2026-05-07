"""add share link access statistics

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-07 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0009"
down_revision: Union[str, Sequence[str], None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("share_links", sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("share_links", sa.Column("last_viewed_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("share_links", "last_viewed_at")
    op.drop_column("share_links", "view_count")
