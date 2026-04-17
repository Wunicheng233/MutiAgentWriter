"""
异步导出任务
处理耗时的 EPUB/DOCX 导出
"""

import os
from celery_app import celery_app
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from services.export_service import ExportService
from core.config import settings

# 创建数据库连接
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@celery_app.task(bind=True, name="export_project", ignore_result=False)
def export_project_task(self, project_id: int, format: str) -> dict:
    """异步导出项目任务"""
    db = SessionLocal()
    try:
        self.update_state(state='PROGRESS', meta={
            'progress': 0.1,
            'current_step': f'准备导出 {format} 格式...'
        })

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

        # 返回文件信息
        # 在生产环境，这里应该上传到对象存储并返回 CDN URL
        # 开发环境，我们保存到 /tmp 并通过静态服务提供
        return {
            'success': True,
            'file_path': file_path,
            'filename': filename,
            'format': format,
        }

    except Exception as e:
        self.update_state(state='FAILURE', meta={
            'error': str(e)
        })
        raise
    finally:
        db.close()
