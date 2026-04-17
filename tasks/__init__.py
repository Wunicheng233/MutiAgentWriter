"""
Celery 异步任务模块
- writing_tasks: 小说生成异步任务
"""

from .writing_tasks import generate_novel_task

__all__ = ["generate_novel_task"]
