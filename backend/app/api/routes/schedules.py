"""
Backup schedules API routes - CRUD operations
"""

import uuid
from typing import Optional
from math import ceil

from fastapi import APIRouter, HTTPException, status, Query

from app.core.deps import CurrentUser, DbSession
from app.models.schedule import BackupSchedule, ScheduleType
from app.models.device import Device
from app.models.category import Category
from app.schemas.schedule import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    ScheduleListResponse,
)
from app.services.scheduler import add_or_update_schedule, remove_schedule
from app.core.logging import get_api_logger, get_audit_logger

router = APIRouter()
api_logger = get_api_logger()
audit_logger = get_audit_logger()


def _validate_schedule_fields(data: ScheduleCreate | ScheduleUpdate) -> None:
    if data.schedule_type == "cron":
        if not data.cron_expression:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="cron_expression is required for cron schedules",
            )
    if data.schedule_type == "weekly":
        if data.day_of_week is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="day_of_week is required for weekly schedules",
            )
    if data.schedule_type == "monthly":
        if data.day_of_month is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="day_of_month is required for monthly schedules",
            )


def _load_devices(db: DbSession, device_ids: list[str]) -> list[Device]:
    if not device_ids:
        return []
    devices = db.query(Device).filter(
        Device.id.in_(device_ids),
    ).all()
    if len(devices) != len(device_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more devices are invalid",
        )
    return devices


def _load_categories(db: DbSession, category_ids: list[str]) -> list[Category]:
    if not category_ids:
        return []
    categories = db.query(Category).filter(
        Category.id.in_(category_ids),
    ).all()
    if len(categories) != len(category_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more categories are invalid",
        )
    return categories


@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(
    current_user: CurrentUser,
    db: DbSession,
    search: Optional[str] = Query(None, description="Search by name"),
):
    """
    List all schedules for the current user.
    """
    query = db.query(BackupSchedule)
    if search:
        query = query.filter(BackupSchedule.name.ilike(f"%{search}%"))
    schedules = query.order_by(BackupSchedule.name).all()

    return [ScheduleResponse.from_schedule(s) for s in schedules]


@router.get("/paginated", response_model=ScheduleListResponse)
async def list_schedules_paginated(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name"),
):
    """
    List schedules with pagination.
    """
    query = db.query(BackupSchedule)
    if search:
        query = query.filter(BackupSchedule.name.ilike(f"%{search}%"))

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1
    schedules = query.order_by(BackupSchedule.name).offset((page - 1) * page_size).limit(page_size).all()

    return ScheduleListResponse(
        items=[ScheduleResponse.from_schedule(s) for s in schedules],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Get a specific schedule by ID.
    """
    schedule = db.query(BackupSchedule).filter(
        BackupSchedule.id == schedule_id,
    ).first()

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found",
        )

    return ScheduleResponse.from_schedule(schedule)


@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    data: ScheduleCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Create a new schedule.
    """
    _validate_schedule_fields(data)
    devices = _load_devices(db, data.device_ids)
    categories = _load_categories(db, data.category_ids)

    schedule = BackupSchedule(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        schedule_type=ScheduleType(data.schedule_type),
        cron_expression=data.cron_expression,
        time_of_day=data.time_of_day,
        day_of_week=data.day_of_week,
        day_of_month=data.day_of_month,
        is_active=data.is_active,
    )
    schedule.devices = devices
    schedule.categories = categories

    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    add_or_update_schedule(schedule.id, db)

    api_logger.info("Schedule created", user_id=current_user.id, schedule_id=schedule.id)
    audit_logger.info(
        "Schedule created",
        user_id=current_user.id,
        action="CREATE",
        table_name="backup_schedules",
        record_id=schedule.id,
    )

    return ScheduleResponse.from_schedule(schedule)


@router.patch("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: str,
    data: ScheduleUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Update a schedule.
    """
    schedule = db.query(BackupSchedule).filter(
        BackupSchedule.id == schedule_id,
    ).first()

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found",
        )

    if data.schedule_type:
        _validate_schedule_fields(data)

    update_data = data.model_dump(exclude_unset=True)

    if "schedule_type" in update_data and update_data["schedule_type"] is not None:
        update_data["schedule_type"] = ScheduleType(update_data["schedule_type"])

    if "device_ids" in update_data and update_data["device_ids"] is not None:
        devices = _load_devices(db, update_data["device_ids"])
        schedule.devices = devices
        update_data.pop("device_ids")

    if "category_ids" in update_data and update_data["category_ids"] is not None:
        categories = _load_categories(db, update_data["category_ids"])
        schedule.categories = categories
        update_data.pop("category_ids")

    for field, value in update_data.items():
        setattr(schedule, field, value)

    db.commit()
    db.refresh(schedule)

    add_or_update_schedule(schedule.id, db)

    api_logger.info("Schedule updated", user_id=current_user.id, schedule_id=schedule.id)
    audit_logger.info(
        "Schedule updated",
        user_id=current_user.id,
        action="UPDATE",
        table_name="backup_schedules",
        record_id=schedule.id,
    )

    return ScheduleResponse.from_schedule(schedule)


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Delete a schedule.
    """
    schedule = db.query(BackupSchedule).filter(
        BackupSchedule.id == schedule_id,
    ).first()

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found",
        )

    db.delete(schedule)
    db.commit()

    remove_schedule(schedule_id)

    api_logger.info("Schedule deleted", user_id=current_user.id, schedule_id=schedule_id)
    audit_logger.info(
        "Schedule deleted",
        user_id=current_user.id,
        action="DELETE",
        table_name="backup_schedules",
        record_id=schedule_id,
    )
