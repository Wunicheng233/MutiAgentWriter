"""
JWT 认证工具
密码哈希和验证，token 签发和验证，以及用户自定义 API Key 的静态加密存储。
"""

from __future__ import annotations

import base64
import copy
import hashlib
from datetime import datetime, timedelta
from typing import Any, Mapping, Optional
from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from passlib.context import CryptContext
from backend.core.config import settings
from backend.models import User
from backend.schemas import UserResponse

LLM_PROVIDER_DEFAULT_BASE_URLS = {
    "volcengine": "https://ark.cn-beijing.volces.com/api/v3",
    "openai": "https://api.openai.com/v1",
    "deepseek": "https://api.deepseek.com",
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "moonshot": "https://api.moonshot.cn/v1",
}
LLM_PROVIDER_ALLOWED_BASE_URL_PREFIXES = {
    "volcengine": (
        "https://ark.cn-beijing.volces.com/api/v3",
        "https://ark.cn-beijing.volces.com/api/coding/v3",
    ),
    "openai": ("https://api.openai.com/v1",),
    "deepseek": ("https://api.deepseek.com",),
    "qwen": ("https://dashscope.aliyuncs.com/compatible-mode/v1",),
    "moonshot": ("https://api.moonshot.cn/v1",),
}
ALLOWED_LLM_PROVIDERS = {"system", "volcengine", "openai", "deepseek", "qwen", "moonshot", "custom"}
PLACEHOLDER_BASE_URL_MARKERS = (
    "api.example.com",
    "example.com",
    "example.test",
)

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


def reset_user_llm_settings(user: User) -> None:
    """Return a user to the deployment's default model route."""
    user.llm_provider = "system"
    user.llm_base_url = None
    user.llm_model = None
    clear_user_api_key(user)


def normalize_llm_base_url(base_url: str | None) -> str:
    """Normalize a user-entered OpenAI-compatible base URL without changing its path semantics."""
    return (base_url or "").strip().rstrip("/")


def is_placeholder_llm_base_url(base_url: str | None) -> bool:
    normalized = normalize_llm_base_url(base_url).lower()
    return any(marker in normalized for marker in PLACEHOLDER_BASE_URL_MARKERS)


def is_allowed_provider_base_url(provider: str, base_url: str | None) -> bool:
    normalized = normalize_llm_base_url(base_url)
    if provider == "custom":
        return bool(normalized)
    allowed_prefixes = LLM_PROVIDER_ALLOWED_BASE_URL_PREFIXES.get(provider)
    if not allowed_prefixes:
        return True
    return any(normalized == prefix or normalized.startswith(f"{prefix}/") for prefix in allowed_prefixes)


def get_user_llm_config_issues(user: User | None) -> list[str]:
    """Return actionable issues that would prevent user-owned model calls from working."""
    if user is None:
        return []

    provider = (user.llm_provider or "system").strip().lower() or "system"
    if provider == "system":
        return []

    api_key = get_user_api_key(user)
    base_url = normalize_llm_base_url(user.llm_base_url or LLM_PROVIDER_DEFAULT_BASE_URLS.get(provider, ""))
    model = (user.llm_model or "").strip()

    issues: list[str] = []
    if provider not in ALLOWED_LLM_PROVIDERS:
        issues.append("模型供应商不受支持")
    if not api_key:
        issues.append("缺少该供应商的 API Key")
    if not base_url:
        issues.append("缺少 API Base URL")
    elif is_placeholder_llm_base_url(base_url):
        issues.append("API Base URL 仍是示例占位符")
    elif not base_url.startswith(("http://", "https://")):
        issues.append("API Base URL 必须以 http:// 或 https:// 开头")
    elif not is_allowed_provider_base_url(provider, base_url):
        issues.append("API Base URL 与当前供应商不匹配，如需其他地址请选择自定义兼容接口")
    if not model:
        issues.append("缺少模型 ID")
    return issues


def build_user_llm_config(user: User | None) -> dict[str, Any]:
    """Build a project_config-compatible LLM route from account settings."""
    if user is None:
        return {}

    provider = (user.llm_provider or "system").strip().lower() or "system"
    api_key = get_user_api_key(user)
    base_url = normalize_llm_base_url(user.llm_base_url or LLM_PROVIDER_DEFAULT_BASE_URLS.get(provider, ""))
    model = (user.llm_model or "").strip()

    if provider == "system" and not api_key and not base_url and not model:
        return {}

    provider_id = "openai_compatible" if provider == "system" else provider
    provider_config: dict[str, Any] = {}
    if api_key:
        provider_config["api_key"] = api_key
    if base_url:
        provider_config["base_url"] = base_url
    if model:
        provider_config["model"] = model

    return {
        "api_source": "user",
        "default_provider": provider_id,
        "providers": {
            provider_id: provider_config,
        },
    }


def merge_user_llm_config(project_config: Mapping[str, Any] | None, user: User | None) -> dict[str, Any]:
    """Merge account-level model settings into project config.

    Project-level `config.llm` remains the more specific override. Account
    settings only provide defaults for projects that do not define their own
    provider route.
    """
    merged = copy.deepcopy(dict(project_config or {}))
    user_llm = build_user_llm_config(user)
    if not user_llm:
        return merged

    project_llm = merged.get("llm") if isinstance(merged.get("llm"), Mapping) else {}
    merged["llm"] = _deep_merge_dicts(user_llm, project_llm)
    return merged


def _deep_merge_dicts(base: Mapping[str, Any], override: Mapping[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(dict(base))
    for key, value in dict(override).items():
        if isinstance(value, Mapping) and isinstance(result.get(key), Mapping):
            result[key] = _deep_merge_dicts(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def build_user_response(user: User) -> UserResponse:
    """Serialize a User into the public response shape while still exposing a masked API key."""
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        api_key=get_user_api_key(user),
        llm_provider=user.llm_provider or "system",
        llm_base_url=user.llm_base_url,
        llm_model=user.llm_model,
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
