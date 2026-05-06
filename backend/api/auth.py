"""
认证路由
注册、登录、获取用户信息
"""

import datetime
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import exists
from sqlalchemy import func
from pydantic import BaseModel
from backend.models import TokenUsage
from backend.core.config import settings

from backend.database import get_db
from backend.models import User
from backend.schemas import UserCreate, UserLogin, Token, UserResponse
from backend.auth import (
    build_user_response,
    clear_user_api_key as clear_persisted_user_api_key,
    get_user_api_key,
    reset_user_llm_settings,
    verify_password,
    get_password_hash,
    set_user_api_key,
    create_access_token,
    password_needs_upgrade,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from backend.deps import get_current_user
from backend.rate_limiter import limit_requests

router = APIRouter(prefix="/auth", tags=["auth"])

LLM_PROVIDER_DEFAULT_BASE_URLS = {
    "volcengine": "https://ark.cn-beijing.volces.com/api/coding/v3",
    "openai": "https://api.openai.com/v1",
    "deepseek": "https://api.deepseek.com",
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "moonshot": "https://api.moonshot.cn/v1",
}
ALLOWED_LLM_PROVIDERS = {"system", "volcengine", "openai", "deepseek", "qwen", "moonshot", "custom"}


def _get_persistent_current_user(db: Session, current_user: User) -> User:
    """Load the current user into the active DB session before mutating it."""
    persisted_user = db.query(User).filter(User.id == current_user.id).first()
    if persisted_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )
    return persisted_user


@router.post("/register", response_model=UserResponse, summary="用户注册", dependencies=[Depends(limit_requests(3))])
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
        api_key=None,  # 默认走系统统一配置，用户可在设置页显式填写自己的模型 API Key
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return build_user_response(user)


@router.post("/login", response_model=Token, summary="用户登录", dependencies=[Depends(limit_requests(5))])
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
        "user": build_user_response(user)
    }


@router.get("/me", response_model=UserResponse, summary="获取当前用户信息")
def get_me(current_user: User = Depends(get_current_user)):
    """获取当前认证用户的信息"""
    return build_user_response(current_user)


@router.post("/refresh-api-key", response_model=UserResponse, summary="清除用户自定义API Key")
def refresh_api_key(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """兼容旧前端入口：清除用户自定义模型 API Key，恢复使用系统统一配置。"""
    persisted_user = _get_persistent_current_user(db, current_user)
    clear_persisted_user_api_key(persisted_user)
    db.commit()
    db.refresh(persisted_user)
    return build_user_response(persisted_user)


@router.delete("/api-key", response_model=UserResponse, summary="清除用户自定义API Key")
def clear_api_key(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """清除用户自己的模型 API Key，恢复使用系统统一配置。"""
    persisted_user = _get_persistent_current_user(db, current_user)
    clear_persisted_user_api_key(persisted_user)
    db.commit()
    db.refresh(persisted_user)
    return build_user_response(persisted_user)


class UpdateApiKeyRequest(BaseModel):
    api_key: str

@router.put("/api-key", response_model=UserResponse, summary="更新用户自定义API Key")
def update_api_key(request: UpdateApiKeyRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """更新用户自己的模型供应商 API Key。"""
    persisted_user = _get_persistent_current_user(db, current_user)
    set_user_api_key(persisted_user, request.api_key)
    db.commit()
    db.refresh(persisted_user)
    return build_user_response(persisted_user)


class UpdateLLMSettingsRequest(BaseModel):
    provider: str | None = None
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = None


@router.put("/llm-settings", response_model=UserResponse, summary="更新用户模型供应商设置")
def update_llm_settings(
    request: UpdateLLMSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a user's account-level OpenAI-compatible model route."""
    provider = (request.provider or "system").strip().lower() or "system"
    if provider not in ALLOWED_LLM_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不支持的模型供应商",
        )

    base_url = (request.base_url or "").strip()
    model = (request.model or "").strip()
    if provider == "system":
        base_url = ""
        model = ""
    elif not base_url:
        base_url = LLM_PROVIDER_DEFAULT_BASE_URLS.get(provider, "")

    if base_url and not (base_url.startswith("https://") or base_url.startswith("http://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API Base URL 必须以 http:// 或 https:// 开头",
        )
    if provider == "custom" and not base_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="自定义供应商必须填写 API Base URL",
        )
    if provider not in {"system", "volcengine"} and not model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该供应商需要填写模型 ID",
        )

    persisted_user = _get_persistent_current_user(db, current_user)
    next_api_key = (request.api_key or "").strip() if request.api_key is not None else get_user_api_key(persisted_user)
    if provider != "system" and not next_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请选择系统默认，或填写该供应商的 API Key",
        )

    persisted_user.llm_provider = provider
    persisted_user.llm_base_url = base_url or None
    persisted_user.llm_model = model or None
    if request.api_key is not None:
        set_user_api_key(persisted_user, request.api_key)
    db.commit()
    db.refresh(persisted_user)
    return build_user_response(persisted_user)


@router.delete("/llm-settings", response_model=UserResponse, summary="恢复系统默认模型供应商设置")
def reset_llm_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Clear account-level provider/model/API key settings."""
    persisted_user = _get_persistent_current_user(db, current_user)
    reset_user_llm_settings(persisted_user)
    db.commit()
    db.refresh(persisted_user)
    return build_user_response(persisted_user)


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
