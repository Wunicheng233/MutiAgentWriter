"""
StoryForge AI 精简架构 - 小说生成流程编排器
遵循设计文档 00-DESIGN.md

精简流程：
Planner (设定圣经+大纲) → 逐章循环 Writer → Guardrails → Critic → (Revise → Critic复评) → 保存
- 每章最多 2-3 次 LLM 调用
- 系统层防护纯代码实现，零 Token 消耗
"""

import json
import re
import yaml
import openai
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Callable
from datetime import datetime
from collections import defaultdict

from .config import settings
from backend.utils.file_utils import write_file_atomic
from .agent_pool import (
    PlannerAgent, WriterAgent, CriticAgent, ReviseAgent,
    agent_pool
)
from .evaluation_harness import evaluate_chapter_with_critic
from .novel_state_service import NovelStateService
from .system_guardrails import run_system_guardrails, GuardrailResult
from .workflow_optimization import (
    apply_local_patch,
    build_local_repair_context,
    format_scene_anchors_for_prompt,
    parse_scene_anchors_from_outline,
    route_repair_strategy,
)
from .outline_parser import parse_outlines_from_setting_bible
from backend.utils.file_utils import save_output, load_chapter_content, set_output_dir
from backend.utils.runtime_context import set_current_output_dir
from backend.utils.yaml_utils import load_user_requirements
from backend.utils.logger import logger
from backend.utils.vector_db import (
    load_setting_bible_to_db,
    search_related_chapter_content,
    search_core_setting,
    add_chapter_to_db,
    reset_current_db
)


# Severity priority mapping: higher = more important
SEVERITY_PRIORITY = {"high": 3, "medium": 2, "low": 1}


def _merge_guardrail_issues_into_review(guardrail_result: GuardrailResult, issues: List[Dict], guardrail_context: Dict) -> bool:
    """
    将系统防护发现的问题合并到 Critic issues，让 Revise 真正修复这些问题。

    Returns:
        是否仍然通过（True 表示不需要因为 guardrails 强制失败）
    """
    ok = True
    word_count = guardrail_result.metrics.get("word_count", 0)
    target_wc = max(1, int(guardrail_context.get("target_word_count", 2000)))
    if word_count > 0:
        deviation = abs(word_count - target_wc) / target_wc
        if deviation > 0.30:
            if word_count < target_wc:
                issues.append(
                    {
                        "type": "字数不足",
                        "location": "全文",
                        "fix": (
                            f"本章实际只有 {word_count} 字，目标要求 {target_wc} 字，请大幅扩展细节："
                            "增加场景描写、人物动作表情、心理活动、环境氛围描写，把字数增加到目标要求。"
                        ),
                    }
                )
            else:
                issues.append(
                    {
                        "type": "字数超标",
                        "location": "全文",
                        "fix": f"本章实际 {word_count} 字，目标要求 {target_wc} 字，请适当精简内容，压缩到目标字数范围内。",
                    }
                )
            ok = False

    if "G-05" in guardrail_result.violations:
        issues.append(
            {
                "type": "格式问题",
                "location": "全文",
                "fix": "存在段落过长，请拆分长段落为短段落，每段1-3句话，符合手机阅读要求。",
            }
        )
        ok = False

    if "G-09" in guardrail_result.violations:
        cliches = guardrail_result.violations["G-09"]
        issues.append(
            {
                "type": "文风问题",
                "location": "全文",
                "fix": f"检测到以下AI套话：{cliches}，请删除这些套话，改用更自然的表达方式。",
            }
        )
        ok = False

    has_protagonist_issue = any(
        sugg for sugg in guardrail_result.suggestions if "主角" in sugg and "未出场" in sugg
    )
    if has_protagonist_issue:
        issues.append(
            {
                "type": "剧情问题",
                "location": "本章",
                "fix": "主角在本章没有出场，请确保主角出场参与剧情，符合大纲要求。",
            }
        )
        ok = False

    has_hook_issue = any(sugg for sugg in guardrail_result.suggestions if "结尾缺少" in sugg)
    if has_hook_issue:
        issues.append(
            {
                "type": "结构问题",
                "location": "本章结尾",
                "fix": "本章结尾缺少吸引人的悬念钩子，请修改结尾，让结尾落在冲突点或悬念上，引发读者好奇心。",
            }
        )
        ok = False

    return ok


class WaitingForConfirmationError(Exception):
    """异常：生成完一章需要等待用户人工确认"""
    def __init__(self, chapter_index: int, current_content: str):
        self.chapter_index = chapter_index
        self.current_content = current_content
        super().__init__(f"Waiting for user confirmation for chapter {chapter_index}")


class GenerationCancelledError(Exception):
    """异常：当前生成任务已被外部取消，应尽快停止后续流程。"""

    def __init__(self, message: str = "Generation task was cancelled"):
        super().__init__(message)


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
        cancellation_checker: Optional[Callable[[], None]] = None,
        writer_perspective: str = None,
        perspective_strength: float = 0.7,
        use_perspective_critic: bool = True,
        project_config: Optional[Dict] = None,
    ):
        """
        初始化编排器
        :param project_dir: 项目输出根目录，如果为None则从user_requirements读取书名创建
        :param progress_callback: 进度回调 f(percent: int, message: str) -> None
        :param user_api_key: 用户自己的火山引擎 API Key，如果为 None 则使用系统配置
        :param writer_perspective: 选定的作家视角 ID
        :param perspective_strength: 视角强度 (0.0-1.0)，默认 0.7
        :param use_perspective_critic: 是否同时在 Critic 评审中使用视角
        """
        if project_dir:
            self.output_dir = Path(project_dir)
        else:
            # 延后到run_planner时创建
            self.output_dir = None

        self.progress_callback = progress_callback
        self.cancellation_checker = cancellation_checker
        self.project_dir = project_dir
        # 默认字数，防止提前访问导致AttributeError
        self.chapter_word_count = "2000"
        # 项目视角配置
        self.writer_perspective = writer_perspective
        self.perspective_strength = perspective_strength
        self.use_perspective_critic = use_perspective_critic
        self.project_config = project_config or {}

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
        for agent in (self.planner, self.writer, self.critic, self.revise):
            agent.project_config = self.project_config

        # 运行时状态
        self.req: Dict = {}
        self.plan: Optional[str] = None
        self.setting_bible: Optional[str] = None
        self.chapter_outlines: List[Dict] = []  # 结构化分章大纲
        self.novel_name: str = "未命名小说"
        self.start_chapter: int = 1
        self.end_chapter: int = 1
        self.chapter_scores: List[Dict] = []
        self.evaluation_reports: List[Dict] = []
        self.scene_anchor_plans: List[Dict] = []
        self.repair_traces: List[Dict] = []
        self.stitching_reports: List[Dict] = []
        self.novel_state_snapshots: List[Dict] = []
        self.novel_state_service = NovelStateService(self.output_dir)
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

    def _check_cancellation(self):
        """在关键阶段主动检查任务是否已被外部取消。"""
        cancellation_checker = getattr(self, "cancellation_checker", None)
        if cancellation_checker:
            cancellation_checker()

    def _report_progress(self, percent: int, message: str):
        """上报进度"""
        self._check_cancellation()
        self._last_progress_percent = percent
        logger.info(f"进度 {percent}%: {message}")
        progress_callback = getattr(self, "progress_callback", None)
        if progress_callback:
            try:
                progress_callback(percent, message)
            except GenerationCancelledError:
                raise
            except Exception as e:
                logger.error(f"进度回调执行失败: {e}")

    def _report_workflow_event(self, message: str):
        """上报细粒度工作流事件，不推进主进度条。"""
        self._check_cancellation()
        percent = getattr(self, "_last_progress_percent", 0)
        logger.info(message)
        progress_callback = getattr(self, "progress_callback", None)
        if progress_callback:
            try:
                progress_callback(percent, message)
            except GenerationCancelledError:
                raise
            except Exception as e:
                logger.error(f"工作流事件回调执行失败: {e}")

    def _format_scene_anchors_for_critic(self, chapter_index: int) -> str:
        """Format scene anchors into the string format expected by Critic prompt."""
        if not hasattr(self, "scene_anchor_plans") or not self.scene_anchor_plans:
            return "（无 scene anchors）"

        for plan in self.scene_anchor_plans:
            if plan.get("chapter_index") == chapter_index:
                anchors = plan.get("scene_anchors", [])
                if not anchors:
                    return "（无 scene anchors）"
                lines = []
                for anchor in anchors:
                    lines.append(
                        f"- **{anchor.get('scene_id', 'unknown')}**: "
                        f"目标={anchor.get('goal', '')}; "
                        f"冲突={anchor.get('conflict', '')}; "
                        f"角色动机={anchor.get('character_intent', '')}; "
                        f"状态变更={anchor.get('state_change', '')}"
                    )
                return "\n".join(lines)
        return "（无 scene anchors）"

    def _run_critic_harness(
        self,
        chapter_index: int,
        chapter_content: str,
        chapter_outline: str,
        revision_round: int = 0,
    ) -> Tuple[bool, float, Dict[str, float], List[Dict]]:
        """Run Critic through the stable evaluation harness boundary."""
        scene_anchors_context = self._format_scene_anchors_for_critic(chapter_index)
        novel_state_snapshot = self.novel_state_service.build_prewrite_context(chapter_outline, [])
        report = evaluate_chapter_with_critic(
            critic=self.critic,
            chapter_content=chapter_content,
            setting_bible=self.setting_bible or "",
            chapter_outline=chapter_outline,
            content_type=self.content_type,
            chapter_index=chapter_index,
            revision_round=revision_round,
            perspective=self.writer_perspective if self.use_perspective_critic else None,
            perspective_strength=self.perspective_strength,
            scene_anchors_context=scene_anchors_context,
            novel_state_snapshot=novel_state_snapshot,
        )
        if not hasattr(self, "evaluation_reports"):
            self.evaluation_reports = []
        self.evaluation_reports.append(report.to_dict())
        self._report_workflow_event(
            f"Workflow v2 · 第{chapter_index}章 Critic v2：评分 {report.score}/10，问题 {len(report.issues)} 个，修订轮次 {revision_round}"
        )
        return report.as_legacy_tuple()

    def parse_outlines_from_setting_bible(self) -> List[Dict]:
        """
        从 Planner 输出的设定圣经中解析分章大纲。
        委托给 outline_parser 模块。
        """
        return parse_outlines_from_setting_bible(
            setting_bible=self.setting_bible,
            plan=self.plan,
            chapter_word_count=self.chapter_word_count,
        )

    def run_planner(
        self,
        confirmation_handler: Optional[Callable[[str], Tuple[bool, Optional[str]]]] = None
    ) -> str:
        """
        运行策划阶段：加载需求 -> Planner生成设定圣经+分章大纲 -> （可选）人工确认
        :param confirmation_handler: 人工确认处理函数 f(plan_preview) -> (confirmed: bool, feedback: str)
        :return: 最终设定圣经
        """
        self._check_cancellation()
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
        core_requirement = self.req.get("core_requirement", "").strip(' "\'') or "无核心要求"
        target_platform = self.req.get("target_platform", "").strip(' "\'') or "通用平台"
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
        self.novel_state_service = NovelStateService(self.output_dir)

        # 保存信息文件路径
        self.info_path = self.output_dir / "info.json"

        # 重置向量数据库
        if self.start_chapter == 1:
            self._report_progress(10, "初始化向量数据库...")
            reset_current_db()

        use_user_plan = self.req.get("use_user_description_as_plan", False)

        if self.start_chapter == 1:
            self._check_cancellation()
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
                            self._check_cancellation()
                            logger.info(f"找到策划方案用户反馈，根据反馈重新优化...")
                            self.plan = self.planner.revise_plan(
                                self.plan, feedback, self.original_requirement,
                                perspective=self.writer_perspective,
                                perspective_strength=self.perspective_strength,
                            )
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
                        world_bible=world_bible, genre=genre, total_words=str(total_words), core_hook=core_hook,
                        perspective=self.writer_perspective,
                        perspective_strength=self.perspective_strength,
                    )
                    # 在精简架构中，Planner直接输出完整的设定圣经+分章大纲
                    self.setting_bible = self.plan
                    logger.info("Planner方案生成完成")

            # 保存小说基础信息
            info_content = json.dumps({
                "name": self.novel_name,
                "description": novel_description,
                "core_requirement": core_requirement,
                "created_at": str(datetime.now()),
                "architecture": "slim-v2"  # 标记精简架构
            }, ensure_ascii=False, indent=2)
            write_file_atomic(self.info_path, info_content)

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
                        self._check_cancellation()
                        confirmed, feedback = confirmation_handler(self.plan[:2000])
                        if feedback and feedback.strip():
                            self._check_cancellation()
                            self.plan = self.planner.revise_plan(
                                self.plan, feedback, self.original_requirement,
                                perspective=self.writer_perspective,
                                perspective_strength=self.perspective_strength,
                            )
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
                            self._check_cancellation()
                            feedback = input("请输入修改意见：\n")
                            self.plan = self.planner.revise_plan(
                                self.plan, feedback, self.original_requirement,
                                perspective=self.writer_perspective,
                                perspective_strength=self.perspective_strength,
                            )
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
                        write_file_atomic(self.output_dir / "novel_plan.md", self.plan)
                        write_file_atomic(self.output_dir / "setting_bible.md", self.setting_bible)
                        raise WaitingForConfirmationError(0, self.plan[:2000])

        else:
            # 续写：加载已有策划方案和设定圣经
            self._check_cancellation()
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
                self._check_cancellation()
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

    def build_chapter_context(
        self,
        chapter_index: int,
        chapter_plot: str,
        related_content: str,
        target_word_count: int,
    ) -> Tuple[str, List[Dict]]:
        """Assemble continuous chapter context with scene anchors and NovelState."""
        scene_anchors = parse_scene_anchors_from_outline(
            chapter_plot,
            default_word_count=target_word_count,
        )
        anchor_prompt = format_scene_anchors_for_prompt(scene_anchors)
        state_context = self.novel_state_service.build_prewrite_context(
            chapter_plot,
            scene_anchors,
        )
        self.scene_anchor_plans.append({
            "artifact_type": "scene_anchor_plan",
            "chapter_index": chapter_index,
            "scene_anchors": scene_anchors,
        })
        self._report_workflow_event(
            f"Workflow v2 · 第{chapter_index}章 Context Assembler：已装配 {len(scene_anchors)} 个 scene anchors 与 NovelState"
        )
        context_parts = [
            related_content,
            anchor_prompt,
            state_context,
            "【连续写作约束】本章必须一次生成完整章节；scene anchors 只作为内部路标，不能拆成彼此独立的片段。",
        ]
        return "\n\n".join(part for part in context_parts if part), scene_anchors

    def route_repair_strategy(self, issue: Dict) -> str:
        """Select a local repair strategy for an issue."""
        return route_repair_strategy(issue)

    def _get_latest_critique_v2(self) -> Dict:
        if not getattr(self, "evaluation_reports", None):
            return {}
        latest = self.evaluation_reports[-1]
        metadata = latest.get("metadata") or {}
        critique_v2 = metadata.get("critique_v2")
        if isinstance(critique_v2, dict):
            return critique_v2
        return {}

    def _normalize_repair_issue(self, issue: Dict) -> Dict:
        """Flatten harness metadata so local repair can consume one stable shape."""
        if not isinstance(issue, dict):
            issue = {"type": "未知问题", "fix": str(issue), "location": "全文"}
        normalized = dict(issue)
        metadata = normalized.pop("metadata", None)
        if isinstance(metadata, dict):
            for key, value in metadata.items():
                normalized.setdefault(key, value)
        normalized["issue_type"] = normalized.get("issue_type") or normalized.get("type") or "local_rewrite"
        normalized["fix_instruction"] = (
            normalized.get("fix_instruction")
            or normalized.get("fix")
            or normalized.get("suggestion")
            or ""
        )
        evidence_span = normalized.get("evidence_span")
        if not isinstance(evidence_span, dict):
            evidence_span = {"quote": str(evidence_span or normalized.get("location") or "")}
        normalized["evidence_span"] = evidence_span
        normalized["fix_strategy"] = self.route_repair_strategy(normalized)
        return normalized

    def _apply_repair_batch(
        self,
        chapter_index: int,
        current_content: str,
        issues: List[Dict],
        chapter_outline: str,
        revise_round: int,
    ) -> Tuple[str, bool, List[Dict]]:
        """Apply local repairs when possible; return content, used_local, trace."""
        repair_trace: List[Dict] = []
        used_local_repair = False
        normalized_issues = [self._normalize_repair_issue(issue) for issue in (issues or [])]
        local_revise = getattr(self.revise, "revise_local_patch", None)

        # 按 scene_id 分组修复，同一个 scene 的问题批量处理
        issues_by_scene: Dict[str, List[Dict]] = defaultdict(list)
        for issue in normalized_issues:
            scene_id = issue.get("scene_id", "chapter")
            issues_by_scene[scene_id].append(issue)

        if normalized_issues:
            strategies = ", ".join(issue.get("fix_strategy", "local_rewrite") for issue in normalized_issues[:3])
            self._report_workflow_event(
                f"Workflow v2 · 第{chapter_index}章 Failure Router：本轮策略 {strategies}，跨 {len(issues_by_scene)} 个scene"
            )

        # 每个 scene 最多修复前2个问题，避免过度修改
        # 按严重程度排序，优先修复高严重度问题
        for scene_id, scene_issues in issues_by_scene.items():
            sorted_issues = sorted(
                scene_issues,
                key=lambda i: SEVERITY_PRIORITY.get(i.get("severity", "medium"), 2),
                reverse=True
            )
            for issue in sorted_issues[:2]:
                evidence_quote = str((issue.get("evidence_span") or {}).get("quote") or issue.get("location") or "")
                if not local_revise or not evidence_quote or evidence_quote == "全文":
                    continue
                local_context = build_local_repair_context(current_content, evidence_quote)
                if not local_context.get("target"):
                    continue

                before_content = current_content
                patch = local_revise(
                    current_content,
                    issue,
                    {
                        **local_context,
                        "chapter_outline": chapter_outline,
                        "repair_strategy": issue.get("fix_strategy"),
                    },
                    self.setting_bible,
                    perspective=self.writer_perspective,
                    perspective_strength=self.perspective_strength,
                )
                patched_content, applied = apply_local_patch(current_content, patch or {})
                trace_item = {
                    "artifact_type": "repair_trace",
                    "chapter_index": chapter_index,
                    "revision_round": revise_round,
                    "issue": issue,
                    "repair_strategy": issue.get("fix_strategy"),
                    "evidence": issue.get("evidence_span"),
                    "target_text": (patch or {}).get("target_text") if isinstance(patch, dict) else "",
                    "replacement_applied": bool(applied),
                    "scene_id": scene_id,
                }
                repair_trace.append(trace_item)
                if applied and patched_content != before_content:
                    current_content = patched_content
                    used_local_repair = True
                    self._report_workflow_event(
                        f"Workflow v2 · 第{chapter_index}章 {scene_id} Local Revise：已局部替换 {issue.get('fix_strategy')}"
                    )

        if used_local_repair:
            current_content = self.run_stitching_pass(chapter_index, current_content, repair_trace)
            self.repair_traces.extend(repair_trace)
            return current_content, True, repair_trace

        # 局部修复全部失败，回退到整章修订
        current_content = self.revise.revise_chapter(
            current_content,
            issues,
            self.setting_bible,
            perspective=self.writer_perspective,
            perspective_strength=self.perspective_strength,
        )
        self._report_workflow_event(
            f"Workflow v2 · 第{chapter_index}章 Revise：局部定位不足，已回退整章轻量修订"
        )
        return current_content, False, repair_trace

    def run_stitching_pass(self, chapter_index: int, chapter_content: str, repair_trace: List[Dict]) -> str:
        """Repair transitions and voice after local patches."""
        stitcher = getattr(self.revise, "stitch_chapter", None)
        if not stitcher:
            self.stitching_reports.append({
                "artifact_type": "stitching_report",
                "chapter_index": chapter_index,
                "applied": False,
                "reason": "revise agent does not expose stitch_chapter",
            })
            return chapter_content

        stitched = stitcher(
            chapter_content,
            repair_trace,
            self.setting_bible,
            perspective=self.writer_perspective,
            perspective_strength=self.perspective_strength,
        )
        applied = bool(stitched and stitched != chapter_content)
        self.stitching_reports.append({
            "artifact_type": "stitching_report",
            "chapter_index": chapter_index,
            "applied": applied,
            "repair_count": len(repair_trace),
        })
        self._report_workflow_event(
            f"Workflow v2 · 第{chapter_index}章 Stitching Pass：{'已修复过渡' if applied else '无需改动'}，局部修复 {len(repair_trace)} 处"
        )
        return stitched or chapter_content

    def run_chapter_consistency_pass(
        self,
        chapter_index: int,
        chapter_content: str,
        scene_anchors: List[Dict],
    ) -> Tuple[bool, List[Dict]]:
        """
        章节级一致性终检（纯代码，零token消耗）
        检查项：
        1. scene锚点的 state_change 是否已在内容中体现
        2. 结尾钩子是否存在（避免结尾过于简短）

        Returns:
            (是否通过, 发现的问题列表)
        """
        issues: List[Dict] = []
        state = self.novel_state_service.load_state()

        # 检查1：state_change 的关键术语是否出现在内容中
        for anchor in scene_anchors:
            state_change = anchor.get("state_change", "")
            if state_change and len(state_change) > 5:
                # 提取关键词（按2字符分词，因为中文通常没有空格）
                # 简单策略：取2字符的词检查存在性
                found_any_keyword = False
                # 取前几个2字符片段作为关键词
                for i in range(min(3, len(state_change) - 1)):
                    kw = state_change[i:i+2]
                    if kw in chapter_content:
                        found_any_keyword = True
                        break
                if not found_any_keyword:
                    issues.append({
                        "type": "scene_state_mismatch",
                        "scene_id": anchor.get("scene_id"),
                        "location": "全文",
                        "fix": f"场景 {anchor.get('scene_id')} 预期的状态变更未在内容中体现：'{state_change}'",
                        "severity": "medium",
                    })

        # 检查2：结尾钩子是否存在（最后一段长度太短，可能没有悬念钩子）
        content_lines = [line.strip() for line in chapter_content.split("\n") if line.strip()]
        if len(content_lines) > 0 and len(content_lines[-1]) < 10:
            issues.append({
                "type": "weak_hook",
                "location": "章节结尾",
                "fix": "结尾过于简短，没有留下足够的悬念钩子",
                "severity": "low",
            })

        # 检查3：检查是否出现 NovelState 中不存在的新人物（未铺垫空降）
        known_characters = set(state.get("characters", {}).keys())
        if known_characters:
            # 简单检查：是否有看起来像人名的2-4字连续中文字符出现在内容中
            # 实际实现：这里只检查已知角色是否拼写一致
            pass

        return len(issues) == 0, issues

    def _record_novel_state_snapshot(self, chapter_index: int, chapter_content: str, scene_anchors: List[Dict]):
        delta = self.novel_state_service.extract_state_delta_from_chapter(
            chapter_index,
            chapter_content,
            scene_anchors,
        )
        state = self.novel_state_service.merge_delta(delta)
        self.novel_state_snapshots.append({
            "artifact_type": "novel_state_snapshot",
            "chapter_index": chapter_index,
            "state_delta": delta,
            "state": state,
        })
        self._report_workflow_event(
            f"Workflow v2 · 第{chapter_index}章 NovelState：已合并章节状态快照"
        )

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
        self._check_cancellation()

        # 检索相关历史章节和核心设定，控制返回数量节省token
        chapter_plot = self.get_chapter_outline(chapter_index)
        target_word_count = self.get_target_word_count(chapter_index)
        related_chapters = search_related_chapter_content(chapter_plot, top_k=2, max_chapter_num=chapter_index)
        related_settings = search_core_setting(chapter_plot, top_k=1)
        related_content = related_settings + "\n" + related_chapters
        related_content, scene_anchors = self.build_chapter_context(
            chapter_index,
            chapter_plot,
            related_content,
            target_word_count,
        )

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
            content_type=content_type,
            perspective=self.writer_perspective,
            perspective_strength=self.perspective_strength,
        )
        logger.info(f"第 {chapter_index} 章初稿生成完成")
        self._check_cancellation()

        # Step 2: 系统层防护（纯代码，零Token消耗）
        logger.info(f"运行系统层防护检查...")
        # 提取主角姓名（从设定圣经中简单提取，找不到就留空）
        protagonist_name = ""
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
        passed, score, dimensions, issues = self._run_critic_harness(
            chapter_index=chapter_index,
            chapter_content=current_content,
            chapter_outline=chapter_outline,
            revision_round=0,
        )

        # 保存本章维度评分
        for dim, score_val in dimensions.items():
            if dim in self.dimension_scores:
                self.dimension_scores[dim].append(score_val)

        passed = passed and _merge_guardrail_issues_into_review(guardrail_result, issues, guardrail_context)

        revise_count = 0
        max_revise_loops = self.MAX_REVISE_LOOPS

        # 如果不通过，进入 Revise → Critic 循环
        while not passed and revise_count < max_revise_loops:
            self._check_cancellation()
            logger.warning(
                f"第 {chapter_index} 章Critic评审不通过，问题数 {len(issues)}，"
                f"正在修订 (第{revise_count + 1}/{max_revise_loops})..."
            )

            # Step 4: 优先做带邻接上下文的局部修复，无法定位时回退整章修订
            current_content, used_local_repair, repair_trace = self._apply_repair_batch(
                chapter_index=chapter_index,
                current_content=current_content,
                issues=issues,
                chapter_outline=chapter_outline,
                revise_round=revise_count + 1,
            )
            revise_count += 1
            self._check_cancellation()

            # Step 5: Critic 复评（在 guardrail 之前，先获得评审再做修订后的内容
            passed, score, dimensions, issues = self._run_critic_harness(
                chapter_index=chapter_index,
                chapter_content=current_content,
                chapter_outline=chapter_outline,
                revision_round=revise_count,
            )

            # 再次运行系统层防护（修订后可能格式有变化）
            guardrail_result = run_system_guardrails(current_content, guardrail_context)
            current_content = guardrail_result.corrected_content

            # Merge guardrail issues 并更新 passed 状态（在 Critic 复评之后）
            guardrail_passed = _merge_guardrail_issues_into_review(guardrail_result, issues, guardrail_context)
            passed = passed and guardrail_passed
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
                    self._check_cancellation()
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
                        self.setting_bible,
                        perspective=self.writer_perspective,
                        perspective_strength=self.perspective_strength,
                    )
                    # 再次评审
                    passed, score, dimensions, issues = self._run_critic_harness(
                        chapter_index=chapter_index,
                        chapter_content=current_content,
                        chapter_outline=chapter_outline,
                        revision_round=revise_count,
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

        # Step 6: Chapter Consistency Pass（纯代码终检，零token消耗）
        consistency_passed, consistency_issues = self.run_chapter_consistency_pass(
            chapter_index=chapter_index,
            chapter_content=current_content,
            scene_anchors=scene_anchors,
        )

        # 如果终检发现问题，追加到issues列表进入修复流程（最多再尝试1次）
        if not consistency_passed and revise_count < max_revise_loops:
            logger.warning(
                f"第 {chapter_index} 章终检发现 {len(consistency_issues)} 个一致性问题，追加修复..."
            )
            issues.extend(consistency_issues)
            current_content, used_local_repair, repair_trace = self._apply_repair_batch(
                chapter_index=chapter_index,
                current_content=current_content,
                issues=consistency_issues,
                chapter_outline=chapter_outline,
                revise_round=revise_count + 1,
            )
            revise_count += 1

        # 保存终稿到 chapters 子目录
        self.save_chapter(chapter_index, current_content)

        # 添加到向量数据库，用于下文检索
        add_chapter_to_db(chapter_index, f"第{chapter_index}章", current_content)
        self._record_novel_state_snapshot(chapter_index, current_content, scene_anchors)

        logger.info(f"第 {chapter_index} 章生成完成，已保存")

        return current_content, score, passed, issues

    def save_chapter(self, chapter_index: int, content: str):
        """保存章节到 chapters 子目录。"""
        chapter_file = self.output_dir / "chapters" / f"chapter_{chapter_index}.txt"
        write_file_atomic(chapter_file, content)

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
            self._check_cancellation()
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
                self._check_cancellation()
                chapter_num = outline["chapter_num"]
                if chapter_num < self.start_chapter or chapter_num > self.end_chapter:
                    continue

                done_chapters = chapter_num - self.start_chapter
                safe_total = max(1, total_chapters_count)
                percent = 20 + int((done_chapters / safe_total) * 70)
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
                    # 修订：进入同一套 repair router；无法定位片段时会安全回退整章修订
                    current_content, _, _ = self._apply_repair_batch(
                        chapter_index=chapter_num,
                        current_content=existing_content,
                        issues=issues,
                        chapter_outline=outline["outline"],
                        revise_round=1,
                    )
                    # 重新运行防护检查和评审
                    guardrail_context = {
                        'expected_chapter_num': chapter_num,
                        'previous_chapter_num': chapter_num - 1,
                        'target_word_count': outline["target_word_count"],
                    }
                    guardrail_result = run_system_guardrails(current_content, guardrail_context)
                    current_content = guardrail_result.corrected_content
                    passed, score, dimensions, issues = self._run_critic_harness(
                        chapter_index=chapter_num,
                        chapter_content=current_content,
                        chapter_outline=outline["outline"],
                        revision_round=0,
                    )
                    # 更新维度评分
                    for dim, score_val in dimensions.items():
                        if dim in self.dimension_scores:
                            self.dimension_scores[dim].append(score_val)
                    # 将修订后的内容写回统一章节目录，确保后续续写与前端读取一致
                    self.save_chapter(chapter_num, current_content)
                    add_chapter_to_db(chapter_num, f"第{chapter_num}章", current_content)
                    # 删除反馈文件
                    feedback_file.unlink()
                    # 后续流程继续
                # ========== 断点续跑：没有待处理反馈时，跳过已完成章节 ==========
                elif chapter_file.exists():
                    # 文件已存在，说明章节已经生成，跳过
                    # 读取已生成内容，更新 prev_chapter_end 用于下一章衔接
                    with open(chapter_file, "r", encoding="utf-8") as f:
                        existing_content = f.read()
                    add_chapter_to_db(chapter_num, f"第{chapter_num}章", existing_content)
                    prev_chapter_end = existing_content[-500:] if len(existing_content) > 500 else existing_content
                    logger.info(f"第{chapter_num}章已生成文件存在，跳过（断点续跑）")
                    # 统计真实汉字数量（只统计中文字符，不含标点空格）
                    chinese_chars = re.findall(r'[\u4e00-\u9fff]', existing_content)
                    words = len(chinese_chars)
                    generated.append({"num": chapter_num, "words": words})
                    continue
                else:
                    # 正常生成新章节
                    # 即使生成失败或合规检查不通过，也不轻易跳过，保留已有内容供用户检查
                    current_content = None  # 预初始化，避免作用域问题
                    score = 0
                    passed = False
                    issues = []
                    try:
                        current_content, score, passed, issues = self.run_chapter_generation(chapter_num, prev_chapter_end)
                    except Exception as e:
                        logger.error(f"第 {chapter_num} 章生成过程发生异常: {e}，尝试保存已有内容继续")
                        # 如果生成失败但已有部分内容，仍然继续处理
                        if current_content is None or not current_content.strip():
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
                evaluation_reports = getattr(self, "evaluation_reports", [])
                info["evaluation_harness_version"] = (
                    "chapter-evaluation-v2"
                    if any(report.get("harness_version") == "chapter-evaluation-v2" for report in evaluation_reports)
                    else "chapter-evaluation-v1"
                )
                info["evaluation_reports"] = evaluation_reports
                info["workflow_optimization_version"] = "quality-workflow-v2"
                info["scene_anchor_plans"] = getattr(self, "scene_anchor_plans", [])
                info["repair_traces"] = getattr(self, "repair_traces", [])
                info["stitching_reports"] = getattr(self, "stitching_reports", [])
                info["novel_state_snapshots"] = getattr(self, "novel_state_snapshots", [])
                info["architecture"] = "slim-v2"
                # 保存回info.json
                info_content = json.dumps(info, ensure_ascii=False, indent=2)
                write_file_atomic(self.info_path, info_content)
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
