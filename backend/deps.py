"""
FastAPI 依赖项
- get_db: 获取数据库会话
- get_current_user: 获取当前认证用户
"""

from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

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
    手动从 Authorization header 提取 token。
    注意：不要记录 Authorization header、token 或 payload，避免密钥进入日志。
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 手动从 header 提取 token
    auth_header = request.headers.get('Authorization')

    if not auth_header:
        logger.debug("Authorization header not found")
        raise credentials_exception

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        logger.debug("Invalid Authorization header format")
        raise credentials_exception

    token = parts[1]

    payload = decode_token(token)
    if payload is None:
        logger.debug("JWT verification failed")
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        logger.debug("JWT payload missing subject")
        raise credentials_exception

    # JWT 解码后 sub 可能是字符串，需要转成 int
    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        logger.debug("JWT subject is not a valid user id")
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if user is None:
        logger.debug("Authenticated user not found or inactive")
        raise credentials_exception

    logger.debug("User authenticated successfully")
    return user
