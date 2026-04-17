"""
Agent 实例池
使用单例模式缓存Agent实例，避免重复初始化开销
惰性初始化：第一次get_agent时才创建实例
"""

import openai
from typing import Dict, Any, Type
from .config import settings
from utils.logger import logger

# 导入各个Agent模块
from agents import (
    planner_agent,
    guardian_agent,
    writer_agent,
    editor_agent,
    compliance_agent,
    quality_agent,
    critic_agent,
    fix_agent,
)


class BaseAgent:
    """Agent基类，统一接口"""

    def __init__(self, agent_name: str, client: openai.OpenAI, model: str, temperature: float):
        self.agent_name = agent_name
        self.client = client
        self.model = model
        self.default_temperature = temperature

    def get_client(self) -> openai.OpenAI:
        """获取OpenAI客户端"""
        return self.client


class PlannerAgent(BaseAgent):
    """策划Agent"""

    def __init__(self, client: openai.OpenAI, model: str, temperature: float):
        super().__init__("planner", client, model, temperature)

    def generate_plan(self, core_requirement: str, target_platform: str, chapter_word_count: str, content_type: str = "full_novel") -> str:
        return planner_agent.generate_plan(
            core_requirement, target_platform, chapter_word_count, content_type,
            client=self.client
        )

    def revise_plan(self, original_plan: str, feedback: str, original_requirement: str) -> str:
        return planner_agent.revise_plan(
            original_plan, feedback, original_requirement,
            client=self.client
        )


class GuardianAgent(BaseAgent):
    """守护Agent（设定圣经生成与一致性校验）"""

    def __init__(self, client: openai.OpenAI, model: str, temperature: float):
        super().__init__("guardian", client, model, temperature)

    def generate_setting_bible(self, plan: str) -> str:
        return guardian_agent.generate_setting_bible(plan, client=self.client)

    def check_setting_consistency(self, setting_bible: str, content: str) -> str:
        return guardian_agent.check_setting_consistency(setting_bible, content, client=self.client)

    def extract_chapter_state(self, content: str, chapter_num: int) -> dict:
        return guardian_agent.extract_chapter_state(content, chapter_num, client=self.client)


class WriterAgent(BaseAgent):
    """写作Agent"""

    def __init__(self, client: openai.OpenAI, model: str, temperature: float):
        super().__init__("writer", client, model, temperature)

    def generate_chapter(self, setting_bible: str, plan: str, chapter_num: int, prev_chapter_end: str = "", related_content: str = "", constraints: dict = None, target_word_count: int = 2000, content_type: str = "full_novel") -> str:
        return writer_agent.generate_chapter(
            setting_bible, plan, chapter_num, prev_chapter_end, related_content, constraints, target_word_count, content_type,
            client=self.client
        )

    def rewrite_chapter(self, setting_bible: str, original_draft: str, feedback: str, chapter_num: int = None) -> str:
        return writer_agent.rewrite_chapter(
            setting_bible, original_draft, feedback, chapter_num,
            client=self.client
        )


class EditorAgent(BaseAgent):
    """编辑Agent（润色）"""

    def __init__(self, client: openai.OpenAI, model: str, temperature: float):
        super().__init__("editor", client, model, temperature)

    def edit_chapter(self, content: str) -> str:
        return editor_agent.edit_chapter(content, client=self.client)

    def revise_for_compliance(self, content: str, compliance_result: str) -> str:
        return editor_agent.revise_for_compliance(content, compliance_result, client=self.client)


class ComplianceAgent(BaseAgent):
    """合规检查Agent"""

    def __init__(self, client: openai.OpenAI, model: str, temperature: float):
        super().__init__("compliance", client, model, temperature)

    def check_compliance(self, content: str) -> str:
        return compliance_agent.check_compliance(content, client=self.client)


class QualityAgent(BaseAgent):
    """质量优化Agent"""

    def __init__(self, client: openai.OpenAI, model: str, temperature: float):
        super().__init__("quality", client, model, temperature)

    def check_quality(self, content: str, target_word_count_int: int, setting_bible: str, chapter_num: int, prev_chapter_end: str) -> tuple:
        return quality_agent.check_quality(
            content, target_word_count_int, setting_bible, chapter_num, prev_chapter_end,
            client=self.client
        )

    def optimize_quality(self, edited: str, target_word_count_int: int, setting_bible: str, issues: str, chapter_num: int, prev_chapter_end: str) -> str:
        return quality_agent.optimize_quality(
            edited, target_word_count_int, setting_bible, issues, chapter_num, prev_chapter_end,
            client=self.client
        )

    def generate_chapter_title(self, content: str, chapter_num: int) -> str:
        return quality_agent.generate_chapter_title(content, chapter_num, client=self.client)


class CriticAgent(BaseAgent):
    """评论家Agent"""

    def __init__(self, client: openai.OpenAI, model: str, temperature: float):
        super().__init__("critic", client, model, temperature)

    def critic_chapter(self, edited: str, target_word_count: int, chapter_num: int, setting_bible: str) -> tuple:
        return critic_agent.critic_chapter(
            edited, target_word_count, chapter_num, setting_bible,
            client=self.client
        )


class FixAgent(BaseAgent):
    """统一修复Agent"""

    def __init__(self, client: openai.OpenAI, model: str, temperature: float):
        super().__init__("fix", client, model, temperature)

    def fix_all_issues(self, current_draft: str, target_word_count_int: int, setting_bible: str, all_problems_text: str, chapter_num: int, prev_chapter_end: str) -> str:
        return fix_agent.fix_all_issues(
            current_draft, target_word_count_int, setting_bible, all_problems_text, chapter_num, prev_chapter_end,
            client=self.client
        )


class AgentPool:
    """Agent实例池，全局单例"""

    _instance: "AgentPool" = None
    _instances: Dict[str, Any] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._instances = {}
        return cls._instance

    def __init__(self):
        # Agent名称到类的映射，显式声明避免动态反射
        self._agent_map: Dict[str, Type[BaseAgent]] = {
            "planner": PlannerAgent,
            "guardian": GuardianAgent,
            "writer": WriterAgent,
            "editor": EditorAgent,
            "compliance": ComplianceAgent,
            "quality": QualityAgent,
            "critic": CriticAgent,
            "fix": FixAgent,
        }

    def get_agent(self, agent_name: str) -> BaseAgent:
        """
        获取Agent实例，如果池中不存在则惰性创建
        线程安全：Python模块导入是线程安全的，此处仅读取+单例赋值
        """
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


# 全局单例
agent_pool = AgentPool()
