"""Public beta feedback and problem reporting endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.api.projects import check_project_access
from backend.database import get_db
from backend.deps import get_current_user
from backend.models import ProblemReport, User
from backend.schemas import ProblemReportCreate, ProblemReportResponse

router = APIRouter(prefix="/feedback", tags=["feedback"])

ALLOWED_CATEGORIES = {"bug", "generation", "ui", "account", "billing", "quality", "other"}
ALLOWED_SEVERITIES = {"low", "medium", "high", "critical"}


@router.post("/problem-reports", response_model=ProblemReportResponse, summary="提交产品问题反馈")
def create_problem_report(
    payload: ProblemReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Store a user-submitted problem report with enough context for beta debugging."""
    category = (payload.category or "bug").strip().lower()
    severity = (payload.severity or "medium").strip().lower()
    if category not in ALLOWED_CATEGORIES:
        category = "other"
    if severity not in ALLOWED_SEVERITIES:
        severity = "medium"

    if payload.project_id is not None:
        project = check_project_access(payload.project_id, current_user, db, require_owner=False)
        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="项目不存在或无权访问",
            )

    report = ProblemReport(
        user_id=current_user.id,
        project_id=payload.project_id,
        task_id=payload.task_id,
        category=category,
        severity=severity,
        title=(payload.title or "").strip() or None,
        description=payload.description.strip(),
        page_url=(payload.page_url or "").strip() or None,
        route=(payload.route or "").strip() or None,
        user_agent=(payload.user_agent or "").strip() or None,
        context=payload.context or {},
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
