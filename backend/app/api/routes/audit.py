"""
Audit logs API routes (admin only)
"""

from math import ceil
from typing import Optional

from fastapi import APIRouter, Query
from sqlalchemy.orm import outerjoin, contains_eager

from app.core.deps import CurrentAdmin, DbSession
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogListResponse

router = APIRouter()


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    current_admin: CurrentAdmin,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    action: Optional[str] = Query(None, description="Filter by action"),
    table_name: Optional[str] = Query(None, description="Filter by table"),
    user_id: Optional[str] = Query(None, description="Filter by user id"),
    record_id: Optional[str] = Query(None, description="Filter by record id"),
):
    """
    List audit logs with pagination and basic filters.
    """
    from app.models.user import User
    query = db.query(AuditLog).outerjoin(User, AuditLog.user_id == User.id).options(contains_eager(AuditLog.user))

    # Exclude raw HTTP method entries logged by the old middleware
    # Only show meaningful audit actions (CREATE, UPDATE, DELETE, LOGIN, LOGOUT, BACKUP, etc.)
    http_methods = {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"}
    query = query.filter(~AuditLog.action.in_(http_methods))

    if action:
        query = query.filter(AuditLog.action == action)
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if record_id:
        query = query.filter(AuditLog.record_id == record_id)

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1
    logs = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return AuditLogListResponse(
        items=logs,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
