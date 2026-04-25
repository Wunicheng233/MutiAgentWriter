import re
import openai
from utils.volc_engine import call_volc_api
from utils.logger import logger
from utils.vector_db import search_reference_style, search_related_chapter_content, search_core_setting
from config import WRITER_MAX_TOKENS


def _check_and_fix_title(result: str, chapter_num: int) -> str:
    """
    检查生成结果是否有正确的章节标题，如果没有则自动添加默认标题
    内部工具函数，不对外导出
    """
    lines = result.split('\n', 1)
    first_line = lines[0].strip() if lines else ""
    # 去除Markdown标题符号 # 再检查
    clean_first_line = first_line.lstrip('#').strip()

    # 提取章节号，检查是不是正确的
    match = re.search(r'第\s*(\d+)\s*章', clean_first_line)
    if match:
        found_num = int(match.group(1))
        if found_num == chapter_num:
            # 章节号正确，直接返回
            return result
        else:
            # 章节号错了，需要修正
            logger.warning(f"第{chapter_num}章标题章节号错了（写成了{found_num}），自动修正...")
            # 替换章节号
            if clean_first_line.startswith(f"第{found_num}章"):
                new_first_line = clean_first_line.replace(f"第{found_num}章", f"第{chapter_num}章", 1)
                result = result.replace(first_line, new_first_line)
                return result

    # 没有正确标题，自动添加默认标题
    logger.warning(f"第{chapter_num}章没有正确标题，自动添加默认标题")
    return f"第{chapter_num}章\n\n{result}"


def generate_chapter(
    setting_bible: str,
    plan: str,
    chapter_num: int,
    prev_chapter_end: str = "",
    related_content: str = "",
    constraints: dict = None,
    target_word_count: int = 2000,
    content_type: str = "full_novel",
    client: openai.OpenAI = None,
    perspective: str = None,
    perspective_strength: float = 0.7,
    project_config: dict = None,
) -> str:
    constraints_text = ""
    if constraints:
        forbidden_text = constraints.get('forbidden', '')
        constraints_text = f"""
=== 全局世界观强制约束（必须严格遵守）===
当前章节：第{constraints.get('current_chapter', '?')}章
当前故事推进时间：{constraints.get('current_time', '未知')}
已发生事件：{constraints.get('already_happened_events', '无')}
角色信息：{constraints.get('characters_info', '无')}
世界观规则：{constraints.get('world_rules', '无')}
未回收伏笔：{constraints.get('unfinished_foreshadows', '无')}
{forbidden_text}
"""

    # 检索文风参考范例（从用户提供的优秀参考文中找相似风格）
    style_ref = search_reference_style(plan, top_k=2)

    user_input = f"""
=========================================
【最最重要的第一条规则】：本章开头**第一行**必须先输出 `第X章 章节标题`，例如：`第3章 清剿队破门而入`，**绝对不能忘记**！没有标题直接不合格！
=========================================

设定圣经：{setting_bible}
{constraints_text}
相关历史内容：{related_content}
{style_ref}
本章剧情节点：请从以下策划方案里提取第{chapter_num}章的核心剧情节点并生成正文：{plan}
上一章结尾内容：{prev_chapter_end if prev_chapter_end else "（第1章无，留空）"}

重要强制要求：
1. 【已经说了一万遍还是要再说】本章开头第一行必须先输出 `第X章 章节标题`，缺了标题不合格，章节号必须正确
2. 【**最关键连贯性要求**】本章开头必须直接顺畅承接上面给的「上一章结尾内容」，故事从**上一章停的地方**直接开始，不能凭空跳转到新场景，必须让读者感觉是连贯读下来的，中间没有断片。这一条非常非常重要！
3. 【**字数硬要求，非常重要，绝对不能违反**】本章字数**必须严格控制在 {target_word_count} 字左右**，误差不能超过200字。**这是硬要求，必须达到！** 如果大纲描述简洁（通常表格格式大纲都是一句话简述），请你**必须主动大幅铺展细节**：场景环境描写要充分展开，人物外貌表情动作要细致刻画，内心心理活动要充分展现，氛围情绪要渲染到位。绝对不能因为大纲简洁就只干巴巴写完剧情骨架，你必须把一句话大纲扩展成 full-text 小说。仅仅写完大纲列出的情节节点是远远不够的，必须填充足够的细节才能达到字数要求！
4. 【必须】如果故事涉及现实历史时间点，必须严格符合对应年代的科技发展水平，禁止超前概念出现在错误的时间点
5. 【必须】严格遵守上面的全局世界观强制约束，人设、时间线、设定不能有任何矛盾
6. 【必须】完整输出本章全部内容，不能只写一半就截断
7. 【必须】使用短段落排版，每段1-3句话，对话单独成段，关键点可以单独分段，适配手机阅读
8. 【节奏要求，非常重要】：本章必须推进主线剧情，不能原地拖节奏。平均三章就要一个小高潮，本章结尾必须留下一个足够吸引人的悬念钩子，让读者忍不住想看下一章。禁止一章只讲一件小事还没推进主线就平淡结束。
9. 【钩子要求】：本章结尾必须落在冲突点、转折处、悬念上，让读者产生"接下来会发生什么"的强烈好奇心。不能平淡收尾。
10. 【文风要求】：请参考上面给的优秀文风范例，学习它们的文笔节奏、表达方式，写出同样质感的文字，减少AI模板化刻板感，去掉烂大街的网文套话。
"""

    logger.info(f"启动内容生成Agent，生成第{chapter_num}章")

    # 构建占位符替换上下文
    context = {
        "world_bible": setting_bible,
        "chapter_outline": plan,
        "previous_summary": prev_chapter_end,
        "content_type": content_type,
        "target_word_count": str(target_word_count),
    }

    # 第一次生成（client为None时call_volc_api内部会处理）
    result = call_volc_api("writer", user_input, max_tokens=WRITER_MAX_TOKENS, content_type=content_type, context=context, client=client, perspective=perspective, perspective_strength=perspective_strength, project_config=project_config)
    fixed_result = _check_and_fix_title(result, chapter_num)

    if fixed_result != result:
        # 第一次没标题，重试一次
        logger.warning(f"第{chapter_num}章生成忘记写标题，自动重试...")
        result = call_volc_api(
            "writer",
            user_input,
            max_tokens=WRITER_MAX_TOKENS,
            content_type=content_type,
            context=context,
            client=client,
            perspective=perspective,
            perspective_strength=perspective_strength,
            project_config=project_config,
        )
        fixed_result = _check_and_fix_title(result, chapter_num)

    return fixed_result


def rewrite_chapter(
    setting_bible: str,
    original_draft: str,
    feedback: str,
    chapter_num: int = None,
    client: openai.OpenAI = None,
    perspective: str = None,
    perspective_strength: float = 0.7,
    project_config: dict = None,
) -> str:
    # 从原文提取章节号（如果没传入）
    if chapter_num is None:
        lines = original_draft.split('\n', 1)
        first_line = lines[0].strip() if lines else ""
        match = re.search(r'第(\d+)章', first_line)
        if match:
            chapter_num = int(match.group(1))

    # 检索相关历史章节和核心设定，保证修改不偏离前文
    max_chapter = chapter_num if chapter_num else 9999
    related_chapters = search_related_chapter_content(original_draft, top_k=2, max_chapter_num=max_chapter)
    related_settings = search_core_setting(original_draft, top_k=2)
    related_content = related_settings + "\n" + related_chapters

    # 也加上文风参考
    style_ref = search_reference_style(original_draft, top_k=1)

    user_input = f"""
=========================================
【最最重要的规则】：修改后的章节开头第一行必须还是 `第X章 章节标题`，绝对不能忘记！
=========================================

【设定圣经（必须严格遵守）】：
{setting_bible}

{style_ref}
【相关历史内容参考（保证剧情连贯）】：
{related_content}

原初稿：{original_draft}
修改意见：{feedback}

请根据修改意见重新生成整个章节，必须：
1. 开头保留章节标题，章节号必须正确
2. 使用短段落排版，每段1-3句话，对话单独成段，适配手机阅读
3. 解决修改意见指出的设定问题
4. 保持人物设定、剧情走向与前文保持一致，不能出现矛盾
5. 参考优秀文风范例，学习好的文笔表达方式，减少AI模板化刻板感
"""

    logger.info("✍️  内容生成Agent正在修改章节...")
    result = call_volc_api("writer", user_input, client=client, perspective=perspective, perspective_strength=perspective_strength, project_config=project_config)

    # 检测并修复标题
    if chapter_num:
        result = _check_and_fix_title(result, chapter_num)

    return result
