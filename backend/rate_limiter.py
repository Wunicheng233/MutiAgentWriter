"""
简单的内存速率限制器
支持基于 IP 地址或用户 ID 的请求频率限制
"""
from __future__ import annotations

import time
import threading
from collections import defaultdict
from typing import Callable
from fastapi import HTTPException, status, Request, Depends

from backend.models import User
from backend.deps import get_current_user


class RateLimiter:
    """内存速率限制器"""

    def __init__(self):
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def _cleanup(self, key: str, window_seconds: int):
        """清理过期的请求记录"""
        now = time.time()
        self._requests[key] = [
            req_time for req_time in self._requests[key]
            if now - req_time < window_seconds
        ]

    def check(self, key: str, max_requests: int, window_seconds: int = 60) -> bool:
        """
        检查是否超过速率限制
        :param key: 限制键（IP 地址或用户 ID 等）
        :param max_requests: 窗口内最大请求数
        :param window_seconds: 窗口大小（秒），默认 60 秒
        :return: True 表示允许，False 表示超过限制
        """
        with self._lock:
            self._cleanup(key, window_seconds)
            if len(self._requests[key]) >= max_requests:
                return False
            self._requests[key].append(time.time())
            return True

    def reset(self, key: str | None = None):
        """
        重置限制器状态
        :param key: 如果指定，只重置该键的记录；否则重置所有记录
        """
        with self._lock:
            if key:
                self._requests.pop(key, None)
            else:
                self._requests.clear()


# 全局限流器实例
rate_limiter = RateLimiter()


def get_ip_from_request(request: Request) -> str:
    """从请求中获取客户端 IP 地址"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


def limit_requests(max_requests: int, window_seconds: int = 60):
    """
    基于 IP 的速率限制依赖函数
    :param max_requests: 窗口内最大请求数
    :param window_seconds: 窗口大小（秒）
    """

    def dependency(request: Request):
        client_ip = get_ip_from_request(request)
        if not rate_limiter.check(client_ip, max_requests, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"请求过于频繁，请稍后再试。限制：每{window_seconds}秒{max_requests}次"
            )

    return dependency


def limit_requests_by_user(max_requests: int, window_seconds: int = 60, action_key: str = "default"):
    """
    基于用户 ID 的速率限制依赖函数工厂

    每个用户有独立的限流计数，不受其他用户影响。
    适用于需要登录的接口，防止单个用户滥用资源。

    用法:
        @router.post("/endpoint")
        def endpoint(
            current_user: User = Depends(get_current_user),
            _: None = Depends(limit_requests_by_user(5, 60, "action"))
        ):
            ...

    :param max_requests: 窗口内最大请求数
    :param window_seconds: 窗口大小（秒）
    :param action_key: 操作类型标识（如 "export"、"share_create" 等），用于区分不同接口的限流
    :return: FastAPI 依赖函数
    """

    def dependency(current_user: User = Depends(get_current_user)):
        """实际的限流依赖函数"""
        rate_limit_key = f"user:{current_user.id}:{action_key}"
        if not rate_limiter.check(rate_limit_key, max_requests, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"请求过于频繁，请稍后再试。限制：每{window_seconds}秒{max_requests}次"
            )

    return dependency
