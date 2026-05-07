"""add token usage provider and api source

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-06 23:12:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0008"
down_revision: Union[str, Sequence[str], None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("token_usage", sa.Column("provider", sa.String(length=50), nullable=True))
    op.add_column("token_usage", sa.Column("api_source", sa.String(length=20), nullable=False, server_default="system"))
    op.create_index("ix_token_usage_api_source", "token_usage", ["api_source"])


def downgrade() -> None:
    op.drop_index("ix_token_usage_api_source", table_name="token_usage")
    op.drop_column("token_usage", "api_source")
    op.drop_column("token_usage", "provider")
