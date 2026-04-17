"""
小说生成流程编排器
将原 main.py 中的全局流程重构为可复用的类
支持进度回调，可用于 CLI 或 Web API
"""

import json
import yaml
import openai
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

from .config import settings
from .agent_pool import agent_pool
from .agent_pool import (
    PlannerAgent, GuardianAgent, WriterAgent, EditorAgent,
    ComplianceAgent, QualityAgent, CriticAgent, FixAgent
)
from .worldview_manager import WorldviewManager
from utils.file_utils import save_output, load_chapter_content, set_output_dir
from utils.yaml_utils import load_user_requirements
from utils.logger import logger
from utils.vector_db import (
    load_setting_bible_to_db,
    search_related_chapter_content,
    search_core_setting,
    add_chapter_to_db,
    reset_current_db
)
from agents.critic_agent import DIMENSION_NAMES


class WaitingForConfirmationError(Exception):
    """异常：生成完一章需要等待用户人工确认"""
    def __init__(self, chapter_index: int, current_content: str):
        self.chapter_index = chapter_index
        self.current_content = current_content
        super().__init__(f"Waiting for user confirmation for chapter {chapter_index}")


class NovelOrchestrator:
    """
    小说生成流程编排器
    每个项目对应一个Orchestrator实例，保证多项目隔离
    """

    def __init__(
        self,
        project_dir: Optional[str] = None,
        progress_callback: Optional[Callable[[int, str], None]] = None,
        user_api_key: Optional[str] = None,
    ):
        """
        初始化编排器
        :param project_dir: 项目输出根目录，如果为None则从user_requirements读取书名创建
        :param progress_callback: 进度回调 f(percent: int, message: str) -> None
        :param user_api_key: 用户自己的火山引擎 API Key，如果为 None 则使用系统配置
        """
        if project_dir:
            self.output_dir = Path(project_dir)
        else:
            # 延后到run_planner时创建
            self.output_dir = None

        self.progress_callback = progress_callback
        self.project_dir = project_dir

        # 初始化世界观管理器（每个项目独立）
        # 注意：WorldviewManager会根据CURRENT_OUTPUT_DIR确定存储位置
        self.worldview_manager = WorldviewManager()

        # 创建 OpenAI 客户端，使用用户 API Key（如果提供了）
        api_key = user_api_key or settings.get_api_key_for_agent("default")
        if not api_key or not api_key.strip():
            raise ValueError(
                "API Key 为空！请先在前端设置页面输入你的火山引擎 API Key，"
                "或者在 .env 文件中配置 UNIFIED_API_KEY 环境变量。"
            )
        base_url = settings.base_url
        client = openai.OpenAI(api_key=api_key.strip(), base_url=base_url)

        # 为每个项目创建独立的 Agent 实例，使用用户自己的 API Key
        self.planner: PlannerAgent = PlannerAgent(
            client, settings.get_model_for_agent("planner"), settings.get_temperature_for_agent("planner")
        )
        self.guardian: GuardianAgent = GuardianAgent(
            client, settings.get_model_for_agent("guardian"), settings.get_temperature_for_agent("guardian")
        )
        self.writer: WriterAgent = WriterAgent(
            client, settings.get_model_for_agent("writer"), settings.get_temperature_for_agent("writer")
        )
        self.editor: EditorAgent = EditorAgent(
            client, settings.get_model_for_agent("editor"), settings.get_temperature_for_agent("editor")
        )
        self.compliance: ComplianceAgent = ComplianceAgent(
            client, settings.get_model_for_agent("compliance"), settings.get_temperature_for_agent("compliance")
        )
        self.quality: QualityAgent = QualityAgent(
            client, settings.get_model_for_agent("quality"), settings.get_temperature_for_agent("quality")
        )
        self.critic: CriticAgent = CriticAgent(
            client, settings.get_model_for_agent("critic"), settings.get_temperature_for_agent("critic")
        )
        self.fix: FixAgent = FixAgent(
            client, settings.get_model_for_agent("fix"), settings.get_temperature_for_agent("fix")
        )

        # 运行时状态
        self.req: Dict = {}
        self.plan: Optional[str] = None
        self.setting_bible: Optional[str] = None
        self.novel_name: str = "未命名小说"
        self.start_chapter: int = 1
        self.end_chapter: int = 1
        self.chapter_scores: List[Dict] = []
        self.info_path: Optional[Path] = None

    def _report_progress(self, percent: int, message: str):
        """上报进度"""
        logger.info(f"进度 {percent}%: {message}")
        if self.progress_callback:
            try:
                self.progress_callback(percent, message)
            except Exception as e:
                logger.error(f"进度回调执行失败: {e}")

    def recheck_after_optimization(
        self,
        edited: str,
        setting_bible: str,
        chapter_num: Optional[int] = None,
        prev_chapter_end: str = ""
    ) -> str:
        """
        优化后重新校验设定一致性+合规性
        只做必要校验，不做嵌套质量循环，避免LLM调用爆炸
        """
        # 重新校验设定（只校验一次，不通过才修改）
        check_result = self.guardian.check_setting_consistency(setting_bible, edited)
        if "【通过】" not in check_result:
            logger.warning(f"⚠️  优化后设定校验不通过，正在修正")
            edited = self.writer.rewrite_chapter(setting_bible, edited, check_result, chapter_num)

        # 再校验合规（只校验一次，不通过才修改）
        compliance_result = self.compliance.check_compliance(edited)
        if "【通过】" not in compliance_result:
            logger.warning(f"⚠️  优化后合规校验不通过，正在修正")
            edited = self.editor.revise_for_compliance(edited, compliance_result)

        logger.info(f"✓ 优化后基本校验完成")
        return edited

    def run_all_checks(
        self,
        content: str,
        target_word_count_int: int,
        setting_bible: str,
        chapter_num: int,
        prev_chapter_end: str
    ) -> Dict[str, object]:
        """
        并行运行 设定检查 + 质量检查 + 合规检查
        返回检查结果字典
        """
        with ThreadPoolExecutor(max_workers=settings.max_parallel_checks) as executor:
            future_setting = executor.submit(self.guardian.check_setting_consistency, setting_bible, content)
            future_quality = executor.submit(self.quality.check_quality, content, target_word_count_int, setting_bible, chapter_num, prev_chapter_end)
            future_compliance = executor.submit(self.compliance.check_compliance, content)

            setting_result = future_setting.result()
            quality_passed, quality_updated, quality_feedback = future_quality.result()
            compliance_result = future_compliance.result()

        setting_passed = "【通过】" in setting_result
        compliance_passed = "【通过】" in compliance_result

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

    def run_planner(
        self,
        confirmation_handler: Optional[Callable[[str], Tuple[bool, Optional[str]]]] = None
    ) -> str:
        """
        运行策划阶段：加载需求 -> 生成策划方案 -> （可选）人工确认
        :param confirmation_handler: 人工确认处理函数 f(plan_preview) -> (confirmed: bool, feedback: str)
        :return: 最终策划方案
        """
        self._report_progress(5, "正在加载用户需求配置文件...")
        logger.info("正在加载用户需求配置文件...")

        # 优先从项目目录加载user_requirements.yaml（Web创建的项目每个目录有自己的配置）
        # 如果项目目录没有，则回退到根目录的配置文件（兼容CLI旧方式）
        if self.output_dir is not None:
            project_req = self.output_dir / "user_requirements.yaml"
            if project_req.exists():
                # 从项目目录加载
                with open(project_req, "r", encoding="utf-8") as f:
                    self.req = yaml.safe_load(f)
                    logger.info(f"Loaded user requirements from project directory: {project_req}")
            else:
                # 回退到全局加载
                self.req = load_user_requirements()
        else:
            # 回退到全局加载
            self.req = load_user_requirements()
        self.novel_name = self.req.get("novel_name", "未命名小说").strip(' "\'')
        novel_description = self.req.get("novel_description", "").strip(' "\'')
        core_requirement = self.req["core_requirement"].strip(' "\'')
        target_platform = self.req["target_platform"].strip(' "\'')
        self.chapter_word_count = str(self.req["chapter_word_count"])
        self.start_chapter = self.req["start_chapter"]
        self.end_chapter = self.req["end_chapter"]
        self.skip_confirm = self.req.get("skip_plan_confirmation", False)
        self.skip_chapter_confirm = self.req.get("skip_chapter_confirmation", False)
        self.allow_plot_adjustment = self.req.get("allow_plot_adjustment", False)
        self.original_requirement = f"{core_requirement} | {target_platform} | {self.chapter_word_count}字/章"

        # 创建输出文件夹
        if self.output_dir is None:
            self.output_dir = set_output_dir(self.novel_name)
        # 更新全局当前输出目录（兼容现有模块依赖）
        import config
        config.CURRENT_OUTPUT_DIR = self.output_dir

        # 保存信息文件路径
        self.info_path = self.output_dir / "info.json"

        # 重置世界观和向量数据库
        if self.start_chapter == 1:
            self._report_progress(10, "初始化世界观管理器和向量数据库...")
            self.worldview_manager.reset_worldview()
            reset_current_db()

        use_user_plan = self.req.get("use_user_description_as_plan", False)

        if self.start_chapter == 1:
            if use_user_plan and len(novel_description.strip()) > 200:
                # 用户已提供完整大纲，直接使用
                self._report_progress(15, "使用用户提供的完整大纲...")
                logger.info(f"用户已提供完整故事大纲，直接使用用户大纲，跳过AI策划生成")
                self.plan = f"""# 《{self.novel_name}》完整策划方案

{novel_description}

{core_requirement}
"""
                logger.info("使用用户提供的策划方案完成")
            else:
                # 正常流程：AI生成策划方案
                self._report_progress(15, "AI生成顶层策划方案...")
                logger.info(f"开始创作新小说《{self.novel_name}》，生成策划方案...")
                content_type = self.req.get("content_type", "full_novel")
                self.plan = self.planner.generate_plan(
                    core_requirement, target_platform, self.chapter_word_count, content_type
                )
                logger.info("顶层策划方案生成完成")

            # 保存小说基础信息
            with open(self.info_path, "w", encoding="utf-8") as f:
                json.dump({
                    "name": self.novel_name,
                    "description": novel_description,
                    "core_requirement": core_requirement,
                    "created_at": str(datetime.now())
                }, f, ensure_ascii=False, indent=2)

            # 人工确认流程
            if not self.skip_confirm and not use_user_plan:
                if confirmation_handler:
                    # 使用外部确认处理（Web界面会提供）
                    confirmed = False
                    while not confirmed:
                        confirmed, feedback = confirmation_handler(self.plan[:2000])
                        if feedback and feedback.strip():
                            self.plan = self.planner.revise_plan(self.plan, feedback, self.original_requirement)
                else:
                    try:
                        import sys
                        if sys.stdin.isatty():
                            # CLI交互式确认
                            print("\n" + "="*80)
                            print("📝 顶层策划方案预览：")
                            print("="*80)
                            preview = self.plan[:1000] + "..." if len(self.plan) > 1000 else self.plan
                            print(preview)
                            print("="*80)
                            confirm = input("\n请确认顶层策划方案是否通过？（y/n）：\n").lower()
                            while confirm != "y":
                                feedback = input("请输入修改意见：\n")
                                self.plan = self.planner.revise_plan(self.plan, feedback, self.original_requirement)
                                print("\n" + "="*80)
                                print("📝 修改后的方案预览：")
                                print("="*80)
                                preview = self.plan[:1000] + "..." if len(self.plan) > 1000 else self.plan
                                print(preview)
                                print("="*80)
                                confirm = input("\n请确认顶层策划方案是否通过？（y/n）：\n").lower()
                        else:
                            # 非交互式环境，默认通过
                            logger.info("非交互式运行，策划方案自动通过")
                    except (EOFError, IOError):
                        # 非交互式环境，默认通过
                        logger.info("非交互式运行，策划方案自动通过")

        else:
            # 续写：加载已有策划方案和设定圣经
            self._report_progress(15, "加载已有策划方案和设定圣经...")
            plan_path = self.output_dir / "novel_plan.md"
            setting_path = self.output_dir / "setting_bible.md"
            if not plan_path.exists() or not setting_path.exists():
                raise FileNotFoundError(
                    f"续写模式需要已有的{plan_path}和{setting_path}，请确保首次生成已完成"
                )
            with open(plan_path, "r", encoding="utf-8") as f:
                self.plan = f.read().strip()
            with open(setting_path, "r", encoding="utf-8") as f:
                self.setting_bible = f.read().strip()
            logger.info("已有策划方案和设定圣经加载成功")

            # 加载已有章节到向量数据库
            self._report_progress(20, "加载已有章节到向量数据库...")
            logger.info("正在把已有的章节加载到向量数据库...")
            load_setting_bible_to_db()
            for existing_chapter in range(1, self.start_chapter):
                chapter_file = self.output_dir / f"chapter_{existing_chapter}.txt"
                if chapter_file.exists():
                    with open(chapter_file, "r", encoding="utf-8") as f:
                        existing_content = f.read().strip()
                        add_chapter_to_db(existing_chapter, f"第{existing_chapter}章", existing_content)
            logger.info("已有章节加载完成")

        if self.plan is None:
            raise ValueError("策划方案为空，请检查配置")

        return self.plan

    def run_guardian_bible(self) -> str:
        """
        生成设定圣经并加载到向量数据库
        必须在 run_planner 之后调用
        :return: 设定圣经文本
        """
        if self.plan is None:
            raise ValueError("请先运行 run_planner 获取策划方案")

        self._report_progress(20, "保存策划方案，生成设定圣经...")

        # 保存策划方案
        save_output(self.plan, "novel_plan.md", output_dir=self.output_dir)

        # 生成设定圣经
        self.setting_bible = self.guardian.generate_setting_bible(self.plan)
        save_output(self.setting_bible, "setting_bible.md", output_dir=self.output_dir)
        load_setting_bible_to_db()

        logger.info("设定圣经生成完成并加载到向量数据库")
        return self.setting_bible

    def run_chapter_generation(self, chapter_index: int, prev_chapter_end: str = "") -> Tuple[str, float, bool, dict, str]:
        """
        生成单个章节（含检查-修复-评审全流程）
        必须在 run_planner 和 run_guardian_bible 之后调用
        :param chapter_index: 章节号（从1开始）
        :param prev_chapter_end: 上一章结尾内容，用于衔接
        :return: (最终内容, 最终评分, 是否通过评审, 维度分数字典, 问题清单)
        """
        if self.plan is None or self.setting_bible is None:
            raise ValueError("请先运行 run_planner 和 run_guardian_bible")

        logger.info(f"{'='*80}")
        logger.info(f"开始生成《{self.novel_name}》第 {chapter_index} 章")
        logger.info(f"{'='*80}")

        chapter_plot = f"第{chapter_index}章，完整策划方案：{self.plan}"
        # 同时检索相关历史章节和核心设定，控制返回数量节省token
        related_chapters = search_related_chapter_content(chapter_plot, top_k=2, max_chapter_num=chapter_index)
        related_settings = search_core_setting(chapter_plot, top_k=1)
        related_content = related_settings + "\n" + related_chapters

        # 获取世界观生成约束
        constraints = self.worldview_manager.get_generation_constraints(chapter_index)

        # 内容生成
        content_type = self.req.get("content_type", "full_novel")
        target_word_count_int = int(self.chapter_word_count)
        draft = self.writer.generate_chapter(
            self.setting_bible,
            self.plan,
            chapter_index,
            prev_chapter_end,
            related_content,
            constraints,
            target_word_count=target_word_count_int,
            content_type=content_type
        )
        logger.info(f"第 {chapter_index} 章初稿生成完成")

        # ========== 优化：初稿后，设定校验、质量校验、合规预检查并行执行 ==========
        # 汇总所有问题，统一修复Agent一次性修复所有问题
        current_draft = draft
        # 最多重试MAX_FIX_RETRIES轮，给足够机会修复所有问题
        for retry in range(settings.max_fix_retries):
            logger.info(f"第 {chapter_index} 章：并行执行设定/质量/合规校验（第{retry + 1}轮）")
            check_result = self.run_all_checks(
                current_draft, target_word_count_int, self.setting_bible, chapter_index, prev_chapter_end
            )
            current_draft = check_result["current_content"]

            # 全部通过，直接结束
            if check_result["all_passed"]:
                logger.info(f"第 {chapter_index} 章全部校验通过")
                break

            # 汇总所有问题，交给统一修复Agent一次性修复所有问题
            all_problems = []
            if not check_result["setting_passed"]:
                all_problems.append(f"【设定一致性问题】\n{check_result['setting_result']}")
            if not check_result["quality_passed"]:
                all_problems.append(f"【质量格式问题】\n{check_result['quality_feedback']}")
            if not check_result["compliance_passed"]:
                all_problems.append(f"【合规性问题】\n{check_result['compliance_result']}")

            all_problems_text = "\n\n".join(all_problems)
            logger.warning(f"第 {chapter_index} 章发现{len(all_problems)}个问题，统一修复Agent一次性修复（重试 {retry + 1}/{settings.max_fix_retries}）")

            current_draft = self.fix.fix_all_issues(
                current_draft,
                target_word_count_int,
                self.setting_bible,
                all_problems_text,
                chapter_index,
                prev_chapter_end
            )

        # 最终检查
        final_check = self.run_all_checks(
            current_draft, target_word_count_int, self.setting_bible, chapter_index, prev_chapter_end
        )
        current_draft = final_check["current_content"]

        if not final_check["setting_passed"]:
            logger.error(f"第 {chapter_index} 章设定校验重试{settings.max_fix_retries}次仍未通过，跳过该章节")
            return "", 0, False, {}, ""
        if not final_check["compliance_passed"]:
            logger.error(f"第 {chapter_index} 章合规校验重试{settings.max_fix_retries}次仍未通过，跳过该章节")
            return "", 0, False, {}, ""
        if not final_check["quality_passed"]:
            logger.warning(f"第 {chapter_index} 章质量校验未完全达标，但继续下一步")

        draft = current_draft

        # 内容优化润色（editor只负责文笔润色，不碰剧情设定）
        edited = self.editor.edit_chapter(draft)
        logger.info(f"第 {chapter_index} 章内容优化完成")

        # ========== 对抗性评审（Critic Agent挑刺打分，最后一关） ==========
        critic_passed = False
        critic_retry = 0
        score = 0.0
        dimension_scores = {}
        issues = ""
        # 重试策略：所有重试都用quality优化，只改问题不改剧情，稳定可靠
        while not critic_passed and critic_retry < 3:
            critic_passed, issues, score, dimension_scores = self.critic.critic_chapter(
                edited, int(self.chapter_word_count), chapter_index, self.setting_bible
            )
            if critic_passed:
                logger.info(f"第 {chapter_index} 章对抗性评审通过，总分：{score:.1f}/10")
            else:
                logger.warning(f"第 {chapter_index} 章对抗性评审不通过，总分：{score:.1f}/10，正在根据评审意见优化...")
                # 所有重试都用quality优化，只改指出的问题，保持原剧情不变
                edited = self.quality.optimize_quality(
                    edited, int(self.chapter_word_count), self.setting_bible, issues, chapter_index, prev_chapter_end
                )
                # 优化后重新校验设定和合规，确保没引入新问题
                edited = self.recheck_after_optimization(edited, self.setting_bible, chapter_index, prev_chapter_end)
                critic_retry += 1

        if not critic_passed:
            logger.warning(f"第 {chapter_index} 章对抗性评审重试3次仍未通过，但仍保存输出")

        # 章节级人工确认（如果不跳过）
        if not self.skip_chapter_confirm:
            try:
                # 只有在 CLI 交互式环境下才需要人工确认
                import sys
                if sys.stdin.isatty():
                    print("\n" + "="*80)
                    print(f"📖 第{chapter_index}章生成完成，请审阅：")
                    print("="*80)
                    preview = edited[:1000] + "..." if len(edited) > 1000 else edited
                    print(preview)
                    print("="*80)
                    confirm = input("\n请确认是否通过？（y/n）：\n").lower()
                    while confirm != "y":
                        feedback = input("请输入修改意见：\n")
                        # 根据用户意见重新优化
                        edited = self.quality.optimize_quality(
                            edited, int(self.chapter_word_count), self.setting_bible, feedback, chapter_index, prev_chapter_end
                        )
                        # 重新校验
                        edited = self.recheck_after_optimization(edited, self.setting_bible, chapter_index, prev_chapter_end)
                        print("\n" + "="*80)
                        print(f"📖 修改后的第{chapter_index}章预览：")
                        print("="*80)
                        preview = edited[:1000] + "..." if len(edited) > 1000 else edited
                        print(preview)
                        print("="*80)
                        confirm = input("\n请确认是否通过？（y/n）：\n").lower()
            except (EOFError, IOError):
                # 非交互式环境（Celery/Web），需要人工确认
                # 抛出特殊异常让上层处理，任务暂停等待用户反馈
                if not self.skip_chapter_confirm:
                    logger.info(f"非交互式运行，第{chapter_index}章生成完成，等待用户确认...")
                    # 将当前已编辑好的内容先保存下来供前端预览
                    save_output(edited, f"chapter_{chapter_index}.txt", output_dir=self.output_dir)
                    add_chapter_to_db(chapter_index, f"第{chapter_index}章", edited)
                    # 抛异常告诉上层需要等待确认
                    raise WaitingForConfirmationError(chapter_index, edited)
                # 否则自动通过
                logger.info("非交互式运行，自动确认章节通过")

        # 所有质量校验通过后，专门生成一个高质量标题（内容定了，标题才准）
        edited = self.quality.generate_chapter_title(edited, chapter_index)

        # 保存终稿
        save_output(edited, f"chapter_{chapter_index}.txt", output_dir=self.output_dir)
        add_chapter_to_db(chapter_index, f"第{chapter_index}章", edited)

        # 提取本章状态，更新世界观
        chapter_state = self.guardian.extract_chapter_state(edited, chapter_index)
        # 应用状态更新到世界观
        if "timeline" in chapter_state and "new_time" in chapter_state["timeline"] and "new_event" in chapter_state["timeline"]:
            self.worldview_manager.update_timeline(
                chapter_state["timeline"]["new_time"],
                chapter_state["timeline"]["new_event"],
                chapter_index
            )
        if "characters" in chapter_state:
            for char_id, char_info in chapter_state["characters"].items():
                if char_id not in self.worldview_manager.state["characters"]:
                    self.worldview_manager.add_character(char_id, char_info)
                else:
                    self.worldview_manager.update_character(char_id, char_info)
        if "foreshadows" in chapter_state:
            for fs in chapter_state["foreshadows"]:
                self.worldview_manager.add_foreshadow(
                    fs.get("id", f"fs_{chapter_index}_{len(self.worldview_manager.state['foreshadows'])}"),
                    fs.get("content", ""),
                    chapter_index,
                    fs.get("related_characters", [])
                )

        logger.info(f"第 {chapter_index} 章状态已提取，世界观已更新")

        return edited, score, critic_passed, dimension_scores, issues

    def run_full_novel(
        self,
        confirmation_handler: Optional[Callable[[str], Tuple[bool, Optional[str]]]] = None
    ) -> Dict:
        """
        从头到尾生成完整小说（指定章节范围内）
        :param confirmation_handler: 策划方案确认处理
        :return: 生成结果统计
        """
        logger.info("="*80)
        logger.info("🚀 火山引擎Coding Plan Pro多Agent小说创作系统启动")
        logger.info("="*80)

        try:
            # 步骤1：策划阶段
            self.run_planner(confirmation_handler)

            # 步骤2：生成设定圣经（首次生成时）
            if self.start_chapter == 1:
                self.run_guardian_bible()

            # 步骤3：逐章生成
            total_chapters = self.end_chapter - self.start_chapter + 1
            logger.info(f"开始生成《{self.novel_name}》章节 {self.start_chapter}-{self.end_chapter}...")
            prev_chapter_end = ""

            # 续写时加载上一章的结尾
            if self.start_chapter > 1:
                prev_chapter_content = load_chapter_content(self.start_chapter - 1, output_dir=self.output_dir)
                prev_chapter_end = prev_chapter_content[-500:] if len(prev_chapter_content) > 500 else prev_chapter_content

            self.chapter_scores = []
            generated = []

            for chapter_num in range(self.start_chapter, self.end_chapter + 1):
                done_chapters = chapter_num - self.start_chapter
                percent = 20 + int((done_chapters / total_chapters) * 70)
                self._report_progress(percent, f"正在生成第 {chapter_num} 章...")

                # ========== 断点续跑：检查章节是否已生成，跳过已完成 ==========
                chapter_file = self.output_dir / f"chapter_{chapter_num}.txt"
                if chapter_file.exists():
                    # 文件已存在，说明章节已经生成，跳过
                    # 读取已生成内容，更新 prev_chapter_end 用于下一章衔接
                    with open(chapter_file, "r", encoding="utf-8") as f:
                        existing_content = f.read()
                    prev_chapter_end = existing_content[-500:] if len(existing_content) > 500 else existing_content
                    logger.info(f"第{chapter_num}章已生成文件存在，跳过（断点续跑）")
                    # 添加到已生成列表
                    size = chapter_file.stat().st_size
                    words = size // 2
                    generated.append({"num": chapter_num, "words": words})
                    continue

                # 检查是否有用户反馈需要重新优化（Web人机交互模式）
                feedback_file = self.output_dir / f"feedback_{chapter_num}.txt"
                if feedback_file.exists():
                    # 读取用户反馈
                    with open(feedback_file, "r", encoding="utf-8") as f:
                        feedback = f.read().strip()
                    # 读取当前已生成的章节内容
                    existing_content = load_chapter_content(chapter_num, output_dir=self.output_dir)
                    logger.info(f"找到用户对第{chapter_num}章的修改反馈，根据反馈重新优化...")
                    # 根据反馈重新优化
                    edited = self.quality.optimize_quality(
                        existing_content, int(self.chapter_word_count), self.setting_bible, feedback, chapter_num, prev_chapter_end
                    )
                    # 重新校验设定和合规
                    edited = self.recheck_after_optimization(edited, self.setting_bible, chapter_num, prev_chapter_end)
                    # 删除反馈文件
                    feedback_file.unlink()
                    # 后续流程继续
                    score = 0.0
                    critic_passed = True
                    dimension_scores = {}
                    issues = feedback
                else:
                    # 正常生成新章节
                    edited, score, critic_passed, dimension_scores, issues = self.run_chapter_generation(chapter_num, prev_chapter_end)
                    if not edited:
                        continue

                # 记录评分
                self.chapter_scores.append({
                    "chapter": chapter_num,
                    "total_score": float(score),
                    "dimension_scores": dimension_scores,
                    "critic_passed": critic_passed,
                    "issues": issues
                })

                size = (self.output_dir / f"chapter_{chapter_num}.txt").stat().st_size
                words = size // 2
                generated.append({"num": chapter_num, "words": words})

                # 如果允许剧情调整，让用户可以调整下一章剧情节点
                if self.allow_plot_adjustment and chapter_num < self.end_chapter:
                    try:
                        import sys
                        if sys.stdin.isatty():
                            # 只有在 CLI 交互式环境才询问
                            print("\n" + "="*80)
                            print(f"🔧 当前：第{chapter_num}章已完成，是否需要调整下一章（第{chapter_num + 1}章）的剧情？")
                            print("输入y可以输入新的剧情要求，输入n保持原策划不变")
                            print("="*80)
                            adjust = input("\n是否调整下一章剧情？（y/n）：\n").lower()
                            if adjust == "y":
                                new_plot = input(f"请输入第{chapter_num + 1}章新的剧情要求：\n")
                                # 在原策划后面追加用户调整，下一章生成时会用到
                                self.plan = self.plan + f"\n\n【用户人工调整 - 第{chapter_num + 1}章】：{new_plot}"
                                logger.info(f"✅ 已记录你对第{chapter_num + 1}章的剧情调整")
                    except (EOFError, IOError):
                        # 非交互式环境，自动跳过
                        logger.info("非交互式运行，跳过剧情调整")

                # 更新上一章结尾（用于下一章衔接）
                prev_chapter_end = edited[-500:] if len(edited) > 500 else edited

            # 统计并保存质量评分到info.json
            if self.chapter_scores and self.info_path:
                # 读取现有info
                if self.info_path.exists():
                    with open(self.info_path, "r", encoding='utf-8') as f:
                        info = json.load(f)
                else:
                    info = {
                        "name": self.novel_name,
                        "created_at": str(datetime.now())
                    }
                # 添加质量评分信息
                overall_score = sum(cs["total_score"] for cs in self.chapter_scores) / len(self.chapter_scores)
                info["chapter_scores"] = self.chapter_scores
                info["overall_quality_score"] = round(overall_score, 2)
                # 计算各维度平均分
                dimension_avg = {}
                for dim_key in DIMENSION_NAMES:
                    dim_scores = [
                        cs["dimension_scores"].get(dim_key, 0)
                        for cs in self.chapter_scores
                        if cs["dimension_scores"].get(dim_key, 0) > 0
                    ]
                    if dim_scores:
                        dimension_avg[dim_key] = round(sum(dim_scores) / len(dim_scores), 2)
                info["dimension_average_scores"] = dimension_avg
                # 保存回info.json
                with open(self.info_path, "w", encoding="utf-8") as f:
                    json.dump(info, f, ensure_ascii=False, indent=2)
                logger.info(f"📊 总体质量评分: {overall_score:.2f}/10")

            # 输出统计结果
            self._report_progress(100, f"🎉 《{self.novel_name}》创作完成！")
            logger.info("="*80)
            logger.info(f"🎉 《{self.novel_name}》章节 {self.start_chapter}-{self.end_chapter} 生成完成！")
            logger.info(f"📊 本次成功生成：{len(generated)} 章，总字数约 {sum(g['words'] for g in generated):,} 字")
            if generated:
                for g in generated[-3:]:
                    logger.info(f"   ✅ 第{g['num']}章，约 {g['words']} 字")
            logger.info("="*80)

            return {
                "success": True,
                "novel_name": self.novel_name,
                "generated_chapters": len(generated),
                "total_words": sum(g['words'] for g in generated),
                "overall_quality_score": (
                    sum(cs["total_score"] for cs in self.chapter_scores) / len(self.chapter_scores)
                    if self.chapter_scores else 0
                ),
                "output_dir": str(self.output_dir),
            }

        except Exception as e:
            logger.error(f"系统运行出错：{e}", exc_info=True)
            self._report_progress(-1, f"❌ 出错：{str(e)}")
            raise


def main():
    """命令行入口"""
    import sys
    project_dir = sys.argv[1] if len(sys.argv) > 1 else None
    orchestrator = NovelOrchestrator(project_dir)
    result = orchestrator.run_full_novel()
    print("\n" + "="*80)
    print(f"生成完成: {result['novel_name']}")
    print(f"生成章节: {result['generated_chapters']}")
    print(f"总字数: {result['total_words']:,}")
    print(f"总体质量评分: {result['overall_quality_score']:.2f}/10")
    print(f"输出目录: {result['output_dir']}")
    print("="*80)


if __name__ == "__main__":
    main()
