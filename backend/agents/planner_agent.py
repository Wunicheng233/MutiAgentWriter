import openai
from backend.utils.volc_engine import call_volc_api
from backend.utils.logger import logger

def generate_plan(
    core_requirement: str,
    target_platform: str,
    chapter_word_count: str,
    content_type: str = "full_novel",
    world_bible: str = "",
    genre: str = "",
    total_words: str = "",
    core_hook: str = "",
    client: openai.OpenAI = None,
    perspective: str = None,
    perspective_strength: float = 0.7,
    project_config: dict = None,
) -> str:
    # 构建占位符替换上下文（与 prompts/planner.md 严格匹配）
    context = {}
    if target_platform:
        context["platform"] = target_platform
    if total_words:
        context["target_words"] = str(total_words)
    if core_hook:
        context["core_hook"] = core_hook
    context["content_type"] = content_type
    context["user_requirements"] = core_requirement
    context["chapter_word_count"] = str(chapter_word_count)

    user_input = f"""
    核心创作需求：{core_requirement}
    目标平台：{target_platform}
    单章字数：{chapter_word_count}
    内容类型：{content_type}
    """
    logger.info(f" 顶层策划Agent正在生成{content_type}方案...")
    return call_volc_api(
        "planner",
        user_input,
        content_type=content_type,
        context=context,
        client=client,
        perspective=perspective,
        perspective_strength=perspective_strength,
        project_config=project_config,
    )

def revise_plan(
    original_plan: str,
    feedback: str,
    original_requirement: str,
    client: openai.OpenAI = None,
    perspective: str = None,
    perspective_strength: float = 0.7,
    project_config: dict = None,
) -> str:
    user_input = f"""
    原需求：{original_requirement}
    原方案：{original_plan}
    修改意见：{feedback}
    """
    logger.info(" 顶层策划Agent正在修改方案...")
    return call_volc_api(
        "planner",
        user_input,
        client=client,
        perspective=perspective,
        perspective_strength=perspective_strength,
        project_config=project_config,
    )
