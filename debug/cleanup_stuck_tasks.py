#!/usr/bin/env python3
"""
清理数据库中卡住的任务
将所有处于 pending/started/progress 状态的任务标记为 failure
"""

import sys
sys.path.insert(0, '..')

from sqlalchemy.orm import Session
from backend.database import engine, SessionLocal
from backend.models import GenerationTask

def cleanup_stuck_tasks(project_id: int = None):
    db = SessionLocal()
    try:
        # 查询所有卡住的任务
        query = db.query(GenerationTask).filter(
            GenerationTask.status.in_(["pending", "started", "progress"])
        )
        if project_id:
            query = query.filter(GenerationTask.project_id == project_id)

        stuck_tasks = query.all()
        print(f"找到 {len(stuck_tasks)} 个卡住的任务:")

        for task in stuck_tasks:
            print(f"  - 任务 ID: {task.id}, 项目 ID: {task.project_id}, 状态: {task.status}")
            task.status = "failure"
            task.error_message = "Manual cleanup: previous task stuck"

        if stuck_tasks:
            db.commit()
            print(f"\n✅ 已将 {len(stuck_tasks)} 个任务标记为失败，现在可以重新导出了")
        else:
            print("\n✅ 没有找到卡住的任务")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cleanup_stuck_tasks(int(sys.argv[1]))
    else:
        cleanup_stuck_tasks()
