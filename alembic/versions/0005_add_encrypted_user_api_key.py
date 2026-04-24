"""Add encrypted storage column for user API keys

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-24 12:15:00

"""
import base64
import hashlib
import os
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from cryptography.fernet import Fernet


# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_user_api_key_fernet() -> Fernet:
    secret_material = (
        os.getenv("USER_API_KEY_ENCRYPTION_KEY")
        or os.getenv("JWT_SECRET_KEY")
        or "your-secret-key-change-in-production-keep-it-safe"
    )
    digest = hashlib.sha256(secret_material.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def upgrade() -> None:
    op.add_column("users", sa.Column("encrypted_api_key", sa.Text(), nullable=True))
    bind = op.get_bind()
    users = sa.table(
        "users",
        sa.column("id", sa.Integer()),
        sa.column("api_key", sa.String()),
        sa.column("encrypted_api_key", sa.Text()),
    )
    fernet = _get_user_api_key_fernet()

    rows = bind.execute(
        sa.select(users.c.id, users.c.api_key).where(users.c.api_key.is_not(None))
    ).fetchall()
    for row in rows:
        normalized_api_key = (row.api_key or "").strip()
        encrypted_api_key = (
            fernet.encrypt(normalized_api_key.encode("utf-8")).decode("utf-8")
            if normalized_api_key
            else None
        )
        bind.execute(
            users.update()
            .where(users.c.id == row.id)
            .values(api_key=None, encrypted_api_key=encrypted_api_key)
        )


def downgrade() -> None:
    bind = op.get_bind()
    users = sa.table(
        "users",
        sa.column("id", sa.Integer()),
        sa.column("api_key", sa.String()),
        sa.column("encrypted_api_key", sa.Text()),
    )
    fernet = _get_user_api_key_fernet()

    rows = bind.execute(
        sa.select(users.c.id, users.c.encrypted_api_key).where(users.c.encrypted_api_key.is_not(None))
    ).fetchall()
    for row in rows:
        decrypted_api_key = fernet.decrypt(row.encrypted_api_key.encode("utf-8")).decode("utf-8")
        bind.execute(
            users.update()
            .where(users.c.id == row.id)
            .values(api_key=decrypted_api_key, encrypted_api_key=None)
        )

    op.drop_column("users", "encrypted_api_key")
