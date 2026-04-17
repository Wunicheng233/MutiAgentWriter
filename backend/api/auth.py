"""
认证路由
注册、登录、获取用户信息
"""

import secrets
import datetime
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import exists, and_
from sqlalchemy import func, extract
from pydantic import BaseModel
from backend.models import TokenUsage
from core.config import settings

from backend.database import get_db
from backend.models import User
from backend.schemas import UserCreate, UserLogin, Token, UserResponse
from backend.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    password_needs_upgrade,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from backend.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, summary="用户注册")
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    注册新用户
    - username: 用户名（唯一）
    - email: 邮箱（唯一）
    - password: 密码
    """
    # 检查用户名是否已存在
    if db.query(exists().select_from(User).where(User.username == user_in.username)).scalar():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    # 检查邮箱是否已存在
    if db.query(exists().select_from(User).where(User.email == user_in.email)).scalar():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已注册"
        )

    # 创建用户
    user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        api_key=secrets.token_urlsafe(32),  # 生成随机API key
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=Token, summary="用户登录")
def login(form_data: UserLogin, db: Session = Depends(get_db)):
    """
    用户登录，获取JWT访问令牌
    - username: 用户名
    - password: 密码
    """
    # 查找用户
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户已禁用"
        )

    # 如果密码哈希需要升级（从旧 bcrypt 升级到 pbkdf2_sha256），自动升级
    if password_needs_upgrade(user.hashed_password):
        user.hashed_password = get_password_hash(form_data.password)
        db.commit()

    # 创建access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user)
    }


@router.get("/me", response_model=UserResponse, summary="获取当前用户信息")
def get_me(current_user: User = Depends(get_current_user)):
    """获取当前认证用户的信息"""
    return current_user


@router.post("/refresh-api-key", response_model=UserResponse, summary="刷新API Key")
def refresh_api_key(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """生成新的API Key，旧Key失效"""
    current_user.api_key = secrets.token_urlsafe(32)
    db.commit()
    db.refresh(current_user)
    return current_user


class UpdateApiKeyRequest(BaseModel):
    api_key: str

@router.put("/api-key", response_model=UserResponse, summary="更新用户自定义API Key")
def update_api_key(request: UpdateApiKeyRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """更新用户自己的API Key（比如火山引擎 API Key）"""
    current_user.api_key = request.api_key.strip()
    db.commit()
    db.refresh(current_user)
    return current_user


class UserMonthlyTokenStats(BaseModel):
    month: str
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float

@router.get("/me/token-stats", response_model=UserMonthlyTokenStats, summary="获取用户本月Token使用统计")
def get_user_monthly_token_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取当前用户本月累计Token使用和估算成本"""
    today = datetime.datetime.utcnow()
    start_of_month = datetime.datetime(today.year, today.month, 1)

    stats = db.query(
        func.sum(TokenUsage.prompt_tokens).label("total_prompt"),
        func.sum(TokenUsage.completion_tokens).label("total_completion"),
        func.sum(TokenUsage.total_tokens).label("total"),
    ).filter(
        TokenUsage.user_id == current_user.id,
        TokenUsage.created_at >= start_of_month
    ).first()

    total_prompt = stats[0] or 0
    total_completion = stats[1] or 0
    total = stats[2] or 0

    # 计算估算成本
    estimated_cost = (
        (total_prompt / 1000) * settings.default_prompt_price +
        (total_completion / 1000) * settings.default_completion_price
    )

    month_label = f"{today.year}-{today.month:02d}"

    return {
        "month": month_label,
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "total_tokens": total,
        "estimated_cost_usd": round(estimated_cost, 4),
    }
