"""
数据库连接配置
SQLAlchemy 引擎和会话管理
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from core.config import settings
import os

# 从环境变量读取数据库URL，默认本地PostgreSQL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/mutiagent_writer"
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
