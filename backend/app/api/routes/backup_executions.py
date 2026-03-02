"""
Backup Executions API routes - List and view backup execution history
"""

from typing import Optional
from math import ceil

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy.orm import joinedload
from sqlalchemy import func

from app.core.deps import CurrentUser, DbSession
from app.models.backup_execution import BackupExecution
from app.models.device import Device
from app.schemas.backup_execution import (
    BackupExecutionResponse,
    BackupExecutionWithDeviceResponse,
    BackupExecutionListResponse,
    BackupExecutionStatsResponse,
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
):
    """
    List all backup executions for the current user's devices.
    """
    query = db.query(BackupExecution).join(Device).options(
        joinedload(BackupExecution.device)
    )

    if device_id:
        query = query.filter(BackupExecution.device_id == device_id)

    if status_filter:
        query = query.filter(BackupExecution.status == status_filter)

    if config_changed is not None:
        query = query.filter(BackupExecution.config_changed == config_changed)

    if triggered_by:
        query = query.filter(BackupExecution.triggered_by == triggered_by)

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

    query = db.query(BackupExecution).join(Device)

    if device_id:
        query = query.filter(BackupExecution.device_id == device_id)

    if days:
        cutoff = now() - timedelta(days=days)
        query = query.filter(BackupExecution.started_at >= cutoff)

    total_executions = query.count()
    successful_executions = query.filter(BackupExecution.status == "success").count()
    failed_executions = query.filter(BackupExecution.status == "failed").count()

    # For change statistics, only count successful backups
    success_query = db.query(BackupExecution).join(Device).filter(
        BackupExecution.status == "success",
    )

    if device_id:
        success_query = success_query.filter(BackupExecution.device_id == device_id)

    if days:
        success_query = success_query.filter(BackupExecution.started_at >= cutoff)

    total_successful = success_query.count()
    configs_with_changes = success_query.filter(BackupExecution.config_changed == True).count()
    configs_without_changes = total_successful - configs_with_changes

    success_rate = (successful_executions / total_executions * 100) if total_executions > 0 else 0.0
    change_rate = (configs_with_changes / total_successful * 100) if total_successful > 0 else 0.0

    return BackupExecutionStatsResponse(
        total_executions=total_executions,
        successful_executions=successful_executions,
        failed_executions=failed_executions,
        configs_with_changes=configs_with_changes,
        configs_without_changes=configs_without_changes,
        success_rate=round(success_rate, 2),
        change_rate=round(change_rate, 2),
    )


@router.get("/{execution_id}", response_model=BackupExecutionWithDeviceResponse)
async def get_backup_execution(
    execution_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Get a specific backup execution by ID.
    """
    execution = db.query(BackupExecution).join(Device).options(
        joinedload(BackupExecution.device)
    ).filter(
        BackupExecution.id == execution_id,
    ).first()

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
    device = db.query(Device).filter(
        Device.id == device_id,
    ).first()

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
