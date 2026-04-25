"""
小说生成异步任务
封装 NovelOrchestrator 为 Celery 后台任务
支持实时进度更新，通过 Celery 状态机制存储
同时同步更新数据库 generation_tasks 表
"""

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
from backend.auth import get_user_api_key
from backend.core.orchestrator import GenerationCancelledError, NovelOrchestrator, WaitingForConfirmationError
from utils.runtime_context import (
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
                    logger.info(f"Marked project directory status: failed")
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
        elif "完成" in message and "🎉" in message:
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
                                info_path = project_dir / "info.json"
                                if info_path.exists():
                                    with open(info_path, "r", encoding="utf-8") as f:
                                        info = json.load(f)
                                    # 更新项目总体评分
                                    project.overall_quality_score = info.get("overall_quality_score", 0)
                                    project.dimension_average_scores = info.get("dimension_average_scores", {})
                                    sync_evaluation_reports_to_artifacts(
                                        db=db,
                                        project=project,
                                        workflow_run_id=task_record.workflow_run.id if task_record.workflow_run else None,
                                        evaluation_reports=info.get("evaluation_reports"),
                                    )
                                    sync_workflow_optimization_artifacts_to_artifacts(
                                        db=db,
                                        project=project,
                                        workflow_run_id=task_record.workflow_run.id if task_record.workflow_run else None,
                                        info=info,
                                    )
                                    # 更新当前章节的quality_score
                                    if "chapter_scores" in info:
                                        for cs in info["chapter_scores"]:
                                            if cs["chapter"] == chapter_index:
                                                chapter_db = db.query(Chapter).filter(
                                                    Chapter.project_id == project.id,
                                                    Chapter.chapter_index == chapter_index
                                                ).first()
                                                if chapter_db:
                                                    chapter_db.quality_score = cs["score"]
                                    db.commit()
                                    logger.info(f"Incremental sync: updated quality scores for chapter {chapter_index}")
                            except Exception as e:
                                logger.warning(f"Failed to incremental sync quality scores: {e}")
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
                effective_start_chapter = start_chapter or project.config.get("start_chapter", 1)
                effective_end_chapter = end_chapter or project.config.get("end_chapter", 10)
                user_requirements = {
                    "novel_name": project.config.get("novel_name", project.name),
                    "novel_description": project.config.get("novel_description", project.description or ""),
                    "core_requirement": project.config.get("core_requirement", ""),
                    "genre": project.config.get("genre", ""),
                    "total_words": project.config.get("total_words"),
                    "core_hook": project.config.get("core_hook", ""),
                    "target_platform": project.config.get("target_platform", "网络小说"),
                    "chapter_word_count": project.config.get("chapter_word_count", 2000),
                    "start_chapter": effective_start_chapter,
                    "end_chapter": effective_end_chapter,
                    "skip_plan_confirmation": project.config.get("skip_plan_confirmation", False),
                    "skip_chapter_confirmation": project.config.get("skip_chapter_confirmation", False),
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
                            logger.info(f"Final synchronization: all chapters to database")

                            # 从info.json读取质量评分，更新到project和chapters
                            info_path = project_dir / "info.json"
                            if info_path.exists():
                                try:
                                    with open(info_path, "r", encoding="utf-8") as f:
                                        info = json.load(f)
                                    # 更新项目总体评分
                                    project.overall_quality_score = info.get("overall_quality_score", 0)
                                    project.dimension_average_scores = info.get("dimension_average_scores", {})
                                    sync_evaluation_reports_to_artifacts(
                                        db=db,
                                        project=project,
                                        workflow_run_id=task_record.workflow_run.id if task_record.workflow_run else None,
                                        evaluation_reports=info.get("evaluation_reports"),
                                    )
                                    sync_workflow_optimization_artifacts_to_artifacts(
                                        db=db,
                                        project=project,
                                        workflow_run_id=task_record.workflow_run.id if task_record.workflow_run else None,
                                        info=info,
                                    )
                                    # 更新每个章节的quality_score
                                    if "chapter_scores" in info:
                                        for cs in info["chapter_scores"]:
                                            chapter_db = db.query(Chapter).filter(
                                                Chapter.project_id == project.id,
                                                Chapter.chapter_index == cs["chapter"]
                                            ).first()
                                            if chapter_db:
                                                chapter_db.quality_score = cs["score"]
                                                db.flush()
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
