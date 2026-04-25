"""
异步导出任务
处理耗时的 EPUB/DOCX 导出
"""

import os
from celery_app import celery_app
from celery.utils.log import get_task_logger
from datetime import datetime

from backend.database import SessionLocal
from backend.models import GenerationTask
from services.export_service import ExportService

logger = get_task_logger(__name__)


@celery_app.task(bind=True, name="export_project", ignore_result=False)
def export_project_task(self, project_id: int, format: str) -> dict:
    """异步导出项目任务"""
    db = SessionLocal()
    try:
        # 查找数据库中的任务记录，我们需要更新它的状态
        # task_id 是 self.request.id -> Celery 任务ID，对应 GenerationTask.celery_task_id
        task_record = db.query(GenerationTask).filter(
            GenerationTask.celery_task_id == self.request.id
        ).first()

        self.update_state(state='PROGRESS', meta={
            'progress': 0.1,
            'current_step': f'准备导出 {format} 格式...'
        })
        if task_record:
            task_record.status = "progress"
            db.commit()

        export_service = ExportService(db, project_id)

        self.update_state(state='PROGRESS', meta={
            'progress': 0.3,
            'current_step': f'正在生成 {format} 文件...'
        })

        # 导出到临时目录
        temp_dir = '/tmp/storyforge-exports'
        os.makedirs(temp_dir, exist_ok=True)

        if format == 'epub':
            file_path, filename = export_service.export_epub(temp_dir)
        elif format == 'docx':
            file_path, filename = export_service.export_docx(temp_dir)
        elif format == 'html':
            file_path, filename = export_service.export_html(temp_dir)
        else:
            raise ValueError(f'Unsupported format: {format}')

        # 清理旧文件
        ExportService.cleanup_old_files(temp_dir)

        self.update_state(state='PROGRESS', meta={
            'progress': 1.0,
            'current_step': '导出完成'
        })

        # 任务成功完成，更新数据库状态
        if task_record:
            task_record.status = "success"
            task_record.completed_at = datetime.utcnow()
            db.commit()

        # 返回文件信息
        # 在生产环境，这里应该上传到对象存储并返回 CDN URL
        # 开发环境，我们保存到 /tmp 并通过静态服务提供
        result = {
            'success': True,
            'file_path': file_path,
            'filename': filename,
            'format': format,
        }
        return result

    except Exception as e:
        # 更新数据库状态为失败（先确保数据库状态持久化）
        task_record = db.query(GenerationTask).filter(
            GenerationTask.celery_task_id == self.request.id
        ).first()
        if task_record:
            task_record.status = "failure"
            task_record.error_message = str(e)
            task_record.completed_at = datetime.utcnow()
            try:
                db.commit()
            except Exception as commit_error:
                logger.error(f"Failed to commit failure status to DB: {commit_error}")
                db.rollback()

        # 数据库状态已保存后再更新 Celery 状态并抛出异常
        self.update_state(state='FAILURE', meta={
            'error': str(e)
        })
        raise
    finally:
        db.close()
