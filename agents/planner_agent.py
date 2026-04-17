import openai
from utils.volc_engine import call_volc_api
from utils.logger import logger

def generate_plan(
    core_requirement: str,
    target_platform: str,
    chapter_word_count: str,
    content_type: str = "full_novel",
    client: openai.OpenAI = None
) -> str:
    user_input = f"""
    核心创作需求：{core_requirement}
    目标平台：{target_platform}
    单章字数：{chapter_word_count}
    内容类型：{content_type}
    """
    logger.info(f"📝 顶层策划Agent正在生成{content_type}方案...")
    return call_volc_api("planner", user_input, content_type=content_type, client=client)

def revise_plan(
    original_plan: str,
    feedback: str,
    original_requirement: str,
    client: openai.OpenAI = None
) -> str:
    user_input = f"""
    原需求：{original_requirement}
    原方案：{original_plan}
    修改意见：{feedback}
    """
    logger.info("📝 顶层策划Agent正在修改方案...")
    return call_volc_api("planner", user_input, client=client)