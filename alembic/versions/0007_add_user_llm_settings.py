"""add user llm settings

Revision ID: 0007
Revises: 679252911d65
Create Date: 2026-05-06 19:31:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007"
down_revision: Union[str, Sequence[str], None] = "679252911d65"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("llm_provider", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("llm_base_url", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("llm_model", sa.String(length=160), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "llm_model")
    op.drop_column("users", "llm_base_url")
    op.drop_column("users", "llm_provider")
