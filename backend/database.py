"""
数据库连接配置
SQLAlchemy 引擎和会话管理
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager
import os

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass

# 从环境变量读取数据库URL，默认本地PostgreSQL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/multiagent_writer"
)

# 创建引擎
engine = create_engine(
    DATABASE_URL,
    echo=False,  # 开发环境可设为True调试SQL
    pool_pre_ping=True,  # 自动检测断开连接
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 基础模型类
Base = declarative_base()

# 获取数据库会话依赖
def get_db():
    """FastAPI 依赖：获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def db_session():
    """
    上下文管理器：获取数据库会话

    用法:
        with db_session() as db:
            db.query(...)

    确保会话在退出时被正确关闭，防止资源泄漏。
    自动处理事务：成功时提交，异常时回滚。
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
