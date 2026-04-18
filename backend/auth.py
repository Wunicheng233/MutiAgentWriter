"""
JWT 认证工具
密码哈希和验证，token 签发和验证
"""

import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from core.config import settings

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
