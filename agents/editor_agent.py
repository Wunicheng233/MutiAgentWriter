from utils.volc_engine import call_volc_api
from utils.logger import logger

def edit_chapter(draft: str) -> str:
    logger.info("✨ 内容优化&润色Agent正在优化...")
    return call_volc_api("editor", draft)

def revise_for_compliance(original_content: str, feedback: str) -> str:
    user_input = f"原内容：{original_content}\n修改意见：{feedback}"
    logger.info("✨ 内容优化&润色Agent正在修改合规问题...")
    return call_volc_api("editor", user_input)