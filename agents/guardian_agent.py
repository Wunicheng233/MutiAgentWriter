import openai
from utils.volc_engine import call_volc_api
from utils.logger import logger
from core.worldview_manager import worldview_manager
import json

def generate_setting_bible(plan: str, client: openai.OpenAI = None) -> str:
    logger.info("🛡️  人设&世界观守矩Agent正在生成设定圣经...")
    return call_volc_api("guardian", plan, client=client)

def check_setting_consistency(setting_bible: str, draft: str, client: openai.OpenAI = None) -> str:
    # 先通过向量检索找出本章涉及的相关设定，只给Guardian检查相关内容
    from utils.vector_db import search_core_setting
    related_settings = search_core_setting(draft, top_k=3)
    user_input = f"""
完整设定圣经：
{setting_bible[:2000]}...

本章内容涉及的相关设定：
{related_settings}

章节初稿：{draft}

请检查本章内容是否和设定一致，特别是人设、时间线、科技水平。
"""
    logger.info("🛡️  人设&世界观守矩Agent正在检查设定一致性...")
    return call_volc_api("guardian", user_input, temperature=0.1, client=client)

def extract_chapter_state(content: str, chapter_num: int, client: openai.OpenAI = None) -> dict:
    """提取本章的状态信息，更新到世界观中枢"""
    prompt = f"""请从以下章节内容中提取关键信息，以JSON格式输出：
{{
  "current_time": "本章结束时故事所处的时间点（例如：2015年6月），如果没有明确时间就留空",
  "main_events": ["本章发生的主要事件列表，每条1-2句话"],
  "new_characters": [
    {{
      "name": "新角色姓名",
      "description": "角色简介"
    }}
  ],
  "new_foreshadows": ["本章新增的伏笔列表，如果没有就留空数组"]
}}

只输出合法JSON，不要其他内容。

章节内容：{content[:2000]}
"""
    result = call_volc_api("guardian", prompt, temperature=0.1, client=client)
    try:
        # 清理结果，只保留JSON部分
        result = result.strip()
        if result.startswith("```json"):
            result = result[7:-3]
        elif result.startswith("```"):
            result = result[3:-3]
        state = json.loads(result.strip())

        # 更新世界观中枢
        if state.get("current_time"):
            for event in state.get("main_events", []):
                worldview_manager.update_timeline(state["current_time"], event, chapter_num)

        # 添加新角色
        for char in state.get("new_characters", []):
            if char.get("name"):
                worldview_manager.add_character(char["name"], char)

        # 添加新伏笔
        for i, foreshadow in enumerate(state.get("new_foreshadows", [])):
            fid = f"f_{chapter_num}_{i}"
            worldview_manager.add_foreshadow(fid, foreshadow, chapter_num)

        logger.info(f"✅ 第{chapter_num}章状态提取完成，世界观已更新")
        return state
    except Exception as e:
        logger.warning(f"⚠️  第{chapter_num}章状态提取失败：{e}，不影响后续生成")
        return {}