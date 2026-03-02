"""
Brands API routes
"""

import uuid
from typing import Optional
from math import ceil

from fastapi import APIRouter, HTTPException, status, Query

from app.core.deps import CurrentUser, DbSession
from app.models.brand import Brand
from app.schemas.brand import (
    BrandCreate,
    BrandUpdate,
    BrandResponse,
    BrandListResponse,
)
from app.core.logging import get_api_logger, get_audit_logger

router = APIRouter()
api_logger = get_api_logger()
audit_logger = get_audit_logger()


@router.get("", response_model=list[BrandResponse])
async def list_brands(
    current_user: CurrentUser,
    db: DbSession,
    search: Optional[str] = Query(None, description="Search by name"),
):
    """
    List all brands for the current user.
    """
    query = db.query(Brand)

    if search:
        query = query.filter(Brand.name.ilike(f"%{search}%"))

    query = query.order_by(Brand.name)
    brands = query.all()

    api_logger.info("Brands listed", user_id=current_user.id, count=len(brands))

    return brands


@router.get("/paginated", response_model=BrandListResponse)
async def list_brands_paginated(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name"),
):
    """
    List brands with pagination.
    """
    query = db.query(Brand)

    if search:
        query = query.filter(Brand.name.ilike(f"%{search}%"))

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    query = query.order_by(Brand.name)
    query = query.offset((page - 1) * page_size).limit(page_size)
    brands = query.all()

    return BrandListResponse(
        items=brands,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{brand_id}", response_model=BrandResponse)
async def get_brand(
    brand_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Get a specific brand by ID.
    """
    brand = db.query(Brand).filter(
        Brand.id == brand_id,
    ).first()

    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    return brand


@router.post("", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
async def create_brand(
    data: BrandCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Create a new brand.
    """
    # Check for duplicate name
    existing = db.query(Brand).filter(
        Brand.name == data.name,
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brand with this name already exists",
        )

    brand = Brand(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        logo_url=data.logo_url,
    )

    db.add(brand)
    db.commit()
    db.refresh(brand)

    api_logger.info("Brand created", user_id=current_user.id, brand_id=brand.id)
    audit_logger.info(
        "Brand created",
        user_id=current_user.id,
        action="CREATE",
        table_name="brands",
        record_id=brand.id,
    )

    return brand


@router.patch("/{brand_id}", response_model=BrandResponse)
async def update_brand(
    brand_id: str,
    data: BrandUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Update a brand.
    """
    brand = db.query(Brand).filter(
        Brand.id == brand_id,
    ).first()

    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    # Check for duplicate name if updating
    if data.name and data.name != brand.name:
        existing = db.query(Brand).filter(
            Brand.name == data.name,
            Brand.id != brand_id,
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Brand with this name already exists",
            )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(brand, field, value)

    db.commit()
    db.refresh(brand)

    api_logger.info("Brand updated", user_id=current_user.id, brand_id=brand.id)
    audit_logger.info(
        "Brand updated",
        user_id=current_user.id,
        action="UPDATE",
        table_name="brands",
        record_id=brand.id,
    )

    return brand


@router.delete("/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_brand(
    brand_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Delete a brand.
    """
    brand = db.query(Brand).filter(
        Brand.id == brand_id,
    ).first()

    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    # Check if brand is in use
    if brand.devices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete brand that is assigned to devices",
        )

    db.delete(brand)
    db.commit()

    api_logger.info("Brand deleted", user_id=current_user.id, brand_id=brand_id)
    audit_logger.info(
        "Brand deleted",
        user_id=current_user.id,
        action="DELETE",
        table_name="brands",
        record_id=brand_id,
    )
