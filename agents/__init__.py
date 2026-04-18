"""
StoryForge AI 精简架构 - 4 核心Agent

1. Planner - 故事架构师：生成设定圣经和分章大纲
2. Writer - 叙事作家：根据大纲生成章节初稿
3. Critic - 章节评审员：评审章节，输出JSON格式问题清单
4. Revise - 内容修订师：根据问题清单严格执行修订
"""

from .planner_agent import generate_plan, revise_plan
from .writer_agent import generate_chapter, rewrite_chapter
from .critic_agent import critic_chapter
from .revise_agent import revise_chapter

__all__ = [
    "generate_plan", "revise_plan",
    "generate_chapter", "rewrite_chapter",
    "critic_chapter",
    "revise_chapter",
]