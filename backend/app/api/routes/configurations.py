"""
Configurations API routes - history and diff
"""

from math import ceil
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy.orm import joinedload

from app.core.deps import CurrentUser, DbSession
from app.models.configuration import Configuration
from app.models.device import Device
from app.schemas.configuration import (
    ConfigurationResponse,
    ConfigurationDetailResponse,
    ConfigurationListResponse,
    ConfigurationWithDeviceResponse,
    ConfigurationWithDeviceListResponse,
    ConfigurationDiffResponse,
)
from app.services.diff import generate_unified_diff
from app.core.logging import get_api_logger

router = APIRouter()
api_logger = get_api_logger()


@router.get("/configurations", response_model=ConfigurationWithDeviceListResponse)
async def list_all_configurations(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by last backup status"),
):
    """
    List all configurations across all user's devices with pagination.
    """
    query = db.query(Configuration).join(Device).options(
        joinedload(Configuration.device)
    )

    if device_id:
        query = query.filter(Configuration.device_id == device_id)

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    configs = query.order_by(Configuration.collected_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    api_logger.info(
        "All configurations listed",
        user_id=current_user.id,
        count=len(configs),
    )

    return ConfigurationWithDeviceListResponse(
        items=configs,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/devices/{device_id}/configurations", response_model=list[ConfigurationResponse])
async def list_device_configurations(
    device_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    List all configurations for a device.
    """
    device = db.query(Device).filter(Device.id == device_id).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    configs = db.query(Configuration).filter(
        Configuration.device_id == device_id
    ).order_by(Configuration.version.desc()).all()

    api_logger.info(
        "Device configurations listed",
        user_id=current_user.id,
        device_id=device_id,
        count=len(configs),
    )
    return configs


@router.get(
    "/devices/{device_id}/configurations/paginated",
    response_model=ConfigurationListResponse,
)
async def list_device_configurations_paginated(
    device_id: str,
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
):
    """
    List configurations for a device with pagination.
    """
    device = db.query(Device).filter(Device.id == device_id).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    query = db.query(Configuration).filter(Configuration.device_id == device_id)
    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    configs = query.order_by(Configuration.version.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return ConfigurationListResponse(
        items=configs,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/configurations/{config_id}", response_model=ConfigurationDetailResponse)
async def get_configuration_detail(
    config_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Get a specific configuration, including config_data.
    """
    config = db.query(Configuration).filter(
        Configuration.id == config_id,
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found",
        )

    return config


@router.get(
    "/configurations/{config_id}/diff/{config_id2}",
    response_model=ConfigurationDiffResponse,
)
async def diff_configurations(
    config_id: str,
    config_id2: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Compare two configuration versions and return a unified diff.
    """
    config_a = db.query(Configuration).filter(
        Configuration.id == config_id,
    ).first()

    config_b = db.query(Configuration).filter(
        Configuration.id == config_id2,
    ).first()

    if not config_a or not config_b:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found",
        )

    if config_a.device_id != config_b.device_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configurations belong to different devices",
        )

    diff_text, added, removed = generate_unified_diff(
        config_a.config_data or "",
        config_b.config_data or "",
        from_label=f"config:{config_a.id}",
        to_label=f"config:{config_b.id}",
    )

    return ConfigurationDiffResponse(
        device_id=config_a.device_id,
        from_config_id=config_a.id,
        to_config_id=config_b.id,
        from_version=config_a.version,
        to_version=config_b.version,
        diff=diff_text,
        added_lines=added,
        removed_lines=removed,
    )
