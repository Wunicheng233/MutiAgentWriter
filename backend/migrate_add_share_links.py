"""
修复 share_links 表结构的迁移脚本
运行方式: python backend/migrate_add_share_links.py
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text
from backend.database import engine


def migrate():
    """修复 share_links 表结构"""
    print("开始迁移...")

    with engine.connect() as conn:
        # 检查表是否存在
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'share_links'
            )
        """))
        table_exists = result.scalar()

        if not table_exists:
            print("创建 share_links 表...")
            from backend.models import Base
            Base.metadata.create_all(bind=engine, tables=[Base.metadata.tables['share_links']])
            print("✅ share_links 表创建成功")
        else:
            # 检查 is_active 列是否存在
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns
                    WHERE table_name = 'share_links' AND column_name = 'is_active'
                )
            """))
            has_is_active = result.scalar()

            if not has_is_active:
                print("添加 is_active 列...")
                conn.execute(text("""
                    ALTER TABLE share_links
                    ADD COLUMN is_active BOOLEAN DEFAULT TRUE NOT NULL
                """))
                conn.commit()
                print("✅ is_active 列添加成功")
            else:
                print("is_active 列已存在")

    print("迁移完成")


if __name__ == "__main__":
    migrate()
