"""
FastAPI 主应用入口
- 注册所有路由
- 配置CORS
- 提供文档
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.api.auth import router as auth_router
from backend.api.projects import router as projects_router
from backend.api.chapters import router as chapters_router
from backend.api.tasks import router as tasks_router
from backend.api.share import router as share_router
from backend.api.perspectives import router as perspectives_router
from backend.database import Base, engine

# 创建数据库表（生产环境使用Alembic迁移）
# 开发环境可直接创建
def create_tables():
    Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    # 启动时创建表（开发环境）
    # create_tables()
    yield
    # 关闭时清理
    pass


app = FastAPI(
    title="MultiAgentWriter API",
    description="多Agent AI小说创作系统 RESTful API",
    version="1.0.0",
    lifespan=lifespan,
)

# 配置CORS，允许前端访问
# 注意：allow_credentials=True 不能和 allow_origins=["*"] 同时使用
# 开发环境明确允许 Vite 开发服务器
origins = [
    "http://localhost:5173",  # Vite 开发服务器
    "http://localhost:8000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(chapters_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(share_router, prefix="/api")
app.include_router(perspectives_router, prefix="/api")


@app.get("/api/health")
def health_check():
    """健康检查"""
    return {"status": "ok", "service": "multiagent-writer-api"}


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
