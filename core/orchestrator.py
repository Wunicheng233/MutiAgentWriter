"""
StoryForge AI 精简架构 - 小说生成流程编排器
遵循设计文档 00-DESIGN.md

精简流程：
Planner (设定圣经+大纲) → 逐章循环 Writer → Guardrails → Critic → (Revise → Critic复评) → 保存
- 每章最多 2-3 次 LLM 调用
- 系统层防护纯代码实现，零 Token 消耗
"""

import json
import yaml
import openai
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Callable
from datetime import datetime

from .config import settings
from .agent_pool import (
    PlannerAgent, WriterAgent, CriticAgent, ReviseAgent,
    agent_pool
)
from .system_guardrails import run_system_guardrails, GuardrailResult
from utils.file_utils import save_output, load_chapter_content, set_output_dir
from utils.runtime_context import set_current_output_dir
from utils.yaml_utils import load_user_requirements
from utils.logger import logger
from utils.vector_db import (
    load_setting_bible_to_db,
    search_related_chapter_content,
    search_core_setting,
    add_chapter_to_db,
    reset_current_db
)


class WaitingForConfirmationError(Exception):
    """异常：生成完一章需要等待用户人工确认"""
    def __init__(self, chapter_index: int, current_content: str):
        self.chapter_index = chapter_index
        self.current_content = current_content
        super().__init__(f"Waiting for user confirmation for chapter {chapter_index}")


class NovelOrchestrator:
    """
    小说生成流程编排器（精简架构版）
    每个项目对应一个Orchestrator实例，保证多项目隔离
    """

    MAX_REVISE_LOOPS = 2  # 单章最多 Critic → Revise 循环次数

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
        # 默认字数，防止提前访问导致AttributeError
        self.chapter_word_count = "2000"

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
        self.writer: WriterAgent = WriterAgent(
            client, settings.get_model_for_agent("writer"), settings.get_temperature_for_agent("writer")
        )
        self.critic: CriticAgent = CriticAgent(
            client, settings.get_model_for_agent("critic"), settings.get_temperature_for_agent("critic")
        )
        self.revise: ReviseAgent = ReviseAgent(
            client, settings.get_model_for_agent("revise"), settings.get_temperature_for_agent("revise")
        )

        # 运行时状态
        self.req: Dict = {}
        self.plan: Optional[str] = None
        self.setting_bible: Optional[str] = None
        self.chapter_outlines: List[Dict] = []  # 结构化分章大纲
        self.novel_name: str = "未命名小说"
        self.start_chapter: int = 1
        self.end_chapter: int = 1
        self.chapter_scores: List[Dict] = []
        # 维度评分累积，用于质量分析雷达图
        self.dimension_scores = {
            "plot": [],
            "character": [],
            "hook": [],
            "writing": [],
            "setting": [],
        }
        self.info_path: Optional[Path] = None
        self.content_type: str = "novel"

    def _report_progress(self, percent: int, message: str):
        """上报进度"""
        logger.info(f"进度 {percent}%: {message}")
        if self.progress_callback:
            try:
                self.progress_callback(percent, message)
            except Exception as e:
                logger.error(f"进度回调执行失败: {e}")

    def parse_outlines_from_setting_bible(self) -> List[Dict]:
        """
        从 Planner 输出的设定圣经中解析分章大纲。
        支持两种格式：
        1. 传统格式：每个章节单独一行，以"第X章"开头
        2. 表格格式：Markdown表格，第一列包含"第X章"（Planner默认输出格式）
        最终存储结构化数据可以在 chapter_outlines 数组。

        Returns:
            [
                {
                    "chapter_num": int,
                    "title": str,
                    "outline": str,  # 本章目标、核心冲突、结尾钩子
                }
            ]
        """
        if not self.setting_bible:
            return []

        outlines = []
        lines = self.setting_bible.split('\n')

        import re
        # 匹配行首的 "第X章"（传统格式）
        chapter_pattern = re.compile(r'^(#\s*)?第\s*(\d+)\s*章[:：]?\s*(.*)$')
        # 匹配表格单元格中的 "第X章"（支持 "| 第X章 | ..." 格式）
        table_chapter_pattern = re.compile(r'第\s*(\d+)\s*章')

        current_chapter = None
        current_title = ""
        current_outline_parts = []

        for line in lines:
            line_stripped = line.strip()

            # 优先检查是否是表格行中的章节（Planner默认输出格式）
            # 格式: | 第1章 | 本章目标 | 核心冲突 | 结尾钩子 |
            match_in_table = table_chapter_pattern.search(line)
            if match_in_table:
                chapter_num = int(match_in_table.group(1))
                # 从表格行提取各列
                columns = [col.strip() for col in line.split('|') if col.strip()]
                if len(columns) >= 4:
                    # columns[0] = "第1章", columns[1] = "本章目标", columns[2] = "核心冲突", columns[3] = "结尾钩子"
                    outline_text = f"本章目标：{columns[1]}\n核心冲突：{columns[2]}\n结尾钩子：{columns[3]}"

                    # 保存上一章
                    if current_chapter is not None:
                        outlines.append({
                            "chapter_num": current_chapter,
                            "title": current_title,
                            "outline": '\n'.join(current_outline_parts).strip() if current_outline_parts else outline_text,
                            "target_word_count": int(self.chapter_word_count)
                        })
                    # 开始新一章
                    current_chapter = chapter_num
                    current_title = f"第{chapter_num}章"
                    current_outline_parts = []

            # 再检查是否是传统格式（行首就是第X章）
            match = chapter_pattern.match(line_stripped)
            if match and not match_in_table:  # 避免重复匹配表格行
                # 保存上一章
                if current_chapter is not None and (current_outline_parts or current_title):
                    outlines.append({
                        "chapter_num": current_chapter,
                        "title": current_title,
                        "outline": '\n'.join(current_outline_parts).strip(),
                        "target_word_count": int(self.chapter_word_count)
                        })
                # 开始新一章
                current_chapter = int(match.group(2))
                current_title = match.group(3).strip()
                current_outline_parts = []
            elif current_chapter is not None and line_stripped:
                current_outline_parts.append(line_stripped)

        # 保存最后一章
        if current_chapter is not None:
            outlines.append({
                "chapter_num": current_chapter,
                "title": current_title,
                "outline": '\n'.join(current_outline_parts).strip() if current_outline_parts else f"第{current_chapter}章",
                "target_word_count": int(self.chapter_word_count)
                })

        # 去重并按章节号排序
        outlines = sorted(outlines, key=lambda x: x["chapter_num"])
        # 移除重复章节号（保留第一个）
        seen = set()
        unique_outlines = []
        for o in outlines:
            if o["chapter_num"] not in seen:
                unique_outlines.append(o)
                seen.add(o["chapter_num"])

        # 如果没有解析到结构化大纲，创建一个简单的大纲
        if not unique_outlines and self.plan:
            # 回退：将整个plan作为唯一一章的大纲
            unique_outlines = [{
                "chapter_num": 1,
                "title": "",
                "outline": self.plan,
                "target_word_count": int(self.chapter_word_count)
            }]

        logger.info(f"从设定圣经解析出 {len(unique_outlines)} 个章节大纲")
        return unique_outlines

    def run_planner(
        self,
        confirmation_handler: Optional[Callable[[str], Tuple[bool, Optional[str]]]] = None
    ) -> str:
        """
        运行策划阶段：加载需求 -> Planner生成设定圣经+分章大纲 -> （可选）人工确认
        :param confirmation_handler: 人工确认处理函数 f(plan_preview) -> (confirmed: bool, feedback: str)
        :return: 最终设定圣经
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
        self.chapter_word_count = str(self.req.get("chapter_word_count", 2000))
        self.start_chapter = self.req.get("start_chapter", 1)
        self.end_chapter = self.req.get("end_chapter", 1)
        self.skip_confirm = self.req.get("skip_plan_confirmation", False)
        self.skip_chapter_confirm = self.req.get("skip_chapter_confirmation", False)
        self.allow_plot_adjustment = self.req.get("allow_plot_adjustment", False)
        self.content_type = self.req.get("content_type", "novel")
        self.original_requirement = f"{core_requirement} | {target_platform} | {self.chapter_word_count}字/章"

        # 创建输出文件夹
        if self.output_dir is None:
            self.output_dir = set_output_dir(self.novel_name)
        # 更新全局当前输出目录（兼容现有模块依赖）
        set_current_output_dir(self.output_dir)

        # 保存信息文件路径
        self.info_path = self.output_dir / "info.json"

        # 重置向量数据库
        if self.start_chapter == 1:
            self._report_progress(10, "初始化向量数据库...")
            reset_current_db()

        use_user_plan = self.req.get("use_user_description_as_plan", False)

        if self.start_chapter == 1:
            if use_user_plan and len(novel_description.strip()) > 200:
                # 用户已提供完整大纲，直接使用
                self._report_progress(15, "使用用户提供的完整大纲...")
                logger.info(f"用户已提供完整故事大纲，直接使用用户大纲")
                self.plan = novel_description
                # 生成设定圣经
                self.setting_bible = self.plan
                logger.info("使用用户提供的策划方案完成")
            else:
                # 正常流程：Planner生成设定圣经和分章大纲
                self._report_progress(15, "Planner正在生成设定圣经和分章大纲...")
                logger.info(f"开始创作新小说《{self.novel_name}》，Planner生成方案...")

                # 如果项目目录已存在设定圣经，读取它
                setting_bible_path = self.output_dir / "setting_bible.md"
                plan_file = self.output_dir / "novel_plan.md"
                if setting_bible_path.exists() and plan_file.exists():
                    with open(setting_bible_path, "r", encoding="utf-8") as f:
                        world_bible = f.read().strip()
                    with open(plan_file, "r", encoding="utf-8") as f:
                        plan_content = f.read().strip()
                    self.plan = plan_content
                    self.setting_bible = world_bible
                    logger.info(f"✅ 已加载项目中已存在的设定圣经和策划方案")

                    # 检查是否有策划方案的用户反馈（来自上一次确认不通过）
                    feedback_plan_path = self.output_dir / "feedback_plan.txt"
                    if feedback_plan_path.exists():
                        with open(feedback_plan_path, "r", encoding="utf-8") as f:
                            feedback = f.read().strip()
                        if feedback:
                            logger.info(f"找到策划方案用户反馈，根据反馈重新优化...")
                            self.plan = self.planner.revise_plan(self.plan, feedback, self.original_requirement)
                            self.setting_bible = self.plan
                            # 删除反馈文件，避免下次重复使用
                            feedback_plan_path.unlink()
                            logger.info("已根据用户反馈重新优化策划方案")
                else:
                    world_bible = ""

                    # 从req读取其他参数
                    genre = self.req.get("genre", "")
                    total_words = self.req.get("total_words", "")
                    core_hook = self.req.get("core_hook", "")

                    self.plan = self.planner.generate_plan(
                        core_requirement, target_platform, self.chapter_word_count, self.content_type,
                        world_bible=world_bible, genre=genre, total_words=str(total_words), core_hook=core_hook
                    )
                    # 在精简架构中，Planner直接输出完整的设定圣经+分章大纲
                    self.setting_bible = self.plan
                    logger.info("Planner方案生成完成")

            # 保存小说基础信息
            with open(self.info_path, "w", encoding="utf-8") as f:
                json.dump({
                    "name": self.novel_name,
                    "description": novel_description,
                    "core_requirement": core_requirement,
                    "created_at": str(datetime.now()),
                    "architecture": "slim-v2"  # 标记精简架构
                }, f, ensure_ascii=False, indent=2)

            # 人工确认流程
            # 只有当这是首次生成（策划文件不存在）或者刚刚修改了策划（有反馈待确认）才需要等待确认
            # 如果策划文件已经存在，说明已经确认过了，直接继续
            plan_file = self.output_dir / "novel_plan.md"
            setting_file = self.output_dir / "setting_bible.md"
            need_confirmation = not (plan_file.exists() and setting_file.exists())

            if not self.skip_confirm and not use_user_plan and need_confirmation:
                if confirmation_handler:
                    # 使用外部确认处理（Web界面会提供）
                    confirmed = False
                    while not confirmed:
                        confirmed, feedback = confirmation_handler(self.plan[:2000])
                        if feedback and feedback.strip():
                            self.plan = self.planner.revise_plan(self.plan, feedback, self.original_requirement)
                            self.setting_bible = self.plan
                else:
                    import sys
                    if sys.stdin.isatty():
                        # CLI交互式确认
                        print("\n" + "="*80)
                        print("📝 Planner输出预览（设定圣经+大纲）：")
                        print("="*80)
                        preview = self.plan[:1000] + ("..." if len(self.plan) > 1000 else "")
                        print(preview)
                        print("="*80)
                        confirm = input("\n请确认方案是否通过？（y/n）：\n").lower()
                        while confirm != "y":
                            feedback = input("请输入修改意见：\n")
                            self.plan = self.planner.revise_plan(self.plan, feedback, self.original_requirement)
                            self.setting_bible = self.plan
                            print("\n" + "="*80)
                            print("📝 修改后的方案预览：")
                            print("="*80)
                            preview = self.plan[:1000] + ("..." if len(self.plan) > 1000 else "")
                            print(preview)
                            print("="*80)
                            confirm = input("\n请确认方案是否通过？（y/n）：\n").lower()
                    else:
                        # 非交互式环境（Web/Celery），需要等待用户确认
                        # 先保存当前方案，然后抛出异常让上层处理
                        logger.info("非交互式运行，策划方案已生成，等待用户确认...")
                        with open(self.output_dir / "novel_plan.md", "w", encoding="utf-8") as f:
                            f.write(self.plan)
                        with open(self.output_dir / "setting_bible.md", "w", encoding="utf-8") as f:
                            f.write(self.setting_bible)
                        raise WaitingForConfirmationError(0, self.plan[:2000])

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
                chapter_file = self.output_dir / f"chapters/chapter_{existing_chapter}.txt"
                if chapter_file.exists():
                    with open(chapter_file, "r", encoding="utf-8") as f:
                        existing_content = f.read().strip()
                    add_chapter_to_db(existing_chapter, f"第{existing_chapter}章", existing_content)
            logger.info("已有章节加载完成")

        if self.setting_bible is None:
            raise ValueError("设定圣经为空，请检查配置")

        # 保存设定圣经到文件
        save_output(self.setting_bible, "setting_bible.md", output_dir=self.output_dir)
        save_output(self.plan, "novel_plan.md", output_dir=self.output_dir)

        # 解析分章大纲
        self.chapter_outlines = self.parse_outlines_from_setting_bible()

        # 如果用户指定了end_chapter但解析出更多章节，以用户指定为准
        if self.end_chapter > len(self.chapter_outlines):
            logger.warning(f"用户指定结束章节{self.end_chapter}，但大纲只解析出{len(self.chapter_outlines)}章，将生成到{len(self.chapter_outlines)}章")
            self.end_chapter = len(self.chapter_outlines)

        logger.info("Planner阶段完成，设定圣经已保存")
        return self.setting_bible

    def get_chapter_outline(self, chapter_num: int) -> str:
        """获取指定章节的大纲文本。"""
        for outline in self.chapter_outlines:
            if outline["chapter_num"] == chapter_num:
                return outline["outline"]
        # 如果没找到，返回整个plan作为大纲
        return self.plan or ""

    def get_target_word_count(self, chapter_num: int) -> int:
        """获取指定章节的目标字数。"""
        for outline in self.chapter_outlines:
            if outline["chapter_num"] == chapter_num:
                return outline.get("target_word_count", int(self.chapter_word_count))
        return int(self.chapter_word_count)

    def run_chapter_generation(self, chapter_index: int, prev_chapter_end: str = "") -> Tuple[str, int, bool, List[Dict]]:
        """
        生成单个章节，遵循精简架构流程：
        Writer → System Guardrails → Critic → (Revise → Critic复评) × N

        最多循环 2 次 Revise → Critic。

        Args:
            chapter_index: 章节号（从1开始）
            prev_chapter_end: 上一章结尾内容，用于衔接

        Returns:
            (最终内容, 最终分数, 是否通过评审, 问题列表)
        """
        if self.plan is None or self.setting_bible is None:
            raise ValueError("请先运行 run_planner 获取策划方案和设定圣经")

        logger.info(f"{'='*80}")
        logger.info(f"开始生成《{self.novel_name}》第 {chapter_index} 章")
        logger.info(f"{'='*80}")

        # 检索相关历史章节和核心设定，控制返回数量节省token
        chapter_plot = self.get_chapter_outline(chapter_index)
        related_chapters = search_related_chapter_content(chapter_plot, top_k=2, max_chapter_num=chapter_index)
        related_settings = search_core_setting(chapter_plot, top_k=1)
        related_content = related_settings + "\n" + related_chapters

        # 获取本章目标字数
        target_word_count = self.get_target_word_count(chapter_index)

        # Step 1: Writer 生成章节初稿
        content_type = self.req.get("content_type", "novel")
        draft = self.writer.generate_chapter(
            self.setting_bible,
            chapter_plot,
            chapter_index,
            prev_chapter_end,
            related_content,
            None,  # 精简架构不需要世界观约束由Critic检查
            target_word_count=target_word_count,
            content_type=content_type
        )
        logger.info(f"第 {chapter_index} 章初稿生成完成")

        # Step 2: 系统层防护（纯代码，零Token消耗）
        logger.info(f"运行系统层防护检查...")
        # 提取主角姓名（从设定圣经中简单提取，找不到就留空）
        protagonist_name = ""
        import re
        match = re.search(r'主角[:：]\s*([^\n]+)', self.setting_bible)
        if match:
            protagonist_name = match.group(1).strip()
        if not protagonist_name:
            match = re.search(r'主角姓名[:：]\s*([^\n]+)', self.setting_bible)
            if match:
                protagonist_name = match.group(1).strip()

        guardrail_context = {
            'expected_chapter_num': chapter_index,
            'previous_chapter_num': chapter_index - 1,
            'target_word_count': target_word_count,
            'protagonist_name': protagonist_name,
        }

        guardrail_result: GuardrailResult = run_system_guardrails(draft, guardrail_context)
        current_content = guardrail_result.corrected_content

        # 记录警告日志
        if guardrail_result.warnings:
            for warn in guardrail_result.warnings:
                logger.warning(f"系统防护: {warn}")
        if guardrail_result.suggestions:
            for sugg in guardrail_result.suggestions:
                logger.info(f"系统防护建议: {sugg}")

        logger.info(f"系统层防护完成，通过: {guardrail_result.passed}")

        # Step 3: Critic 评审
        chapter_outline = self.get_chapter_outline(chapter_index)
        passed, score, dimensions, issues = self.critic.critic_chapter(
            current_content,
            self.setting_bible,
            chapter_outline,
            content_type,
        )

        # 保存本章维度评分
        if not hasattr(self, 'dimension_scores'):
            self.dimension_scores = {
                "plot": [],
                "character": [],
                "hook": [],
                "writing": [],
                "setting": [],
            }
        for dim, score_val in dimensions.items():
            if dim in self.dimension_scores:
                self.dimension_scores[dim].append(score_val)

        # 将系统防护发现的问题添加到issues列表，让Revise一起修复
        # 这样系统防护检查出来的问题不会只停留在日志，会真正被修复
        word_count = guardrail_result.metrics.get('word_count', 0)
        target_wc = guardrail_context['target_word_count']
        if word_count > 0:
            deviation = abs(word_count - target_wc) / target_wc
            # 如果字数偏离超过30%，强制加入修订清单
            if deviation > 0.30:
                if word_count < target_wc:
                    issues.append({
                        "type": "字数不足",
                        "location": "全文",
                        "fix": f"本章实际只有 {word_count} 字，目标要求 {target_wc} 字，请大幅扩展细节：增加场景描写、人物动作表情、心理活动、环境氛围描写，把字数增加到目标要求。"
                    })
                    passed = False
                    logger.warning(f"字数不足偏差超过30%，加入修订清单")
                else:
                    issues.append({
                        "type": "字数超标",
                        "location": "全文",
                        "fix": f"本章实际 {word_count} 字，目标要求 {target_wc} 字，请适当精简内容，压缩到目标字数范围内。"
                    })
                    passed = False
                    logger.warning(f"字数超标偏差超过30%，加入修订清单")

        # 添加其他系统防护发现的问题到修订清单
        if "G-05" in guardrail_result.violations:
            issues.append({
                "type": "格式问题",
                "location": "全文",
                "fix": "存在段落过长，请拆分长段落为短段落，每段1-3句话，符合手机阅读要求。"
            })
            passed = False

        if "G-09" in guardrail_result.violations:
            cliches = guardrail_result.violations["G-09"]
            issues.append({
                "type": "文风问题",
                "location": "全文",
                "fix": f"检测到以下AI套话：{cliches}，请删除这些套话，改用更自然的表达方式。"
            })
            passed = False

        # 主角未出场也要加入修订
        has_protagonist_issue = any(sugg for sugg in guardrail_result.suggestions if "主角" in sugg and "未出场" in sugg)
        if has_protagonist_issue:
            issues.append({
                "type": "剧情问题",
                "location": "本章",
                "fix": "主角在本章没有出场，请确保主角出场参与剧情，符合大纲要求。"
            })
            passed = False

        # 结尾缺少钩子也要加入修订
        has_hook_issue = any(sugg for sugg in guardrail_result.suggestions if "结尾缺少" in sugg)
        if has_hook_issue:
            issues.append({
                "type": "结构问题",
                "location": "本章结尾",
                "fix": "本章结尾缺少吸引人的悬念钩子，请修改结尾，让结尾落在冲突点或悬念上，引发读者好奇心。"
            })
            passed = False

        revise_count = 0
        max_revise_loops = self.MAX_REVISE_LOOPS

        # 如果不通过，进入 Revise → Critic 循环
        while not passed and revise_count < max_revise_loops:
            logger.warning(
                f"第 {chapter_index} 章Critic评审不通过，问题数 {len(issues)}，"
                f"正在修订 (第{revise_count + 1}/{max_revise_loops})..."
            )

            # Step 4: Revise 根据问题清单修订
            current_content = self.revise.revise_chapter(
                current_content,
                issues,
                self.setting_bible
            )
            revise_count += 1

            # 再次运行系统层防护（修订后可能格式有变化
            guardrail_result = run_system_guardrails(current_content, guardrail_context)
            current_content = guardrail_result.corrected_content

            # 再次检查字数偏差，如果还是超标，加入问题清单
            word_count = guardrail_result.metrics.get('word_count', 0)
            target_wc = guardrail_context['target_word_count']
            if word_count > 0:
                deviation = abs(word_count - target_wc) / target_wc
                if deviation > 0.30:
                    if word_count < target_wc:
                        issues.append({
                            "type": "字数不足",
                            "location": "全文",
                            "fix": f"本章修订后实际只有 {word_count} 字，目标要求 {target_wc} 字，请大幅扩展细节：增加场景描写、人物动作表情、心理活动、环境氛围描写，把字数增加到目标要求。",
                        })
                        passed = False
                        logger.warning(f"字数不足偏差超过30%，加入修订清单");
                    else:
                        issues.append({
                            "type": "字数超标",
                            "location": "全文",
                            "fix": f"本章修订后实际 {word_count} 字，目标要求 {target_wc} 字，请适当精简内容，压缩到目标字数范围内。",
                        })
                        passed = False
                        logger.warning(f"字数超标偏差超过30%，加入修订清单");

            # 添加其他系统防护发现的问题到修订清单
            if "G-05" in guardrail_result.violations:
                issues.append({
                    "type": "格式问题",
                    "location": "全文",
                    "fix": "存在段落过长，请拆分长段落为短段落，每段1-3句话，符合手机阅读要求。",
                })
                passed = False

            if "G-09" in guardrail_result.violations:
                cliches = guardrail_result.violations["G-09"]
                issues.append({
                    "type": "文风问题",
                    "location": "全文",
                    "fix": f"检测到以下AI套话：{cliches}，请删除这些套话，改用更自然的表达方式。",
                })
                passed = False

            # 主角未出场也要加入修订
            has_protagonist_issue = any(sugg for sugg in guardrail_result.suggestions if "主角" in sugg and "未出场" in sugg)
            if has_protagonist_issue:
                issues.append({
                    "type": "剧情问题",
                    "location": "本章",
                    "fix": "主角在本章没有出场，请确保主角出场参与剧情，符合大纲要求。",
                })
                passed = False

            # 结尾缺少钩子也要加入修订
            has_hook_issue = any(sugg for sugg in guardrail_result.suggestions if "结尾缺少" in sugg)
            if has_hook_issue:
                issues.append({
                    "type": "结构问题",
                    "location": "本章结尾",
                    "fix": "本章结尾缺少吸引人的悬念钩子，请修改结尾，让结尾落在冲突点或悬念上，引发读者好奇心。",
                })
                passed = False

            # Step 5: Critic 复评
            passed, score, dimensions, issues = self.critic.critic_chapter(
                current_content,
                self.setting_bible,
                chapter_outline,
                content_type,
            )
            # 更新维度评分
            for dim, score_val in dimensions.items():
                if dim in self.dimension_scores:
                    self.dimension_scores[dim].append(score_val)

        if not passed:
            logger.warning(
                f"第 {chapter_index} 章经过 {max_revise_loops} 次修订循环仍未通过评审，"
                f"但仍保存输出，分数 {score}/10"
            )
        else:
            logger.info(
                f"第 {chapter_index} 章评审通过，分数 {score}/10，"
                f"修订次数 {revise_count}"
            )

        # 章节级人工确认（如果不跳过）
        if not self.skip_chapter_confirm:
            import sys
            if sys.stdin.isatty():
                # CLI交互式确认
                print("\n" + "="*80)
                print(f"📖 第{chapter_index}章生成完成，请审阅：")
                print("="*80)
                preview = current_content[:1000] + ("..." if len(current_content) > 1000 else "")
                print(preview)
                print("="*80)
                confirm = input("\n请确认是否通过？（y/n）：\n").lower()
                while confirm != "y":
                    feedback = input("请输入修改意见：\n")
                    # 根据用户意见重新修订
                    # 将用户反馈转为issues格式
                    user_issue = [{
                        "type": "用户反馈",
                        "location": "全文",
                        "fix": feedback
                    }]
                    current_content = self.revise.revise_chapter(
                        current_content,
                        user_issue,
                        self.setting_bible
                    )
                    # 再次评审
                    passed, score, dimensions, issues = self.critic.critic_chapter(
                        current_content,
                        self.setting_bible,
                        chapter_outline,
                        content_type,
                    )
                    # 更新维度评分
                    for dim, score_val in dimensions.items():
                        if dim in self.dimension_scores:
                            self.dimension_scores[dim].append(score_val)
                    print("\n" + "="*80)
                    print(f"📖 修改后的第{chapter_index}章预览：")
                    print("="*80)
                    preview = current_content[:1000] + ("..." if len(current_content) > 1000 else "")
                    print(preview)
                    print("="*80)
                    confirm = input("\n请确认是否通过？（y/n）：\n").lower()
            else:
                # 非交互式环境（Celery/Web），需要人工确认
                # 抛出特殊异常让上层处理，任务暂停等待用户反馈
                logger.info(f"非交互式运行，第{chapter_index}章生成完成，等待用户确认...")
                # 将当前已编辑好的内容先保存下来供前端预览
                self.save_chapter(chapter_index, current_content)
                add_chapter_to_db(chapter_index, f"第{chapter_index}章", current_content)
                # 抛异常告诉上层需要等待确认
                raise WaitingForConfirmationError(chapter_index, current_content)

        # 保存终稿到 chapters 子目录
        self.save_chapter(chapter_index, current_content)

        # 添加到向量数据库，用于下文检索
        add_chapter_to_db(chapter_index, f"第{chapter_index}章", current_content)

        logger.info(f"第 {chapter_index} 章生成完成，已保存")

        return current_content, score, passed, issues

    def save_chapter(self, chapter_index: int, content: str):
        """保存章节到 chapters 子目录。"""
        chapters_dir = self.output_dir / "chapters"
        chapters_dir.mkdir(exist_ok=True)
        chapter_file = chapters_dir / f"chapter_{chapter_index}.txt"
        with open(chapter_file, "w", encoding="utf-8") as f:
            f.write(content)

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
        logger.info("🚀 StoryForge AI 精简架构 多Agent小说创作系统启动")
        logger.info("="*80)

        try:
            # 步骤1：策划阶段 - Planner生成设定圣经和大纲
            self.run_planner(confirmation_handler)

            # 步骤2：逐章生成
            if len(self.chapter_outlines) == 0:
                # 如果没有解析出大纲，使用用户指定的start到end范围
                if self.end_chapter >= self.start_chapter:
                    for i in range(self.start_chapter, self.end_chapter + 1):
                        self.chapter_outlines.append({
                            "chapter_num": i,
                            "title": f"第{i}章",
                            "outline": self.plan,
                            "target_word_count": int(self.chapter_word_count)
                        })

            total_chapters = [o for o in self.chapter_outlines
                               if o["chapter_num"] >= self.start_chapter and o["chapter_num"] <= self.end_chapter]
            total_chapters_count = len(total_chapters)
            logger.info(f"开始生成《{self.novel_name}》章节 {self.start_chapter}-{self.end_chapter}...")
            prev_chapter_end = ""

            # 续写时加载上一章的结尾
            if self.start_chapter > 1:
                prev_chapter = self.start_chapter - 1
                prev_content = load_chapter_content(prev_chapter, output_dir=self.output_dir / "chapters")
                prev_chapter_end = prev_content[-500:] if len(prev_content) > 500 else prev_content

            self.chapter_scores = []
            generated = []

            for outline in self.chapter_outlines:
                chapter_num = outline["chapter_num"]
                if chapter_num < self.start_chapter or chapter_num > self.end_chapter:
                    continue

                done_chapters = chapter_num - self.start_chapter
                percent = 20 + int((done_chapters / total_chapters_count) * 70)
                self._report_progress(percent, f"正在生成第 {chapter_num} 章...")

                chapter_file = self.output_dir / "chapters" / f"chapter_{chapter_num}.txt"
                feedback_file = self.output_dir / f"feedback_{chapter_num}.txt"
                if feedback_file.exists():
                    # 读取用户反馈
                    with open(feedback_file, "r", encoding="utf-8") as f:
                        feedback = f.read().strip()
                    # 读取当前已生成的章节内容
                    existing_content = load_chapter_content(chapter_num, output_dir=self.output_dir / "chapters")
                    logger.info(f"找到用户对第{chapter_num}章的修改反馈，根据反馈重新优化...")
                    # 根据反馈转为issues格式
                    issues = [{
                        "type": "用户反馈",
                        "location": "全文",
                        "fix": feedback
                    }]
                    # 修订
                    current_content = self.revise.revise_chapter(
                        existing_content,
                        issues,
                        self.setting_bible
                    )
                    # 重新运行防护检查和评审
                    guardrail_context = {
                        'expected_chapter_num': chapter_num,
                        'previous_chapter_num': chapter_num - 1,
                        'target_word_count': outline["target_word_count"],
                    }
                    guardrail_result = run_system_guardrails(current_content, guardrail_context)
                    current_content = guardrail_result.corrected_content
                    passed, score, dimensions, issues = self.critic.critic_chapter(
                        current_content,
                        self.setting_bible,
                        outline["outline"],
                        self.content_type,
                    )
                    # 更新维度评分
                    for dim, score_val in dimensions.items():
                        if dim in self.dimension_scores:
                            self.dimension_scores[dim].append(score_val)
                    # 将修订后的内容写回统一章节目录，确保后续续写与前端读取一致
                    self.save_chapter(chapter_num, current_content)
                    # 删除反馈文件
                    feedback_file.unlink()
                    # 后续流程继续
                # ========== 断点续跑：没有待处理反馈时，跳过已完成章节 ==========
                elif chapter_file.exists():
                    # 文件已存在，说明章节已经生成，跳过
                    # 读取已生成内容，更新 prev_chapter_end 用于下一章衔接
                    with open(chapter_file, "r", encoding="utf-8") as f:
                        existing_content = f.read()
                    prev_chapter_end = existing_content[-500:] if len(existing_content) > 500 else existing_content
                    logger.info(f"第{chapter_num}章已生成文件存在，跳过（断点续跑）")
                    # 统计真实汉字数量（只统计中文字符，不含标点空格）
                    import re
                    chinese_chars = re.findall(r'[\u4e00-\u9fff]', existing_content)
                    words = len(chinese_chars)
                    generated.append({"num": chapter_num, "words": words})
                    continue
                else:
                    # 正常生成新章节
                    # 即使生成失败或合规检查不通过，也不轻易跳过，保留已有内容供用户检查
                    try:
                        current_content, score, passed, issues = self.run_chapter_generation(chapter_num, prev_chapter_end)
                    except Exception as e:
                        logger.error(f"第 {chapter_num} 章生成过程发生异常: {e}，尝试保存已有内容继续")
                        # 如果生成失败但已有部分内容，仍然继续处理
                        if 'current_content' not in locals():
                            # 完全失败，创建一个占位章节说明错误
                            current_content = f"第{chapter_num}章\n\n生成失败: {str(e)}\n请尝试重新生成此章节"
                            score = 0
                            passed = False
                            issues = [{"type": "生成错误", "location": "全文", "fix": str(e)}]

                    # 即使内容为空，也创建一个占位符，不直接跳过
                    # 用户要求：即使没通过检验也要保存章节，不要轻易跳过
                    if not current_content:
                        logger.warning(f"第 {chapter_num} 章生成结果为空，但仍保存占位章节不跳过（风控误判概率较高）")
                        current_content = f"第{chapter_num}章\n\n生成结果为空，可能触发了风控拦截。请尝试重新生成此章节"
                        score = 0
                        passed = False
                        issues = [{"type": "合规拦截", "location": "全文", "fix": "生成结果为空，可能触发了内容安全风控"}]

                # 记录评分
                self.chapter_scores.append({
                    "chapter": chapter_num,
                    "score": score,
                    "passed": passed,
                    "issues": issues
                })

                chapter_file = self.output_dir / "chapters" / f"chapter_{chapter_num}.txt"
                with open(chapter_file, "r", encoding="utf-8") as f:
                    content = f.read()
                # 统计真实汉字数量（只统计中文字符，不含标点空格）
                import re
                chinese_chars = re.findall(r'[\u4e00-\u9fff]', content)
                words = len(chinese_chars)
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
                                self.setting_bible = self.plan
                                logger.info(f"✅ 已记录你对第{chapter_num + 1}章的剧情调整")
                    except (EOFError, IOError):
                        # 非交互式环境，自动跳过
                        logger.info("非交互式运行，跳过剧情调整")
                # 更新上一章结尾（用于下一章衔接）
                prev_chapter_end = current_content[-500:] if len(current_content) > 500 else current_content

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
                if self.chapter_scores:
                    overall_score = sum(cs["score"] for cs in self.chapter_scores) / len(self.chapter_scores)
                else:
                    overall_score = 0
                # 计算各维度平均分
                dimension_averages = {}
                if hasattr(self, 'dimension_scores'):
                    for dim, scores in self.dimension_scores.items():
                        if scores:
                            dimension_averages[dim] = round(sum(scores) / len(scores), 2)
                info["chapter_scores"] = self.chapter_scores
                info["overall_quality_score"] = round(overall_score, 2)
                info["dimension_average_scores"] = dimension_averages
                info["architecture"] = "slim-v2"
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
                    sum(cs["score"] for cs in self.chapter_scores) / len(self.chapter_scores)
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
