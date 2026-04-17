"""
Core 模块 - 重构后的核心层
- config: 统一配置中心
- agent_pool: Agent 实例池
- orchestrator: 小说生成流程编排器
- worldview_manager: 世界观状态管理器（原有）
"""

from .config import settings
from .agent_pool import agent_pool, AgentPool
from .orchestrator import NovelOrchestrator

__all__ = ["settings", "agent_pool", "AgentPool", "NovelOrchestrator"]
