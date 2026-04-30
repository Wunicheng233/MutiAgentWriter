"""
修复现有项目的配置脚本
运行方式：conda run -n novel_agent python backend/fix_project_config.py
"""
import sys
from pathlib import Path

# 添加项目根目录
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import SessionLocal
from backend.models import Project

def fix_project_config(project_id: int):
    """修复指定项目的配置"""
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            print(f"项目 {project_id} 不存在")
            return

        print(f"修复前 config: {project.config}")

        # 确保配置是字典
        if not isinstance(project.config, dict):
            project.config = {}

        # 策划确认模式：策划需要确认，章节自动生成
        project.config["start_chapter"] = 1
        project.config["end_chapter"] = 4  # 你的目标是4章
        project.config["skip_plan_confirmation"] = False
        project.config["skip_chapter_confirmation"] = True  # 关键！跳过章节确认

        # 重置项目状态
        project.status = "draft"

        db.commit()
        print(f"修复后 config: {project.config}")
        print(f"项目 {project_id} 配置修复完成！")
        print("现在可以重新生成，应该会自动生成所有4章")

    except Exception as e:
        print(f"错误: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用方法: python backend/fix_project_config.py <project_id>")
        print("示例: python backend/fix_project_config.py 6")
    else:
        fix_project_config(int(sys.argv[1]))
