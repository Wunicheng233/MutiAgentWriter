"""
Agent 实例池
StoryForge AI 精简架构 - 仅保留 4 个核心 Agent:
1. Planner - 故事架构师（生成设定圣经和分章大纲）
2. Writer - 叙事作家（生成章节初稿）
3. Critic - 章节评审员（输出JSON问题清单）
4. Revise - 内容修订师（按指令修订章节）

使用单例模式缓存Agent实例，避免重复初始化开销
惰性初始化：第一次get_agent时才创建实例
"""

import openai
import threading
from typing import Dict, Any, Type
from .agent_contract import AgentContract, get_agent_contract
from .config import settings
from backend.utils.logger import logger

# 导入各个Agent模块
from backend.agents import (
    planner_agent,
    writer_agent,
    critic_agent,
    revise_agent,
)


class BaseAgent:
    """Agent基类，统一接口"""

    def __init__(self, agent_name: str, client: openai.OpenAI, model: str, temperature: float):
        self.agent_name = agent_name
        self.contract: AgentContract = get_agent_contract(agent_name)
        self.client = client
        self.model = model
        self.default_temperature = temperature

    def get_client(self) -> openai.OpenAI:
        """获取OpenAI客户端"""
        return self.client


class PlannerAgent(BaseAgent):
    """Planner - 故事架构师"""

    def __init__(self, client: openai.OpenAI, model: str, temperature: float):
        super().__init__("planner", client, model, temperature)

    def generate_plan(self, core_requirement: str, target_platform: str, chapter_word_count: str, content_type: str = "full_novel", world_bible: str = "", genre: str = "", total_words: str = "", core_hook: str = "", perspective: str = None, perspective_strength: float = 0.7) -> str:
        return planner_agent.generate_plan(
            core_requirement, target_platform, chapter_word_count, content_type,
            world_bible=world_bible, genre=genre, total_words=total_words, core_hook=core_hook,
            perspective=perspective, perspective_strength=perspective_strength,
            project_config=getattr(self, "project_config", None),
            client=self.client
        )

    def revise_plan(self, original_plan: str, feedback: str, original_requirement: str, perspective: str = None, perspective_strength: float = 0.7) -> str:
        return planner_agent.revise_plan(
            original_plan, feedback, original_requirement,
            perspective=perspective, perspective_strength=perspective_strength,
            project_config=getattr(self, "project_config", None),
            client=self.client
        )


class WriterAgent(BaseAgent):
    """Writer - 叙事作家"""

    def __init__(self, client: openai.OpenAI, model: str, temperature: float):
        super().__init__("writer", client, model, temperature)

    def generate_chapter(
        self,
        setting_bible: str,
        plan: str,
        chapter_num: int,
        prev_chapter_end: str = "",
        related_content: str = "",
        constraints: dict = None,
        target_word_count: int = 2000,
        content_type: str = "novel",
        perspective: str = None,
        perspective_strength: float = 0.7,
        budgeted_scene_plan: str = "",
        word_count_policy: dict | None = None,
        chapter_context: object = None,
    ) -> str:
        return writer_agent.generate_chapter(
            setting_bible, plan, chapter_num, prev_chapter_end, related_content, constraints, target_word_count, content_type,
            perspective=perspective, perspective_strength=perspective_strength,
            project_config=getattr(self, "project_config", None),
            budgeted_scene_plan=budgeted_scene_plan,
            word_count_policy=word_count_policy,
            client=self.client,
            chapter_context=chapter_context,
        )

    def rewrite_chapter(self, setting_bible: str, original_draft: str, feedback: str, chapter_num: int = None, perspective: str = None, perspective_strength: float = 0.7) -> str:
        return writer_agent.rewrite_chapter(
            setting_bible, original_draft, feedback, chapter_num,
            perspective=perspective, perspective_strength=perspective_strength,
            project_config=getattr(self, "project_config", None),
            client=self.client
        )


class CriticAgent(BaseAgent):
    """Critic - 章节评审员"""

    def __init__(self, client: openai.OpenAI, model: str, temperature: float):
        super().__init__("critic", client, model, temperature)

    def critic_chapter(self, chapter_content: str, setting_bible: str, chapter_outline: str, content_type: str = "novel", perspective: str = None, perspective_strength: float = 0.7, scene_anchors_context: str = "", novel_state_snapshot: str = "") -> tuple:
        return critic_agent.critic_chapter(
            chapter_content, setting_bible, chapter_outline, content_type,
            perspective=perspective, perspective_strength=perspective_strength,
            project_config=getattr(self, "project_config", None),
            client=self.client,
            scene_anchors_context=scene_anchors_context,
            novel_state_snapshot=novel_state_snapshot,
        )


class ReviseAgent(BaseAgent):
    """Revise - 内容修订师"""

    def __init__(self, client: openai.OpenAI, model: str, temperature: float):
        super().__init__("revise", client, model, temperature)

    def revise_chapter(self, original_chapter: str, critic_issues: list, setting_bible: str, perspective: str = None, perspective_strength: float = 0.7) -> str:
        return revise_agent.revise_chapter(
            original_chapter, critic_issues, setting_bible,
            perspective=perspective, perspective_strength=perspective_strength,
            project_config=getattr(self, "project_config", None),
            client=self.client
        )

    def revise_local_patch(self, original_chapter: str, repair_issue: dict, local_context: dict, setting_bible: str, perspective: str = None, perspective_strength: float = 0.7) -> dict:
        return revise_agent.revise_local_patch(
            original_chapter, repair_issue, local_context, setting_bible,
            perspective=perspective, perspective_strength=perspective_strength,
            project_config=getattr(self, "project_config", None),
            client=self.client
        )

    def stitch_chapter(self, chapter_content: str, repair_trace: list, setting_bible: str, perspective: str = None, perspective_strength: float = 0.7) -> str:
        return revise_agent.stitch_chapter(
            chapter_content, repair_trace, setting_bible,
            perspective=perspective, perspective_strength=perspective_strength,
            project_config=getattr(self, "project_config", None),
            client=self.client
        )


class AgentPool:
    """Agent实例池，全局单例"""

    _instance: "AgentPool" = None
    _lock: threading.Lock = threading.Lock()
    _instances: Dict[str, Any] = {}

    def __new__(cls):
        # 双重检查锁定，保证线程安全的单例创建
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._instances = {}
                    cls._instance._agent_map = {}
        return cls._instance

    def __init__(self):
        # Agent名称到类的映射，显式声明避免动态反射
        if not hasattr(self, "_agent_map") or not self._agent_map:
            self._agent_map: Dict[str, Type[BaseAgent]] = {
                "planner": PlannerAgent,
                "writer": WriterAgent,
                "critic": CriticAgent,
                "revise": ReviseAgent,
            }

    def get_agent(self, agent_name: str) -> BaseAgent:
        """
        获取Agent实例，如果池中不存在则惰性创建
        使用双重检查锁定保证线程安全
        """
        if agent_name not in self._instances:
            with self._lock:
                if agent_name not in self._instances:
                    logger.info(f"AgentPool: 惰性初始化 {agent_name} Agent")
                    agent_class = self._agent_map[agent_name]
                    api_key = settings.get_api_key_for_agent(agent_name)
                    model = settings.get_model_for_agent(agent_name)
                    temperature = settings.get_temperature_for_agent(agent_name)

                    # 创建OpenAI客户端
                    client = openai.OpenAI(
                        api_key=api_key,
                        base_url=settings.base_url
                    )

                    # 创建Agent实例
                    agent = agent_class(client, model, temperature)
                    self._instances[agent_name] = agent

        return self._instances[agent_name]

    def get_all_agents(self) -> Dict[str, BaseAgent]:
        """预初始化所有Agent（可选，启动时预热）"""
        for name in self._agent_map:
            self.get_agent(name)
        return self._instances.copy()

    def clear(self):
        """清空池，用于测试或重启"""
        self._instances.clear()

    @property
    def initialized_agents(self) -> list[str]:
        """获取已初始化的Agent列表"""
        return list(self._instances.keys())


# 导出常用类给orchestrator
__all__ = [
    "BaseAgent",
    "PlannerAgent",
    "WriterAgent",
    "CriticAgent",
    "ReviseAgent",
    "AgentPool",
    "agent_pool",
]

# 全局单例
agent_pool = AgentPool()
