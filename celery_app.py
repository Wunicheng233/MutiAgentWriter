"""
Celery 应用配置
异步任务队列，用于小说生成后台执行
"""

import sys
from pathlib import Path

# 添加当前目录到 Python 路径
sys.path.append(str(Path(__file__).parent))

from celery import Celery
from backend.core.config import settings

# 配置Redis连接URL，优先从环境变量读取，默认本地
import os
broker_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

# 创建Celery应用
celery_app = Celery(
    "novel_writing",
    broker=broker_url,
    backend=result_backend,
)

# 配置
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=False,
    task_track_started=True,  # 允许追踪STARTED状态
    result_expires=86400,  # 任务结果保留24小时
    worker_concurrency=1,  # 默认单worker，因为每个生成任务已经大量调用LLM
    task_time_limit=28800,  # 硬超时8小时
    task_soft_time_limit=27000,  # 软超时7.5小时
    acks_late=True,  # 任务完成后才确认
    task_reject_on_worker_lost=True,  # worker丢失时重新入队
)

# 自动发现tasks目录下的任务
celery_app.autodiscover_tasks(["backend.tasks"])

if __name__ == "__main__":
    celery_app.start()
