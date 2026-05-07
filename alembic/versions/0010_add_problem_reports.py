"""add public beta problem reports

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-07 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0010"
down_revision: Union[str, Sequence[str], None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "problem_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(length=30), nullable=False, server_default="bug"),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("title", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("page_url", sa.String(length=500), nullable=True),
        sa.Column("route", sa.String(length=240), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("context", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_problem_reports_id"), "problem_reports", ["id"], unique=False)
    op.create_index(op.f("ix_problem_reports_user_id"), "problem_reports", ["user_id"], unique=False)
    op.create_index(op.f("ix_problem_reports_project_id"), "problem_reports", ["project_id"], unique=False)
    op.create_index(op.f("ix_problem_reports_task_id"), "problem_reports", ["task_id"], unique=False)
    op.create_index(op.f("ix_problem_reports_category"), "problem_reports", ["category"], unique=False)
    op.create_index(op.f("ix_problem_reports_severity"), "problem_reports", ["severity"], unique=False)
    op.create_index(op.f("ix_problem_reports_status"), "problem_reports", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_problem_reports_status"), table_name="problem_reports")
    op.drop_index(op.f("ix_problem_reports_severity"), table_name="problem_reports")
    op.drop_index(op.f("ix_problem_reports_category"), table_name="problem_reports")
    op.drop_index(op.f("ix_problem_reports_task_id"), table_name="problem_reports")
    op.drop_index(op.f("ix_problem_reports_project_id"), table_name="problem_reports")
    op.drop_index(op.f("ix_problem_reports_user_id"), table_name="problem_reports")
    op.drop_index(op.f("ix_problem_reports_id"), table_name="problem_reports")
    op.drop_table("problem_reports")
