"""
Backup Executions API routes - List and view backup execution history
"""

from typing import Optional
from math import ceil

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy.orm import joinedload
from sqlalchemy import func, case

from app.core.deps import CurrentUser, DbSession, user_id_filter
from app.models.backup_execution import BackupExecution
from app.models.device import Device
from app.schemas.backup_execution import (
    BackupExecutionResponse,
    BackupExecutionWithDeviceResponse,
    BackupExecutionListResponse,
    BackupExecutionStatsResponse,
    DailyExecutionCount,
    DailyExecutionCountsResponse,
)
from app.core.logging import get_api_logger

router = APIRouter()
api_logger = get_api_logger()


@router.get("", response_model=BackupExecutionListResponse)
async def list_backup_executions(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (success, failed, timeout)"),
    config_changed: Optional[bool] = Query(None, description="Filter by config changed"),
    triggered_by: Optional[str] = Query(None, description="Filter by trigger type (manual, scheduled)"),
    days: Optional[int] = Query(None, ge=1, le=365, description="Only executions from the last N days"),
):
    """
    List all backup executions for the current user's devices.
    """
    query = db.query(BackupExecution).join(Device).options(
        joinedload(BackupExecution.device)
    )
    f = user_id_filter(Device, current_user)
    if f is not None:
        query = query.filter(f)

    if device_id:
        query = query.filter(BackupExecution.device_id == device_id)

    if status_filter:
        query = query.filter(BackupExecution.status == status_filter)

    if config_changed is not None:
        query = query.filter(BackupExecution.config_changed == config_changed)

    if triggered_by:
        query = query.filter(BackupExecution.triggered_by == triggered_by)

    if days:
        from datetime import timedelta
        from app.core.timezone import now
        query = query.filter(BackupExecution.started_at >= now() - timedelta(days=days))

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    executions = query.order_by(BackupExecution.started_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    api_logger.info(
        "Backup executions listed",
        user_id=current_user.id,
        count=len(executions),
        total=total,
    )

    return BackupExecutionListResponse(
        items=executions,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/stats", response_model=BackupExecutionStatsResponse)
async def get_backup_execution_stats(
    current_user: CurrentUser,
    db: DbSession,
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    days: Optional[int] = Query(None, ge=1, le=365, description="Stats for last N days"),
):
    """
    Get statistics for backup executions.
    """
    from datetime import timedelta
    from app.core.timezone import now

    filters = []
    f = user_id_filter(Device, current_user)
    if f is not None:
        filters.append(f)
    if device_id:
        filters.append(BackupExecution.device_id == device_id)
    if days:
        cutoff = now() - timedelta(days=days)
        filters.append(BackupExecution.started_at >= cutoff)

    # Single aggregation query — replaces 6 separate count() calls
    row = db.query(
        func.count().label("total"),
        func.sum(case((BackupExecution.status == "success", 1), else_=0)).label("successful"),
        func.sum(case((BackupExecution.status == "failed", 1), else_=0)).label("failed"),
        func.sum(case(
            (BackupExecution.status == "success", case((BackupExecution.config_changed == True, 1), else_=0)),
            else_=0
        )).label("changed"),
    ).join(Device).filter(*filters).one()

    total_executions = row.total or 0
    successful_executions = int(row.successful or 0)
    failed_executions = int(row.failed or 0)
    configs_with_changes = int(row.changed or 0)
    configs_without_changes = successful_executions - configs_with_changes

    success_rate = (successful_executions / total_executions * 100) if total_executions > 0 else 0.0
    change_rate = (configs_with_changes / successful_executions * 100) if successful_executions > 0 else 0.0

    return BackupExecutionStatsResponse(
        total_executions=total_executions,
        successful_executions=successful_executions,
        failed_executions=failed_executions,
        configs_with_changes=configs_with_changes,
        configs_without_changes=configs_without_changes,
        success_rate=round(success_rate, 2),
        change_rate=round(change_rate, 2),
    )


@router.get("/daily-counts", response_model=DailyExecutionCountsResponse)
async def get_daily_execution_counts(
    current_user: CurrentUser,
    db: DbSession,
    days: int = Query(7, ge=1, le=365, description="Number of past days to return"),
):
    from datetime import timedelta, date as date_type
    from app.core.timezone import now, get_timezone
    from app.core.config import settings

    tz_name = settings.TIMEZONE
    today = now().date()
    cutoff = today - timedelta(days=days - 1)

    # GROUP BY local date using AT TIME ZONE
    local_date = func.date(
        func.timezone(tz_name, BackupExecution.started_at)
    )

    f = user_id_filter(Device, current_user)
    filters = [BackupExecution.started_at >= cutoff]
    if f is not None:
        filters.append(f)

    rows = (
        db.query(
            local_date.label("day"),
            func.sum(case((BackupExecution.status == "success", 1), else_=0)).label("success"),
            func.sum(case((BackupExecution.status != "success", 1), else_=0)).label("failed"),
        )
        .join(Device)
        .filter(*filters)
        .group_by(local_date)
        .all()
    )

    counts: dict[date_type, dict] = {
        today - timedelta(days=i): {"success": 0, "failed": 0}
        for i in range(days - 1, -1, -1)
    }
    for row in rows:
        d = row.day if isinstance(row.day, date_type) else date_type.fromisoformat(str(row.day))
        if d in counts:
            counts[d]["success"] = int(row.success or 0)
            counts[d]["failed"] = int(row.failed or 0)

    result = [
        DailyExecutionCount(date=d.strftime("%d/%m"), success=v["success"], failed=v["failed"])
        for d, v in sorted(counts.items())
    ]
    return DailyExecutionCountsResponse(days=result)


@router.get("/{execution_id}", response_model=BackupExecutionWithDeviceResponse)
async def get_backup_execution(
    execution_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Get a specific backup execution by ID.
    """
    q = db.query(BackupExecution).join(Device).options(
        joinedload(BackupExecution.device)
    ).filter(BackupExecution.id == execution_id)
    f = user_id_filter(Device, current_user)
    if f is not None:
        q = q.filter(f)
    execution = q.first()

    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup execution not found",
        )

    return execution


@router.get("/device/{device_id}", response_model=BackupExecutionListResponse)
async def list_device_backup_executions(
    device_id: str,
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
):
    """
    List backup executions for a specific device.
    """
    # Verify device belongs to user
    dq = db.query(Device).filter(Device.id == device_id)
    f = user_id_filter(Device, current_user)
    if f is not None:
        dq = dq.filter(f)
    device = dq.first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    query = db.query(BackupExecution).options(
        joinedload(BackupExecution.device)
    ).filter(BackupExecution.device_id == device_id)

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    executions = query.order_by(BackupExecution.started_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return BackupExecutionListResponse(
        items=executions,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
