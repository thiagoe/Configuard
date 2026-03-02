"""
Device Models API routes - CRUD operations for device models
"""

import uuid
from typing import Optional
from math import ceil

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy.orm import joinedload

from app.core.deps import CurrentUser, DbSession
from app.models.device_model import DeviceModel
from app.models.brand import Brand
from app.models.category import Category
from app.schemas.device_model import (
    DeviceModelCreate,
    DeviceModelUpdate,
    DeviceModelResponse,
    DeviceModelListResponse,
)
from app.core.logging import get_api_logger
from app.services.audit import log_create, log_update, log_delete, model_to_dict

router = APIRouter()
api_logger = get_api_logger()


def _validate_reference(db, model, record_id: Optional[str], name: str) -> None:
    """Validate that a foreign key reference exists."""
    if record_id is None:
        return
    record = db.query(model).filter(
        model.id == record_id,
    ).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {name} reference",
        )


@router.get("", response_model=list[DeviceModelResponse])
async def list_device_models(
    current_user: CurrentUser,
    db: DbSession,
    search: Optional[str] = Query(None, description="Search by name"),
    brand_id: Optional[str] = Query(None, description="Filter by brand"),
    category_id: Optional[str] = Query(None, description="Filter by category"),
):
    """
    List all device models for the current user.
    """
    query = db.query(DeviceModel).options(
        joinedload(DeviceModel.brand),
        joinedload(DeviceModel.category),
    )

    if search:
        query = query.filter(DeviceModel.name.ilike(f"%{search}%"))

    if brand_id:
        query = query.filter(DeviceModel.brand_id == brand_id)

    if category_id:
        query = query.filter(DeviceModel.category_id == category_id)

    query = query.order_by(DeviceModel.name)
    device_models = query.all()

    api_logger.info("Device models listed", user_id=current_user.id, count=len(device_models))

    return device_models


@router.get("/paginated", response_model=DeviceModelListResponse)
async def list_device_models_paginated(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name"),
    brand_id: Optional[str] = Query(None, description="Filter by brand"),
    category_id: Optional[str] = Query(None, description="Filter by category"),
):
    """
    List device models with pagination.
    """
    query = db.query(DeviceModel).options(
        joinedload(DeviceModel.brand),
        joinedload(DeviceModel.category),
    )

    if search:
        query = query.filter(DeviceModel.name.ilike(f"%{search}%"))

    if brand_id:
        query = query.filter(DeviceModel.brand_id == brand_id)

    if category_id:
        query = query.filter(DeviceModel.category_id == category_id)

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    query = query.order_by(DeviceModel.name)
    query = query.offset((page - 1) * page_size).limit(page_size)
    device_models = query.all()

    return DeviceModelListResponse(
        items=device_models,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{device_model_id}", response_model=DeviceModelResponse)
async def get_device_model(
    device_model_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Get a specific device model by ID.
    """
    device_model = db.query(DeviceModel).options(
        joinedload(DeviceModel.brand),
        joinedload(DeviceModel.category),
    ).filter(
        DeviceModel.id == device_model_id,
    ).first()

    if not device_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device model not found",
        )

    return device_model


@router.post("", response_model=DeviceModelResponse, status_code=status.HTTP_201_CREATED)
async def create_device_model(
    data: DeviceModelCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Create a new device model.
    """
    # Validate references
    _validate_reference(db, Brand, data.brand_id, "brand")
    _validate_reference(db, Category, data.category_id, "category")

    # Check for duplicate name
    existing = db.query(DeviceModel).filter(
        DeviceModel.name == data.name,
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device model with this name already exists",
        )

    device_model = DeviceModel(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        brand_id=data.brand_id,
        category_id=data.category_id,
    )

    db.add(device_model)
    db.commit()
    db.refresh(device_model)

    api_logger.info("Device model created", user_id=current_user.id, device_model_id=device_model.id)

    # Audit log
    log_create(
        db=db,
        user_id=current_user.id,
        table_name="device_models",
        record_id=device_model.id,
        new_data=model_to_dict(device_model),
    )
    db.commit()

    # Reload with relationships
    device_model = db.query(DeviceModel).options(
        joinedload(DeviceModel.brand),
        joinedload(DeviceModel.category),
    ).filter(DeviceModel.id == device_model.id).first()

    return device_model


@router.patch("/{device_model_id}", response_model=DeviceModelResponse)
async def update_device_model(
    device_model_id: str,
    data: DeviceModelUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Update a device model.
    """
    device_model = db.query(DeviceModel).filter(
        DeviceModel.id == device_model_id,
    ).first()

    if not device_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device model not found",
        )

    # Capture old data for audit
    old_data = model_to_dict(device_model)

    update_data = data.model_dump(exclude_unset=True)

    # Validate references if updating
    if "brand_id" in update_data and update_data["brand_id"] is not None:
        _validate_reference(db, Brand, update_data["brand_id"], "brand")
    if "category_id" in update_data and update_data["category_id"] is not None:
        _validate_reference(db, Category, update_data["category_id"], "category")

    # Check for duplicate name if updating
    if "name" in update_data and update_data["name"] != device_model.name:
        existing = db.query(DeviceModel).filter(
            DeviceModel.name == update_data["name"],
            DeviceModel.id != device_model_id,
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Device model with this name already exists",
            )

    # Update fields
    for field, value in update_data.items():
        setattr(device_model, field, value)

    db.commit()
    db.refresh(device_model)

    api_logger.info("Device model updated", user_id=current_user.id, device_model_id=device_model.id)

    # Audit log with changes
    new_data = model_to_dict(device_model)
    log_update(
        db=db,
        user_id=current_user.id,
        table_name="device_models",
        record_id=device_model.id,
        old_data=old_data,
        new_data=new_data,
    )
    db.commit()

    # Reload with relationships
    device_model = db.query(DeviceModel).options(
        joinedload(DeviceModel.brand),
        joinedload(DeviceModel.category),
    ).filter(DeviceModel.id == device_model.id).first()

    return device_model


@router.delete("/{device_model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device_model(
    device_model_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Delete a device model.
    """
    device_model = db.query(DeviceModel).filter(
        DeviceModel.id == device_model_id,
    ).first()

    if not device_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device model not found",
        )

    # Capture data before delete for audit
    old_data = model_to_dict(device_model)

    db.delete(device_model)

    api_logger.info("Device model deleted", user_id=current_user.id, device_model_id=device_model_id)

    # Audit log with deleted data
    log_delete(
        db=db,
        user_id=current_user.id,
        table_name="device_models",
        record_id=device_model_id,
        old_data=old_data,
    )
    db.commit()
