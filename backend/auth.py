"""
JWT 认证工具
密码哈希和验证，token 签发和验证，以及用户自定义 API Key 的静态加密存储。
"""

import base64
import hashlib
import os
from datetime import datetime, timedelta
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from passlib.context import CryptContext
from core.config import settings
from backend.models import User
from backend.schemas import UserResponse

# 从 core.config 统一读取，确保 .env 已经加载
SECRET_KEY = settings.jwt_secret_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes

# 密码哈希上下文
# 支持 pbkdf2_sha256（新用户）和 bcrypt（旧用户），旧 bcrypt 哈希会自动升级
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    default="pbkdf2_sha256",
    pbkdf2_sha256__rounds=200000,
    deprecated=["bcrypt"]
)


def _get_user_api_key_fernet() -> Fernet:
    """Return a stable Fernet instance for encrypting user-supplied model API keys."""
    secret_material = settings.user_api_key_encryption_key or settings.jwt_secret_key
    digest = hashlib.sha256(secret_material.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_user_api_key(api_key: str) -> str:
    """Encrypt a user API key before storing it in the database."""
    return _get_user_api_key_fernet().encrypt(api_key.encode("utf-8")).decode("utf-8")


def decrypt_user_api_key(encrypted_api_key: str) -> str | None:
    """Decrypt a previously encrypted user API key. Returns None when decryption fails."""
    try:
        return _get_user_api_key_fernet().decrypt(encrypted_api_key.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def get_user_api_key(user: User | None) -> str | None:
    """Read a user's effective API key, preferring encrypted storage and falling back to legacy plaintext."""
    if user is None:
        return None

    if user.encrypted_api_key:
        decrypted = decrypt_user_api_key(user.encrypted_api_key)
        if decrypted:
            return decrypted

    return user.api_key


def set_user_api_key(user: User, api_key: str | None) -> None:
    """Persist a user's API key into encrypted storage and clear the legacy plaintext column."""
    normalized_api_key = (api_key or "").strip()
    if not normalized_api_key:
        user.api_key = None
        user.encrypted_api_key = None
        return

    user.encrypted_api_key = encrypt_user_api_key(normalized_api_key)
    user.api_key = None


def clear_user_api_key(user: User) -> None:
    """Clear both encrypted and legacy user API key storage."""
    set_user_api_key(user, None)


def build_user_response(user: User) -> UserResponse:
    """Serialize a User into the public response shape while still exposing a masked API key."""
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        api_key=get_user_api_key(user),
        is_active=user.is_active,
        created_at=user.created_at,
    )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    return pwd_context.hash(password)


def password_needs_upgrade(hashed_password: str) -> bool:
    """检查密码哈希是否需要升级到默认算法"""
    return pwd_context.needs_update(hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建JWT访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    # JWT standard requires 'sub' to be a string
    # user.id is int, convert to string for python-jose validation
    if 'sub' in to_encode:
        to_encode['sub'] = str(to_encode['sub'])
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """解码JWT令牌，返回payload，验证失败返回None"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
