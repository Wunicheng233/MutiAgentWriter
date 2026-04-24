from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from core.perspective_engine import PerspectiveEngine

router = APIRouter(prefix="/perspectives", tags=["perspectives"])


class Perspective(BaseModel):
    id: str
    name: str
    genre: str
    description: str
    strength_recommended: float
    builtin: bool
    strengths: List[str]
    weaknesses: List[str]


class PerspectiveDetail(Perspective):
    preview: Dict[str, dict | str]


@router.get("/", response_model=Dict[str, List[Perspective]])
async def list_perspectives():
    """列出所有可用的作家视角"""
    perspectives = PerspectiveEngine.list_available_perspectives()

    # 补充 strengths 和 weaknesses
    for p in perspectives:
        try:
            engine = PerspectiveEngine(p['id'])
            p['strengths'] = engine.perspective_data.get('strengths', [])
            p['weaknesses'] = engine.perspective_data.get('weaknesses', [])
        except Exception:
            p['strengths'] = []
            p['weaknesses'] = []

    return {"perspectives": perspectives}


@router.get("/{perspective_id}", response_model=PerspectiveDetail)
async def get_perspective_detail(perspective_id: str):
    """获取特定视角的详细信息和预览"""
    try:
        engine = PerspectiveEngine(perspective_id)
        data = engine.perspective_data
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Perspective '{perspective_id}' not found")

    return PerspectiveDetail(
        id=perspective_id,
        name=data['name'],
        genre=data['genre'],
        description=data['description'],
        strength_recommended=data['strength_recommended'],
        builtin=True,
        strengths=data.get('strengths', []),
        weaknesses=data.get('weaknesses', []),
        preview={
            'planner_injection': engine._get_planner_injection(data['strength_recommended']),
            'writer_injection': engine._get_writer_injection(data['strength_recommended']),
            'critic_injection': engine._get_critic_injection(data['strength_recommended']),
        }
    )


class UpdateProjectPerspectiveRequest(BaseModel):
    perspective: Optional[str] = None
    perspective_strength: float = 0.7
    use_perspective_critic: bool = True


@router.put("/project/{project_id}")
async def update_project_perspective(
    project_id: int,
    request: UpdateProjectPerspectiveRequest,
):
    """更新项目的创作风格配置"""
    from backend.database import SessionLocal
    from backend.models import Project

    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # 验证 perspective 是否有效
        if request.perspective is not None:
            try:
                PerspectiveEngine(request.perspective)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid perspective: {request.perspective}")

        # 更新字段
        project.writer_perspective = request.perspective
        project.perspective_strength = request.perspective_strength
        project.use_perspective_critic = request.use_perspective_critic

        db.commit()

        return {
            "status": "ok",
            "writer_perspective": project.writer_perspective,
            "perspective_strength": project.perspective_strength,
            "use_perspective_critic": project.use_perspective_critic,
        }
    finally:
        db.close()
