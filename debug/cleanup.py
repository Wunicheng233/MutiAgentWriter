#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from backend.database import engine, SessionLocal
from backend.models import GenerationTask

db = SessionLocal()
query = db.query(GenerationTask).filter(
    GenerationTask.status.in_(['pending', 'started', 'progress'])
)
query = query.filter(GenerationTask.project_id == 1)
stuck_tasks = query.all()
print(f'找到 {len(stuck_tasks)} 个卡住的任务:')
for task in stuck_tasks:
    print(f'  - 任务 ID: {task.id}, 状态: {task.status}')
    task.status = 'failure'
    task.error_message = 'Manual cleanup: previous task stuck'
if stuck_tasks:
    db.commit()
    print(f'✅ 已标记为失败，现在可以重新导出了')
else:
    print(f'✅ 没有卡住的任务')
db.close()
