from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Project, ProjectCollaborator, User
from backend.deps import get_current_user
from backend.rate_limiter import limit_requests
from backend.core.skill_runtime import SkillRegistry

router = APIRouter(prefix="/perspectives", tags=["perspectives"])

PERSPECTIVE_TAG = "perspective"

def check_project_access(
    project_id: int,
    current_user: User,
    db: Session,
    require_owner: bool = True,
    min_role: str | None = None,
) -> Project:
    """检查当前用户是否有权限访问项目（与 projects.py 保持一致）"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return None

    # 所有者总是直接通过
    if project.user_id == current_user.id:
        return project

    # 如果要求必须是所有者
    if require_owner:
        return None

    # 检查是否是协作者
    collab = db.query(ProjectCollaborator).filter(
        ProjectCollaborator.project_id == project_id,
        ProjectCollaborator.user_id == current_user.id
    ).first()

    if not collab:
        return None

    # 角色检查
    if min_role:
        role_levels = {'viewer': 1, 'editor': 2}
        required_level = role_levels.get(min_role, 0)
        actual_level = role_levels.get(collab.role, 0)
        if actual_level < required_level:
            return None

    return project

@router.get("", dependencies=[Depends(limit_requests(60))])
def list_perspectives(db: Session = Depends(get_db)):
    """列出所有可用的作家视角"""
    registry = SkillRegistry()
    all_skills = registry.list_skills()

    perspectives = []
    for skill in all_skills:
        if PERSPECTIVE_TAG in skill.tags:
            perspectives.append({
                "id": skill.id,
                "name": skill.name,
                "description": skill.description,
                "author": skill.author,
                "version": skill.version,
                "strength_recommended": 0.7,  # Skill 默认值
            })

    return {"perspectives": perspectives}

@router.get("/{perspective_id}", dependencies=[Depends(limit_requests(60))])
def get_perspective_detail(perspective_id: str, db: Session = Depends(get_db)):
    """获取特定视角的详细信息"""
    registry = SkillRegistry()
    skill = registry.load_skill(perspective_id)

    if not skill or PERSPECTIVE_TAG not in skill.tags:
        raise HTTPException(status_code=404, detail="视角不存在")

    return {
        "id": skill.id,
        "name": skill.name,
        "description": skill.description,
        "author": skill.author,
        "version": skill.version,
        "injection_preview": skill.injection_content[:500] + "..." if len(skill.injection_content) > 500 else skill.injection_content,
        "applies_to": skill.applies_to,
        "strength_recommended": 0.7,
    }

@router.put("/project/{project_id}")
def update_project_perspective(
    project_id: int,
    perspective_id: str = None,
    perspective_strength: float = 0.7,
    use_perspective_critic: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新项目的视角配置"""
    # 视角配置更新需要所有者权限
    project = check_project_access(project_id, current_user, db, require_owner=True)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    project.writer_perspective = perspective_id
    project.perspective_strength = perspective_strength
    project.use_perspective_critic = use_perspective_critic
    db.commit()

    return {"status": "success"}
