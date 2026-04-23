"""
任务状态常量

长期目标：
- 让“什么算活跃任务”成为中心化规则
- 避免不同 API 对 waiting_confirm 等中间态判断不一致
"""

ACTIVE_TASK_STATUSES = (
    "pending",
    "started",
    "progress",
    "waiting_confirm",
)
