"""
小说生成异步任务
封装 NovelOrchestrator 为 Celery 后台任务
支持实时进度更新，通过 Celery 状态机制存储
同时同步更新数据库 generation_tasks 表
"""

import os
import re
import json
import yaml
import inspect
from pathlib import Path
from datetime import datetime
from celery import Task
from celery.utils.log import get_task_logger
from typing import Optional, Dict

from celery_app import celery_app
from backend.chapter_sync import sync_chapter_file_to_db
from backend.auth import get_user_api_key, merge_user_llm_config
from backend.core.orchestrator import GenerationCancelledError, NovelOrchestrator, WaitingForConfirmationError
from backend.core.config import settings
from backend.utils.runtime_context import (
    RunContext,
    get_current_output_dir_optional,
    get_current_run_context_optional,
    set_current_output_dir,
    set_current_run_context,
)
from backend.database import SessionLocal
from backend.evaluation_sync import (
    sync_evaluation_reports_to_artifacts,
    sync_workflow_optimization_artifacts_to_artifacts,
)
from backend.models import GenerationTask, Project, User, Chapter
from backend.workflow_service import (
    materialize_open_feedback_files,
    record_chapter_draft_artifact,
    reconcile_consumed_feedback_files,
    update_workflow_run_status,
)

logger = get_task_logger(__name__)


class GenerateNovelTask(Task):
    """小说生成任务基类，自定义异常处理和状态更新"""

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """任务失败时的回调：记录日志并清理临时资源"""
        logger.error(f"Task {task_id} failed: {exc}", exc_info=True)

        # 清理不完整的临时文件和标记项目目录状态
        try:
            project_dir = args[0] if args else kwargs.get("project_dir")
            if project_dir:
                project_path = Path(project_dir)

                # 1. 清理临时文件
                temp_files = [
                    project_path / "user_requirements.yaml",
                    project_path / "temp_plan.json",
                    project_path / ".writing.lock",
                ]
                for temp_file in temp_files:
                    if temp_file.exists():
                        try:
                            temp_file.unlink()
                            logger.info(f"Cleaned up temporary file: {temp_file}")
                        except Exception as cleanup_error:
                            logger.warning(f"Failed to cleanup {temp_file}: {cleanup_error}")

                # 2. 标记项目目录状态为失败
                status_file = project_path / ".task_failed.txt"
                try:
                    with open(status_file, "w", encoding="utf-8") as f:
                        f.write(f"Task failed at: {datetime.utcnow().isoformat()}\n")
                        f.write(f"Error: {str(exc)}\n")
                        f.write(f"Task ID: {task_id}\n")
                    logger.info("Marked project directory status: failed")
                except Exception as status_error:
                    logger.warning(f"Failed to write status file: {status_error}")
        except Exception as cleanup_exception:
            logger.warning(f"Error during failure cleanup for task {task_id}: {cleanup_exception}")

        super().on_failure(exc, task_id, args, kwargs, einfo)


def _cancelled_result(task_id: str, message: str) -> Dict:
    return {
        "success": False,
        "task_id": task_id,
        "cancelled": True,
        "message": message,
    }


def sync_project_quality_scores_from_info(
    db,
    project: Project,
    workflow_run_id: Optional[int] = None,
    chapter_index: Optional[int] = None,
) -> bool:
    """Sync quality scores and evaluation artifacts from a project's info.json."""
    if not project or not project.file_path:
        return False

    info_path = Path(project.file_path) / "info.json"
    if not info_path.exists():
        return False

    with open(info_path, "r", encoding="utf-8") as f:
        info = json.load(f)

    project.overall_quality_score = info.get("overall_quality_score", 0) or 0
    dimension_scores = info.get("dimension_average_scores")
    project.dimension_average_scores = dimension_scores if isinstance(dimension_scores, dict) else {}

    sync_evaluation_reports_to_artifacts(
        db=db,
        project=project,
        workflow_run_id=workflow_run_id,
        evaluation_reports=info.get("evaluation_reports"),
    )
    sync_workflow_optimization_artifacts_to_artifacts(
        db=db,
        project=project,
        workflow_run_id=workflow_run_id,
        info=info,
    )

    try:
        target_chapter = int(chapter_index) if chapter_index is not None else None
    except (TypeError, ValueError):
        target_chapter = None
    for chapter_score in info.get("chapter_scores") or []:
        if not isinstance(chapter_score, dict):
            continue
        raw_chapter_index = chapter_score.get("chapter")
        raw_score = chapter_score.get("score")
        if raw_chapter_index is None or raw_score is None:
            continue
        try:
            scored_chapter_index = int(raw_chapter_index)
            score = float(raw_score)
        except (TypeError, ValueError):
            continue
        if target_chapter is not None and scored_chapter_index != target_chapter:
            continue

        chapter_db = db.query(Chapter).filter(
            Chapter.project_id == project.id,
            Chapter.chapter_index == scored_chapter_index,
        ).first()
        if chapter_db:
            chapter_db.quality_score = score

    db.flush()
    return True


@celery_app.task(bind=True, name="generate_novel", base=GenerateNovelTask, max_retries=3)
def generate_novel_task(
    self,
    project_dir: Optional[str] = None,
    user_id: Optional[str] = None,
    start_chapter: Optional[int] = None,
    end_chapter: Optional[int] = None,
) -> Dict:
    """
    生成小说异步任务
    :param project_dir: 项目输出目录，如果为None则从user_requirements读取创建
    :param user_id: 用户ID，用于追踪和权限控制
    :return: 生成结果统计
    """
    logger.info(
        "Starting generate_novel task, task_id=%s, project_dir=%s, user_id=%s, start_chapter=%s, end_chapter=%s",
        self.request.id,
        project_dir,
        user_id,
        start_chapter,
        end_chapter,
    )

    # Celery fork 后清除 OpenAI 客户端缓存并强制创建新连接池
    try:
        from backend.utils.volc_engine import _client_cache
        _client_cache.clear()
        # 同时清除 httpx 隐式全局连接池上下文
        import gc
        gc.collect()
    except Exception:
        pass

    # 禁止 huggingface_hub 联网下载（WSL2 无法访问 huggingface.co）
    os.environ["HF_HUB_OFFLINE"] = "1"

    # 获取数据库会话，查找对应的GenerationTask记录
    previous_run_context = get_current_run_context_optional()
    previous_output_dir = get_current_output_dir_optional()
    set_current_output_dir(project_dir)
    db = SessionLocal()
    materialized_feedback_files = []
    applied_feedback_item_ids = []
    try:
        # 根据celery_task_id查找任务记录
        task_record = db.query(GenerationTask).filter(
            GenerationTask.celery_task_id == self.request.id
        ).first()
        if task_record is not None:
            set_current_run_context(
                RunContext(
                    project_id=task_record.project_id,
                    project_path=Path(project_dir) if project_dir else None,
                    generation_task_id=task_record.id,
                    celery_task_id=self.request.id,
                    workflow_run_id=task_record.workflow_run.id if task_record.workflow_run else None,
                    user_id=int(user_id) if user_id is not None else None,
                )
            )
        # 如果任务已经被取消（用户重置了项目），直接退出不执行
        if task_record and task_record.status == "cancelled":
            logger.info(f"Task {self.request.id} has been cancelled, skipping execution")
            update_workflow_run_status(
                db=db,
                generation_task=task_record,
                task_status="cancelled",
                current_step_key="cancelled",
                metadata_updates={"cancelled_before_execution": True},
            )
            db.commit()
            db.close()
            return {
                "success": False,
                "task_id": self.request.id,
                "cancelled": True,
                "message": "Task has been cancelled",
            }
    except Exception as e:
        logger.error(
            f"Failed to query task record for task {self.request.id}: {str(e)}",
            exc_info=True,
        )
        task_record = None

    def ensure_not_cancelled(message: str = "Task has been cancelled") -> None:
        if task_record is None:
            return

        db.refresh(task_record)
        if task_record.status != "cancelled":
            return

        update_workflow_run_status(
            db=db,
            generation_task=task_record,
            task_status="cancelled",
            current_step_key="cancelled",
            metadata_updates={"cancelled_during_execution": True},
        )
        db.commit()
        raise GenerationCancelledError(message)

    def progress_callback(percent: int, message: str):
        """
        进度回调，更新到Celery任务状态 + 同步更新数据库
        percent: 0-100 百分比
        message: 当前步骤描述
        """
        ensure_not_cancelled()
        # 计算小数进度（0-1）用于前端进度条
        progress = percent / 100.0
        current_chapter = None
        workflow_step_key = "running"
        chapter_match = re.search(r"第\s*(\d+)\s*章", message)
        if chapter_match:
            current_chapter = int(chapter_match.group(1))

        # 解析当前步骤
        if ("正在生成第" in message or "章生成完成" in message) and "章" in message:
            if chapter_match:
                workflow_step_key = "generating_chapter"
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "progress": progress,
                        "percent": percent,
                        "step": "generating_chapter",
                        "message": message,
                        "chapter": current_chapter,
                    }
                )
            else:
                workflow_step_key = "generating_chapter"
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "progress": progress,
                        "percent": percent,
                        "step": "generating_chapter",
                        "message": message,
                    }
                )
        elif "策划" in message:
            workflow_step_key = "planning"
            self.update_state(
                state="PROGRESS",
                meta={
                    "progress": progress,
                    "percent": percent,
                    "step": "planning",
                    "message": message,
                }
            )
        elif "设定圣经" in message:
            workflow_step_key = "generating_settings"
            self.update_state(
                state="PROGRESS",
                meta={
                    "progress": progress,
                    "percent": percent,
                    "step": "generating_settings",
                    "message": message,
                }
            )
        elif "Workflow v2" in message or "Critic v2" in message or "Local Revise" in message or "Stitching" in message:
            workflow_step_key = "generating_chapter" if current_chapter else "running"
            self.update_state(
                state="PROGRESS",
                meta={
                    "progress": progress,
                    "percent": percent,
                    "step": workflow_step_key,
                    "message": message,
                    "chapter": current_chapter,
                }
            )
        elif "完成" in message and "" in message:
            workflow_step_key = "completed"
            self.update_state(
                state="PROGRESS",
                meta={
                    "progress": 1.0,
                    "percent": 100,
                    "step": "completed",
                    "message": message,
                }
            )
        else:
            # 默认状态更新
            self.update_state(
                state="PROGRESS",
                meta={
                    "progress": progress,
                    "percent": percent,
                    "step": "running",
                    "message": message,
                }
            )

        # 同步更新数据库记录（如果存在）
        if task_record is not None:
            try:
                task_record.status = "progress"
                task_record.progress = progress
                task_record.current_step = message
                task_record.current_chapter = current_chapter
                update_workflow_run_status(
                    db=db,
                    generation_task=task_record,
                    task_status="progress",
                    current_step_key=workflow_step_key,
                    current_chapter=current_chapter,
                    metadata_updates={
                        "last_progress": progress,
                        "last_message": message,
                        "_append_event": {
                            "at": datetime.utcnow().isoformat(),
                            "percent": progress,
                            "step": workflow_step_key,
                            "chapter": current_chapter,
                            "message": message,
                        },
                    },
                )
                db.commit()
            except Exception as e:
                logger.warning(f"Failed to update progress in database: {e}")

        # 增量同步：章节生成完成后，立即同步该章节到数据库
        # 这样前端可以实时看到已生成的内容，不需要等到全部完成
        if task_record is not None and task_record.project_id and "第" in message and "章生成完成" in message:
            try:
                match = re.search(r"第\s*(\d+)\s*章", message)
                if match:
                    chapter_index = int(match.group(1))
                    project = db.query(Project).filter(Project.id == task_record.project_id).first()
                    if project and project.file_path:
                        project_dir = Path(project.file_path)
                        chapter_file = project_dir / "chapters" / f"chapter_{chapter_index}.txt"
                        synced_chapter = sync_chapter_file_to_db(
                            db=db,
                            project=project,
                            chapter_index=chapter_index,
                            chapter_file=chapter_file,
                            status="generated",
                        )
                        if synced_chapter is not None:
                            record_chapter_draft_artifact(
                                db=db,
                                project_id=project.id,
                                chapter=synced_chapter,
                                workflow_run_id=task_record.workflow_run.id if task_record.workflow_run else None,
                                content_text=chapter_file.read_text(encoding="utf-8"),
                                source="agent",
                            )
                            logger.info(f"Incremental sync: upserted chapter {chapter_index} to database")
                            db.commit()

                            # 增量同步质量评分：从info.json读取当前章节的评分并更新
                            # 这样即使开启人机交互逐章确认，每章生成完成后评分也能及时保存
                            try:
                                if sync_project_quality_scores_from_info(
                                    db=db,
                                    project=project,
                                    workflow_run_id=task_record.workflow_run.id if task_record.workflow_run else None,
                                    chapter_index=chapter_index,
                                ):
                                    db.commit()
                                    logger.info(f"Incremental sync: updated quality scores for chapter {chapter_index}")
                            except Exception as e:
                                logger.warning(f"Failed to incremental sync quality scores: {e}")

                    # 学习闭环触发点：章生成完成后，异步提取经验
                    if settings.enable_experience_extraction:
                        try:
                            extract_experience_task.delay(
                                project_id=task_record.project_id,
                                chapter_index=chapter_index,
                            )
                            logger.info(f"Experience extraction triggered for chapter {chapter_index}")
                        except Exception as e:
                            logger.warning(f"Failed to trigger experience extraction: {e}")
            except Exception as e:
                logger.warning(f"Failed to incremental sync chapter to database: {e}")

    try:
        # 更新任务状态为started
        if task_record is not None:
            task_record.status = "started"
            update_workflow_run_status(
                db=db,
                generation_task=task_record,
                task_status="started",
                current_step_key="booting",
                metadata_updates={"worker_task_id": self.request.id},
            )
            db.commit()

        # 从数据库读取项目配置，写入项目目录的user_requirements.yaml
        # 因为orchestrator.run_planner需要从这个文件加载用户需求
        if task_record is not None and task_record.project_id:
            project = db.query(Project).filter(Project.id == task_record.project_id).first()
            if project and project.config and project_dir:
                project_dir_path = Path(project_dir)
                req_file = project_dir_path / "user_requirements.yaml"
                # 从project.config构造user_requirements格式
                # 注意：参数优先级：传入参数 > config中保存的值 > 默认值
                default_start = project.config.get("start_chapter", 1) if project.config else 1
                default_end = project.config.get("end_chapter", 10) if project.config else 10
                effective_start_chapter = start_chapter if start_chapter is not None else default_start
                effective_end_chapter = end_chapter if end_chapter is not None else default_end

                if effective_end_chapter < effective_start_chapter:
                    logger.info(
                        "Task %s has no remaining chapters: start_chapter=%s, end_chapter=%s",
                        self.request.id,
                        effective_start_chapter,
                        effective_end_chapter,
                    )
                    if task_record is not None:
                        task_record.status = "success"
                        task_record.progress = 1.0
                        task_record.current_step = "章节范围已全部完成"
                        task_record.current_chapter = effective_start_chapter
                        task_record.completed_at = datetime.utcnow()
                        update_workflow_run_status(
                            db=db,
                            generation_task=task_record,
                            task_status="success",
                            current_step_key="completed",
                            current_chapter=effective_start_chapter,
                            metadata_updates={
                                "completed": True,
                                "no_remaining_chapters": True,
                                "requested_start_chapter": effective_start_chapter,
                                "requested_end_chapter": effective_end_chapter,
                            },
                        )
                    project.status = "completed"
                    db.commit()
                    return {
                        "success": True,
                        "task_id": self.request.id,
                        "completed": True,
                        "no_remaining_chapters": True,
                        "message": "章节范围已全部完成",
                    }

                default_skip_plan = project.config.get("skip_plan_confirmation", False) if project.config else False
                default_skip_chapter = project.config.get("skip_chapter_confirmation", False) if project.config else False

                user_requirements = {
                    "novel_name": project.config.get("novel_name", project.name),
                    "novel_description": project.config.get("novel_description", project.description or ""),
                    "core_requirement": project.config.get("core_requirement", ""),
                    "genre": project.config.get("genre", ""),
                    "total_words": project.config.get("total_words"),
                    "core_hook": project.config.get("core_hook", ""),
                    "target_platform": project.config.get("target_platform", "网络小说"),
                    "chapter_word_count": project.config.get("chapter_word_count", 2000),
                    "word_count_policy": project.config.get("word_count_policy", {
                        "min_ratio": 0.85,
                        "max_ratio": 1.20,
                    }),
                    "start_chapter": effective_start_chapter,
                    "end_chapter": effective_end_chapter,
                    "skip_plan_confirmation": default_skip_plan,
                    "skip_chapter_confirmation": default_skip_chapter,
                    "allow_plot_adjustment": project.config.get("allow_plot_adjustment", False),
                    "content_type": project.content_type,
                }
                with open(req_file, "w", encoding="utf-8") as f:
                    yaml.dump(user_requirements, f, allow_unicode=True, default_flow_style=False)
                logger.info(f"Wrote user_requirements.yaml to project directory: {req_file}")

                # 渐进迁移：如果反馈已结构化入库但文件缺失，先从数据库补回反馈文件，
                # 保持现有 orchestrator 不变，同时降低对“先写文件”的强依赖。
                materialized_feedback_files = materialize_open_feedback_files(db, project)
                if materialized_feedback_files:
                    created_feedback_files = [item for item in materialized_feedback_files if item.file_created]
                    updated_feedback_files = [item for item in materialized_feedback_files if item.file_updated]
                    logger.info(
                        "Prepared %s open feedback target(s) for orchestration, created %s missing feedback file(s), refreshed %s stale feedback file(s)",
                        len(materialized_feedback_files),
                        len(created_feedback_files),
                        len(updated_feedback_files),
                    )

        # 获取用户 API Key
        # project -> user -> api_key
        user = db.query(User).filter(User.id == int(user_id)).first()
        user_api_key = get_user_api_key(user)
        # 如果用户设置了自己的 API Key，就用用户的，否则用系统配置的
        api_key_to_use = None
        if user_api_key and user_api_key.strip():
            api_key_to_use = user_api_key.strip()

        # 创建编排器，传入进度回调和用户 API Key
        # 从项目读取视角配置（如果存在）
        writer_perspective = None
        perspective_strength = 0.7
        use_perspective_critic = True
        project_config = {}
        if task_record is not None and task_record.project_id:
            project = db.query(Project).filter(Project.id == task_record.project_id).first()
            if project:
                writer_perspective = project.writer_perspective
                perspective_strength = project.perspective_strength if project.perspective_strength is not None else 0.7
                use_perspective_critic = project.use_perspective_critic if project.use_perspective_critic is not None else True
                project_config = project.config or {}
        project_config = merge_user_llm_config(project_config, user)

        orchestrator_kwargs = {
            "project_dir": project_dir,
            "progress_callback": progress_callback,
            "user_api_key": api_key_to_use,
            "cancellation_checker": ensure_not_cancelled,
            "writer_perspective": writer_perspective,
            "perspective_strength": perspective_strength,
            "use_perspective_critic": use_perspective_critic,
        }
        if "project_config" in inspect.signature(NovelOrchestrator).parameters:
            orchestrator_kwargs["project_config"] = project_config
        orchestrator = NovelOrchestrator(**orchestrator_kwargs)

        # 执行完整生成流程，可能需要等待人工确认
        try:
            try:
                result = orchestrator.run_full_novel()
            finally:
                if materialized_feedback_files:
                    try:
                        applied_feedback_item_ids = reconcile_consumed_feedback_files(db, materialized_feedback_files)
                        if applied_feedback_item_ids:
                            logger.info(
                                "Marked %s feedback item(s) as applied after orchestration consumed their bridge files",
                                len(applied_feedback_item_ids),
                            )
                    except Exception as feedback_error:
                        logger.warning("Failed to reconcile feedback files: %s", feedback_error)

            # 更新任务状态为success
            if task_record is not None:
                task_record.status = "success"
                task_record.progress = 1.0
                task_record.completed_at = datetime.utcnow()
                update_workflow_run_status(
                    db=db,
                    generation_task=task_record,
                    task_status="success",
                    current_step_key="completed",
                    current_chapter=task_record.current_chapter,
                    metadata_updates={
                        "completed": True,
                        "applied_feedback_item_ids": applied_feedback_item_ids,
                    },
                )
                # 更新项目状态为completed
                if task_record.project_id:
                    project = db.query(Project).filter(Project.id == task_record.project_id).first()
                    if project:
                        project.status = "completed"
                        # 生成完成后，将所有章节从文件系统同步存入数据库
                        if project.file_path:
                            project_dir = Path(project.file_path)
                            chapters_dir = project_dir / "chapters"
                            if not chapters_dir.exists():
                                chapters_dir = project_dir  # 兼容旧版
                            for chapter_file in sorted(chapters_dir.glob("chapter_*.txt")):
                                file_match = re.search(r"chapter_(\d+)\.txt", chapter_file.name)
                                if not file_match:
                                    continue
                                chapter_index = int(file_match.group(1))
                                synced_chapter = sync_chapter_file_to_db(
                                    db=db,
                                    project=project,
                                    chapter_index=chapter_index,
                                    chapter_file=chapter_file,
                                    status="generated",
                                )
                                if synced_chapter is not None:
                                    record_chapter_draft_artifact(
                                        db=db,
                                        project_id=project.id,
                                        chapter=synced_chapter,
                                        workflow_run_id=task_record.workflow_run.id if task_record.workflow_run else None,
                                        content_text=chapter_file.read_text(encoding="utf-8"),
                                        source="agent",
                                    )
                            db.commit()
                            logger.info("Final synchronization: all chapters to database")

                            # 从info.json读取质量评分，更新到project和chapters
                            try:
                                if sync_project_quality_scores_from_info(
                                    db=db,
                                    project=project,
                                    workflow_run_id=task_record.workflow_run.id if task_record.workflow_run else None,
                                ):
                                    db.commit()
                                    logger.info(f"Quality scores updated to database: overall {project.overall_quality_score:.2f}")
                            except Exception as e:
                                logger.warning(f"Failed to load quality scores from info.json: {e}")
                        db.commit()
                db.commit()

            logger.info(f"Task {self.request.id} completed successfully: {result}")

            # 返回结果（会存储在result backend）
            return {
                "success": True,
                "task_id": self.request.id,
                "result": result,
                "completed": True,
            }
        except WaitingForConfirmationError as e:
            # 需要等待用户人工确认
            logger.info(f"Chapter {e.chapter_index} generated, waiting for user confirmation...")
            if task_record is not None:
                if e.chapter_index > 0 and task_record.project_id:
                    try:
                        project = db.query(Project).filter(Project.id == task_record.project_id).first()
                        if project and project.file_path:
                            project_dir = Path(project.file_path)
                            chapter_file = project_dir / "chapters" / f"chapter_{e.chapter_index}.txt"
                            synced_chapter = sync_chapter_file_to_db(
                                db=db,
                                project=project,
                                chapter_index=e.chapter_index,
                                chapter_file=chapter_file,
                                status="generated",
                            )
                            if synced_chapter is not None:
                                record_chapter_draft_artifact(
                                    db=db,
                                    project_id=project.id,
                                    chapter=synced_chapter,
                                    workflow_run_id=task_record.workflow_run.id if task_record.workflow_run else None,
                                    content_text=chapter_file.read_text(encoding="utf-8"),
                                    source="agent",
                                )
                                sync_project_quality_scores_from_info(
                                    db=db,
                                    project=project,
                                    workflow_run_id=task_record.workflow_run.id if task_record.workflow_run else None,
                                    chapter_index=e.chapter_index,
                                )
                    except Exception as sync_error:
                        logger.warning(
                            "Failed to sync chapter %s before waiting confirmation: %s",
                            e.chapter_index,
                            sync_error,
                        )
                task_record.status = "waiting_confirm"
                task_record.current_step = f"第{e.chapter_index}章生成完成，等待你审阅确认"
                task_record.current_chapter = e.chapter_index
                update_workflow_run_status(
                    db=db,
                    generation_task=task_record,
                    task_status="waiting_confirm",
                    current_step_key="waiting_confirm",
                    current_chapter=e.chapter_index,
                    metadata_updates={
                        "waiting_confirmation": True,
                        "applied_feedback_item_ids": applied_feedback_item_ids,
                    },
                )
                db.commit()
                logger.info(f"Updated task {task_record.id} status to waiting_confirm in database")
            # 任务正常结束，等待用户确认后重启继续下一章
            return {
                "success": True,
                "task_id": self.request.id,
                "waiting_confirmation": True,
                "chapter_index": e.chapter_index,
                "completed": False,
            }
        except GenerationCancelledError as e:
            logger.info(f"Task {self.request.id} cancelled cooperatively: {e}")
            if task_record is not None:
                task_record.status = "cancelled"
                task_record.error_message = str(e)
                task_record.completed_at = datetime.utcnow()
                update_workflow_run_status(
                    db=db,
                    generation_task=task_record,
                    task_status="cancelled",
                    current_step_key="cancelled",
                    current_chapter=task_record.current_chapter,
                    metadata_updates={
                        "cancelled_during_execution": True,
                        "applied_feedback_item_ids": applied_feedback_item_ids,
                    },
                )
                db.commit()
            return _cancelled_result(self.request.id, str(e))

    except Exception as e:
        logger.error(f"Task {self.request.id} failed: {str(e)}", exc_info=True)

        # 更新数据库为failure
        if task_record is not None:
            try:
                task_record.status = "failure"
                task_record.error_message = str(e)
                task_record.completed_at = datetime.utcnow()
                update_workflow_run_status(
                    db=db,
                    generation_task=task_record,
                    task_status="failure",
                    current_step_key="failed",
                    current_chapter=task_record.current_chapter,
                    metadata_updates={"error_message": str(e)},
                )
                db.commit()
            except Exception as db_error:
                logger.error("Failed to commit failure status to DB: %s", db_error)
                db.rollback()

        # 重试，最多3次
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying task {self.request.id}, attempt {self.request.retries + 1}/{self.max_retries}")
            self.retry(countdown=5)

        # 重试失败，标记为失败并保存错误信息
        self.update_state(
            state="FAILURE",
            meta={
                "error": str(e),
                "success": False,
            }
        )

        # 关闭数据库会话
        db.close()
        raise

    finally:
        if previous_run_context is not None:
            set_current_run_context(previous_run_context)
        else:
            set_current_run_context(None)
            set_current_output_dir(previous_output_dir)
        db.close()


# ---------------------------------------------------------------------------
# Hermes-style: Experience Extraction (async learning loop)
# ---------------------------------------------------------------------------


@celery_app.task(bind=True, name="extract_experience", max_retries=2, acks_late=True)
def extract_experience_task(
    self,
    project_id: int,
    chapter_index: int,
) -> dict:
    """Async task: extract writing experiences from a completed chapter,
    distill them into skills, and register auto-generated skills.

    Triggered by progress_callback after each "章生成完成" event.
    Runs asynchronously to avoid blocking the main generation flow.
    """
    from backend.database import SessionLocal
    from backend.core.learning.feedback_collector import FeedbackCollector
    from backend.core.learning.experience_extractor import ExperienceExtractor
    from backend.core.learning.skill_distiller import SkillDistiller
    from backend.core.skill_runtime.skill_registry import SkillRegistry
    from backend.utils.vector_db import add_skill_to_db
    from backend.core.learning.trace_aggregator import TraceAggregator
    from backend.utils.logger import logger as task_logger

    db = SessionLocal()
    try:
        # 1. Collect signals from DB (critique artifacts + user feedback)
        trace = TraceAggregator(db).get_chapter_trace(project_id, chapter_index)
        if not trace.has_critique and not trace.has_feedback:
            return {"skipped": True, "reason": "no critique or feedback found"}

        collector = FeedbackCollector()

        # Build critic signals from stored evaluation report
        critic_issues = []
        critic_dimensions = {}
        if trace.evaluation_report:
            critic_dimensions = trace.evaluation_report.get("dimensions", {})
            # Pull issues from critique_v2 if available
            if trace.critique_v2:
                for issue_list in trace.critique_v2.values():
                    if isinstance(issue_list, list):
                        critic_issues.extend(issue_list)

        signals = collector.collect_all_for_chapter(
            db=db,
            project_id=project_id,
            chapter_index=chapter_index,
            critic_issues=critic_issues,
            critic_dimensions=critic_dimensions,
        )

        # 2. Filter: only process chapters with at least one medium+ signal
        actionable = [s for s in signals if s.is_actionable]
        if not actionable:
            return {"skipped": True, "reason": "no actionable signals"}

        task_logger.info(
            f"Experience extraction: chapter {chapter_index}, "
            f"{len(actionable)} actionable signals"
        )

        # 3. Extract experiences via LLM
        user_feedback_text = "；".join(
            s.description for s in signals if s.source.value == "user"
        )

        extractor = ExperienceExtractor()
        experiences = extractor.extract(
            chapter_index=chapter_index,
            critique_report=trace.evaluation_report,
            user_feedback=user_feedback_text or None,
            chapter_outline=(
                trace.scene_anchor_plan.get("outline", "")
                if trace.scene_anchor_plan else ""
            ),
        )

        if not experiences:
            return {"extracted": 0, "skills_generated": 0}

        # 4. Distill and register skills
        distiller = SkillDistiller()
        registry = SkillRegistry()
        skills_generated = 0

        for exp in experiences:
            skill = distiller.distill(exp)
            if skill is None:
                continue

            # Auto-register if confidence meets threshold
            if skill.confidence >= settings.skill_confidence_threshold:
                try:
                    registered = registry.register_skill(
                        skill.skill_id,
                        skill.to_skill_md(),
                    )
                    # Also index in vector DB for retrieval
                    try:
                        add_skill_to_db(
                            skill_id=skill.skill_id,
                            skill_name=skill.name,
                            content=skill.injection_content,
                            skill_type=skill.skill_type,
                            target_character=skill.target_character,
                            confidence=skill.confidence,
                            auto_generated=True,
                        )
                    except Exception as vector_err:
                        task_logger.warning(
                            f"Vector DB indexing failed for skill {skill.skill_id}: {vector_err}"
                        )

                    skills_generated += 1
                    task_logger.info(
                        f"Registered auto-generated skill: {skill.skill_id} "
                        f"(confidence={skill.confidence:.2f})"
                    )
                except Exception as reg_err:
                    task_logger.warning(
                        f"Failed to register skill {skill.skill_id}: {reg_err}"
                    )
            else:
                task_logger.info(
                    f"Skill candidate {skill.skill_id} below confidence threshold "
                    f"({skill.confidence:.2f} < {settings.skill_confidence_threshold}), skipped"
                )

        db.commit()
        return {
            "extracted": len(experiences),
            "skills_generated": skills_generated,
            "chapter_index": chapter_index,
        }

    except Exception as e:
        task_logger.error(
            f"Experience extraction failed for project {project_id}, "
            f"chapter {chapter_index}: {e}",
            exc_info=True,
        )
        db.rollback()
        return {"error": str(e), "extracted": 0, "skills_generated": 0}

    finally:
        db.close()
