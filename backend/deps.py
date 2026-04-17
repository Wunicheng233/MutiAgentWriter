"""
FastAPI 依赖项
- get_db: 获取数据库会话
- get_current_user: 获取当前认证用户
"""

from typing import Generator
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from jose import JWTError

from backend.database import get_db
from backend.auth import decode_token
from backend.models import User

import logging
logger = logging.getLogger(__name__)

async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    """
    获取当前认证用户
    用于保护需要认证的路由
    手动从 Authorization header 提取 token，方便调试
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 手动从 header 提取 token
    auth_header = request.headers.get('Authorization')
    logger.info(f"[auth-debug] Authorization header: {auth_header}")

    if not auth_header:
        logger.info("[auth-debug] No Authorization header found")
        raise credentials_exception

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        logger.info(f"[auth-debug] Invalid Authorization format: {parts}")
        raise credentials_exception

    token = parts[1]
    logger.info(f"[auth-debug] Extracted token: {token[:30]}...")

    payload = decode_token(token)
    if payload is None:
        logger.info("[auth-debug] decode_token returned None - JWT verification failed")
        raise credentials_exception

    logger.info(f"[auth-debug] Decoded payload: {payload}")
    user_id = payload.get("sub")
    if user_id is None:
        logger.info("[auth-debug] No 'sub' field in payload")
        raise credentials_exception

    # JWT 解码后 sub 可能是字符串，需要转成 int
    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        logger.info(f"[auth-debug] Invalid user_id type: {type(user_id)}, value={user_id}")
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        logger.info(f"[auth-debug] User not found or inactive: user_id={user_id}")
        raise credentials_exception

    logger.info(f"[auth-debug] User authenticated: id={user.id}, username={user.username}")
    return user
