"""
重置项目为草稿状态脚本
用法：python reset_project.py <project_id>
默认重置项目ID=1
"""

import sys
from backend.database import SessionLocal
from backend.models import Project, Chapter, GenerationTask

def reset_project_to_draft(project_id: int = 1):
    """重置指定项目为草稿状态"""
    db = SessionLocal()

    try:
        # 1. 重置项目状态
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            print(f"错误：未找到项目 ID={project_id}")
            return False

        old_status = project.status
        project.status = "draft"
        project.overall_quality_score = 0.0
        project.dimension_average_scores = None

        print(f"项目 [{project.name}] (ID={project_id})：状态从 {old_status} → draft")

        # 2. 重置所有章节
        chapters = db.query(Chapter).filter(Chapter.project_id == project_id).all()
        if chapters:
            for chapter in chapters:
                chapter.status = "draft"
                chapter.quality_score = 0.0
                # 不清除内容，保留编辑结果，只重置状态
                # chapter.content = ""
            print(f"已重置 {len(chapters)} 个章节状态")

        # 3. 删除该项目所有生成任务（让用户可以重新触发）
        tasks = db.query(GenerationTask).filter(GenerationTask.project_id == project_id).all()
        if tasks:
            for task in tasks:
                db.delete(task)
            print(f"已删除 {len(tasks)} 个旧生成任务记录")

        # 提交更改
        db.commit()
        print("\n✅ 重置完成！项目现在是草稿状态，可以重新开始生成了。")

        return True

    except Exception as e:
        db.rollback()
        print(f"❌ 重置失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        project_id = int(sys.argv[1])
        reset_project_to_draft(project_id)
    else:
        reset_project_to_draft(1)
