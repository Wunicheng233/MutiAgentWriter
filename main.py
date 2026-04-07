from concurrent.futures import ThreadPoolExecutor, as_completed
from agents import (
    generate_plan, revise_plan,
    generate_setting_bible, check_setting_consistency, extract_chapter_state,
    generate_chapter, rewrite_chapter,
    edit_chapter, revise_for_compliance,
    check_compliance,
    check_quality, optimize_quality, generate_chapter_title,
    critic_chapter,
    fix_all_issues
)
from utils.file_utils import save_output, load_chapter_content, set_output_dir
from utils.yaml_utils import load_user_requirements
from utils.logger import logger
from utils.vector_db import load_setting_bible_to_db, search_related_chapter_content, search_core_setting, add_chapter_to_db, reset_current_db
from core.worldview_manager import worldview_manager
from config import (
    ROOT_DIR, OUTPUTS_ROOT,
    MAX_FIX_RETRIES,
    MAX_PARALLEL_CHECKS
)
import config
from datetime import datetime


from typing import Dict, List, Optional, Tuple
def recheck_after_optimization(edited: str, setting_bible: str, chapter_num: Optional[int] = None, prev_chapter_end: str = "") -> str:
    """
    优化后重新校验设定一致性+合规性
    只做必要校验，不做嵌套质量循环，避免LLM调用爆炸
    （质量校验已经在外层处理了）
    """
    # 重新校验设定（只校验一次，不通过才修改）
    check_result = check_setting_consistency(setting_bible, edited)
    if "【通过】" not in check_result:
        logger.warning(f"⚠️  优化后设定校验不通过，正在修正")
        edited = rewrite_chapter(setting_bible, edited, check_result, chapter_num)

    # 再校验合规（只校验一次，不通过才修改）
    compliance_result = check_compliance(edited)
    if "【通过】" not in compliance_result:
        logger.warning(f"⚠️  优化后合规校验不通过，正在修正")
        edited = revise_for_compliance(edited, compliance_result)

    logger.info(f"✓ 优化后基本校验完成")
    return edited


def run_all_checks(
    content: str,
    target_word_count_int: int,
    setting_bible: str,
    chapter_num: int,
    prev_chapter_end: str
) -> Dict[str, object]:
    """
    【并行运行】设定检查 + 质量检查 + 合规检查
    返回检查结果字典
    抽离成独立函数，避免在循环内重复定义
    """
    with ThreadPoolExecutor(max_workers=3) as executor:
        future_setting = executor.submit(check_setting_consistency, setting_bible, content)
        future_quality = executor.submit(check_quality, content, target_word_count_int, setting_bible, chapter_num, prev_chapter_end)
        future_compliance = executor.submit(check_compliance, content)

        setting_result = future_setting.result()
        quality_passed, quality_updated, quality_feedback = future_quality.result()
        compliance_result = future_compliance.result()

    setting_passed = "【通过】" in setting_result
    compliance_passed = "【通过】" in compliance_result

    # check_quality 永远返回原content，quality_updated == content 恒成立
    # 这里保留兼容原接口，实际不会修改content

    return {
        "all_passed": setting_passed and quality_passed and compliance_passed,
        "setting_passed": setting_passed,
        "quality_passed": quality_passed,
        "compliance_passed": compliance_passed,
        "setting_result": setting_result,
        "quality_feedback": quality_feedback,
        "compliance_result": compliance_result,
        "current_content": content,
    }


def main():
    logger.info("="*80)
    logger.info("🚀 火山引擎Coding Plan Pro多Agent小说创作系统启动")
    logger.info("="*80)

    try:
        # ---------------------- 步骤1：加载用户需求 ----------------------
        logger.info("正在加载用户需求配置文件...")
        req = load_user_requirements()
        novel_name = req.get("novel_name", "未命名小说").strip(' "\'')  # 去除首尾引号和多余空白
        novel_description = req.get("novel_description", "").strip(' "\'')
        core_requirement = req["core_requirement"].strip(' "\'')
        target_platform = req["target_platform"].strip(' "\'')
        chapter_word_count = str(req["chapter_word_count"])
        start_chapter = req["start_chapter"]
        end_chapter = req["end_chapter"]
        skip_confirm = req.get("skip_plan_confirmation", False)
        skip_chapter_confirm = req.get("skip_chapter_confirmation", False)  # 是否跳过章节级人工确认
        allow_plot_adjustment = req.get("allow_plot_adjustment", False)  # 是否允许人工调整后续剧情节点
        original_requirement = f"{core_requirement} | {target_platform} | {chapter_word_count}字/章"

        # 创建输出文件夹：outputs/{书名}/
        output_dir = set_output_dir(novel_name)
        config.CURRENT_OUTPUT_DIR = output_dir

        # 自动检测已有章节，如果start_chapter=0则自动续写
        existing_chapters = []
        for f in output_dir.glob("chapter_*.txt"):
            match = f.name.split("_")[1].split(".")[0]
            if match.isdigit():
                existing_chapters.append(int(match))
        if start_chapter == 0 and existing_chapters:
            start_chapter = max(existing_chapters) + 1
            logger.info(f"🔍 《{novel_name}》自动检测到已有{len(existing_chapters)}章，从第{start_chapter}章开始续写")

        # 校验章节范围
        if start_chapter < 1 or end_chapter < start_chapter:
            raise ValueError(
                f"章节范围配置错误：start_chapter={start_chapter}, end_chapter={end_chapter}\n"
                f"提示：设置start_chapter: 0可以自动从下一章节续写"
            )

        # ---------------------- 步骤2：处理策划方案和设定圣经 ----------------------
        plan = None
        setting_bible = None
        plan_path = output_dir / "novel_plan.md"
        setting_path = output_dir / "setting_bible.md"
        info_path = output_dir / "info.json"

        # 检测是否用户要求直接使用描述作为策划方案（用户已经写好完整大纲，跳过AI策划）
        use_user_plan = req.get("use_user_description_as_plan", False)

        if start_chapter == 1:
            # 首次生成：生成新的策划方案和设定圣经
            # 重置世界观和向量数据库，用于新建小说（每本小说完全隔离）
            worldview_manager.reset_worldview()
            reset_current_db()

            if use_user_plan and len(novel_description.strip()) > 200:
                # 用户已经写好完整大纲，直接使用，跳过AI策划
                logger.info(f"用户已提供完整故事大纲，直接使用用户大纲，跳过AI策划生成")
                plan = f"""# 《{novel_name}》完整策划方案

{novel_description}

{core_requirement}
"""
                logger.info("使用用户提供的策划方案完成")
            else:
                # 正常流程：AI生成策划方案
                logger.info(f"开始创作新小说《{novel_name}》，生成策划方案...")
                plan = generate_plan(core_requirement, target_platform, chapter_word_count)
                logger.info("顶层策划方案生成完成")

            # 保存小说基础信息（书名、简介）
            import json
            with open(info_path, "w", encoding="utf-8") as f:
                json.dump({
                    "name": novel_name,
                    "description": novel_description,
                    "core_requirement": core_requirement,
                    "created_at": str(datetime.now())
                }, f, ensure_ascii=False, indent=2)

            # 人工确认（可跳过）
            if not skip_confirm and not use_user_plan:
                print("\n" + "="*80)
                print("📝 顶层策划方案预览：")
                print("="*80)
                print(plan[:1000] + "..." if len(plan) > 1000 else plan)
                print("="*80)

                confirm = input("\n请确认顶层策划方案是否通过？（y/n）：\n").lower()
                while confirm != "y":
                    feedback = input("请输入修改意见：\n")
                    plan = revise_plan(plan, feedback, original_requirement)
                    print("\n" + "="*80)
                    print("📝 修改后的方案预览：")
                    print("="*80)
                    print(plan[:1000] + "..." if len(plan) > 1000 else plan)
                    print("="*80)
                    confirm = input("\n请确认顶层策划方案是否通过？（y/n）：\n").lower()

            # 保存策划方案
            save_output(plan, "novel_plan.md")

            # 生成设定圣经
            setting_bible = generate_setting_bible(plan)
            save_output(setting_bible, "setting_bible.md")
            load_setting_bible_to_db()
        else:
            # 续写：加载已有的策划方案和设定圣经
            logger.info(f"续写《{novel_name}》（start_chapter={start_chapter}），加载已有策划方案和设定圣经...")
            if not plan_path.exists() or not setting_path.exists():
                raise FileNotFoundError(
                    f"续写模式需要已有的{plan_path}和{setting_path}，请确保首次生成已完成"
                )

            with open(plan_path, "r", encoding="utf-8") as f:
                plan = f.read().strip()
            with open(setting_path, "r", encoding="utf-8") as f:
                setting_bible = f.read().strip()
            logger.info("已有策划方案和设定圣经加载成功")

            logger.info("正在把已有的章节加载到向量数据库...")
            load_setting_bible_to_db()  # 先把设定圣经存进去
            for existing_chapter in range(1, start_chapter):
                chapter_file = output_dir / f"chapter_{existing_chapter}.txt"
                if chapter_file.exists():
                    with open(chapter_file, "r", encoding="utf-8") as f:
                        existing_content = f.read().strip()
                        add_chapter_to_db(existing_chapter, f"第{existing_chapter}章", existing_content)
            logger.info("已有章节加载完成")

        # ---------------------- 步骤3：生成/续写字章 ----------------------
        logger.info(f"开始生成《{novel_name}》章节 {start_chapter}-{end_chapter}...")
        prev_chapter_end = ""

        # 续写时加载上一章的结尾
        if start_chapter > 1:
            prev_chapter_content = load_chapter_content(start_chapter - 1)
            prev_chapter_end = prev_chapter_content[-500:] if len(prev_chapter_content) > 500 else prev_chapter_content

        for chapter_num in range(start_chapter, end_chapter + 1):
            logger.info(f"{'='*80}")
            logger.info(f"开始生成《{novel_name}》第 {chapter_num} 章")
            logger.info(f"{'='*80}")

            chapter_plot = f"第{chapter_num}章，完整策划方案：{plan}"
            # 同时检索相关历史章节和核心设定，控制返回数量节省token
            related_chapters = search_related_chapter_content(chapter_plot, top_k=2, max_chapter_num=chapter_num)
            related_settings = search_core_setting(chapter_plot, top_k=1)
            related_content = related_settings + "\n" + related_chapters

            # 获取世界观生成约束
            constraints = worldview_manager.get_generation_constraints(chapter_num)

            # 内容生成
            draft = generate_chapter(
                setting_bible,
                plan,
                chapter_num,
                prev_chapter_end,
                related_content,
                constraints,
                target_word_count=int(chapter_word_count)
            )
            logger.info(f"第 {chapter_num} 章初稿生成完成")

            # ========== 优化：初稿后，设定校验、质量校验、合规预检查并行执行 ==========
            # 1. 并行运行三个检查，一次性收集所有问题（省时间）
            # 2. 汇总所有问题，统一修复Agent一次性修复所有问题
            # 3. 修改完成后重新并行检查，最多重试MAX_FIX_RETRIES轮
            target_word_count_int = int(chapter_word_count)
            current_draft = draft

            # 最多重试MAX_FIX_RETRIES轮，给足够机会修复所有问题
            for retry in range(MAX_FIX_RETRIES):
                logger.info(f"第 {chapter_num} 章：并行执行设定/质量/合规校验（第{retry + 1}轮）")
                check_result = run_all_checks(current_draft, target_word_count_int, setting_bible, chapter_num, prev_chapter_end)
                current_draft = check_result["current_content"]

                # 全部通过，直接结束
                if check_result["all_passed"]:
                    logger.info(f"第 {chapter_num} 章全部校验通过")
                    break

                # 汇总所有问题，交给统一修复Agent一次性修复所有问题
                # 架构更简洁，只调用一次LLM，比多次逐个修改更高效
                all_problems = []
                if not check_result["setting_passed"]:
                    all_problems.append(f"【设定一致性问题】\n{check_result['setting_result']}")
                if not check_result["quality_passed"]:
                    all_problems.append(f"【质量格式问题】\n{check_result['quality_feedback']}")
                if not check_result["compliance_passed"]:
                    all_problems.append(f"【合规性问题】\n{check_result['compliance_result']}")

                all_problems_text = "\n\n".join(all_problems)
                logger.warning(f"第 {chapter_num} 章发现{len(all_problems)}个问题，统一修复Agent一次性修复（重试 {retry + 1}/{MAX_FIX_RETRIES}）")
                logger.debug(f"全部问题：\n{all_problems_text}")

                current_draft = fix_all_issues(
                    current_draft,
                    target_word_count_int,
                    setting_bible,
                    all_problems_text,
                    chapter_num,
                    prev_chapter_end
                )

            # 最终检查
            final_check = run_all_checks(current_draft, target_word_count_int, setting_bible, chapter_num, prev_chapter_end)
            current_draft = final_check["current_content"]

            if not final_check["setting_passed"]:
                logger.error(f"第 {chapter_num} 章设定校验重试{MAX_FIX_RETRIES}次仍未通过，跳过该章节")
                continue
            if not final_check["compliance_passed"]:
                logger.error(f"第 {chapter_num} 章合规校验重试{MAX_FIX_RETRIES}次仍未通过，跳过该章节")
                continue
            if not final_check["quality_passed"]:
                logger.warning(f"第 {chapter_num} 章质量校验未完全达标，但继续下一步")

            draft = current_draft

            # 内容优化润色（editor只负责文笔润色，不碰剧情设定）
            edited = edit_chapter(draft)
            logger.info(f"第 {chapter_num} 章内容优化完成")

            # ========== 优化：去掉editor后的重复合规检查 ==========
            # 合规检查已经在初稿后并行检查过了，editor只润色文笔几乎不会引入合规问题
            # 就算真有问题，Critic终审也会发现，节省一次LLM调用

            # 对抗性评审（Critic Agent挑刺打分，最后一关）
            critic_passed = False
            critic_retry = 0
            # 重试策略：所有重试都用quality优化，只改问题不改剧情，稳定可靠
            while not critic_passed and critic_retry < 3:
                critic_passed, issues, score = critic_chapter(edited, int(chapter_word_count), chapter_num, setting_bible)
                if critic_passed:
                    logger.info(f"第 {chapter_num} 章对抗性评审通过，得分：{score}/10")
                else:
                    logger.warning(f"第 {chapter_num} 章对抗性评审不通过，得分：{score}/10，正在根据评审意见优化...")
                    logger.debug(f"评审意见：{issues}")
                    # 所有重试都用quality优化，只改指出的问题，保持原剧情不变
                    edited = optimize_quality(edited, int(chapter_word_count), setting_bible, issues, chapter_num, prev_chapter_end)
                    # 优化后重新校验设定和合规，确保没引入新问题
                    edited = recheck_after_optimization(edited, setting_bible, chapter_num, prev_chapter_end)
                    critic_retry += 1

            if not critic_passed:
                logger.warning(f"第 {chapter_num} 章对抗性评审重试3次仍未通过，但仍保存输出")

            # 章节级人工确认（如果不跳过）
            if not skip_chapter_confirm:
                print("\n" + "="*80)
                print(f"📖 第{chapter_num}章生成完成，请审阅：")
                print("="*80)
                print(edited[:1000] + "..." if len(edited) > 1000 else edited)
                print("="*80)
                confirm = input("\n请确认是否通过？（y/n）：\n").lower()
                while confirm != "y":
                    feedback = input("请输入修改意见：\n")
                    # 根据用户意见重新优化
                    edited = optimize_quality(edited, int(chapter_word_count), setting_bible, feedback, chapter_num, prev_chapter_end)
                    # 重新校验
                    edited = recheck_after_optimization(edited, setting_bible, chapter_num, prev_chapter_end)
                    print("\n" + "="*80)
                    print(f"📖 修改后的第{chapter_num}章预览：")
                    print("="*80)
                    print(edited[:1000] + "..." if len(edited) > 1000 else edited)
                    print("="*80)
                    confirm = input("\n请确认是否通过？（y/n）：\n").lower()

            # 所有质量校验通过后，专门生成一个高质量标题（内容定了，标题才准）
            edited = generate_chapter_title(edited, chapter_num)
            # 保存终稿
            save_output(edited, f"chapter_{chapter_num}.txt")
            add_chapter_to_db(chapter_num, f"第{chapter_num}章", edited)

            # 更新世界观状态（提取本章时间、事件、新角色、伏笔）
            chapter_state = extract_chapter_state(edited, chapter_num)
            logger.info(f"第 {chapter_num} 章状态已提取，世界观已更新")

            # 如果允许剧情调整，让用户可以调整下一章剧情节点
            if allow_plot_adjustment and chapter_num < end_chapter:
                print("\n" + "="*80)
                print(f"🔧 当前：第{chapter_num}章已完成，是否需要调整下一章（第{chapter_num + 1}章）的剧情？")
                print("输入y可以输入新的剧情要求，输入n保持原策划不变")
                print("="*80)
                adjust = input("\n是否调整下一章剧情？（y/n）：\n").lower()
                if adjust == "y":
                    new_plot = input(f"请输入第{chapter_num + 1}章新的剧情要求：\n")
                    # 在原策划后面追加用户调整，下一章生成时会用到
                    plan = plan + f"\n\n【用户人工调整 - 第{chapter_num + 1}章】：{new_plot}"
                    logger.info(f"✅ 已记录你对第{chapter_num + 1}章的剧情调整")

            # 更新上一章结尾（用于下一章衔接）
            prev_chapter_end = edited[-500:] if len(edited) > 500 else edited

        # ---------------------- 完成 ----------------------
        # 统计生成结果
        generated = []
        for chapter_num in range(start_chapter, end_chapter + 1):
            chapter_file = output_dir / f"chapter_{chapter_num}.txt"
            if chapter_file.exists():
                size = chapter_file.stat().st_size
                words = size // 2  # 粗略估算汉字个数
                generated.append({"num": chapter_num, "words": words})

        logger.info("="*80)
        logger.info(f"🎉 《{novel_name}》章节 {start_chapter}-{end_chapter} 生成完成！")
        logger.info(f"📊 本次成功生成：{len(generated)} 章，总字数约 {sum(g['words'] for g in generated):,} 字")
        if generated:
            for g in generated[-3:]:
                logger.info(f"   ✅ 第{g['num']}章，约 {g['words']} 字")
        logger.info("="*80)

        # 自动导出静态网站并推送（如果配置开启）
        auto_export = req.get("auto_export_static", False)
        if auto_export and len(generated) > 0:
            logger.info("🔄 开始自动导出静态网站...")
            try:
                from export_static import export_static
                export_static()
                logger.info("✅ 静态网站导出完成")

                # 自动git推送
                from utils.git_utils import auto_commit_push_static_site
                commit_msg = f"Update {novel_name} chapters {start_chapter}-{end_chapter}"
                push_success = auto_commit_push_static_site(commit_msg)
                if push_success:
                    logger.info("✅ 已自动推送到GitHub，GitHub Pages会自动更新")
                else:
                    logger.warning("⚠️  Git推送失败，请手动推送")
            except Exception as e:
                logger.error(f"❌ 自动导出/推送失败: {e}", exc_info=True)

    except Exception as e:
        logger.error(f"系统运行出错：{e}", exc_info=True)
        raise


if __name__ == "__main__":
    main()
