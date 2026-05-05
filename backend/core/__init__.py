"""
Core 模块 - 重构后的核心层
- config: 统一配置中心
- agent_pool: Agent 实例池
- orchestrator: 小说生成流程编排器
- worldview_manager: 世界观状态管理器（原有）
"""

from .config import settings

__all__ = ["settings", "agent_pool", "AgentPool", "NovelOrchestrator"]


def __getattr__(name):
    """Lazy-load heavy core exports to avoid import cycles during config setup."""
    if name in {"agent_pool", "AgentPool"}:
        from .agent_pool import AgentPool, agent_pool

        return {"agent_pool": agent_pool, "AgentPool": AgentPool}[name]
    if name == "NovelOrchestrator":
        from .orchestrator import NovelOrchestrator

        return NovelOrchestrator
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
