"""
Categories API routes
"""

import uuid
from typing import Optional
from math import ceil

from fastapi import APIRouter, HTTPException, status, Query

from app.core.deps import CurrentUser, CurrentModerator, DbSession
from app.models.category import Category
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    CategoryListResponse,
)
from app.core.logging import get_api_logger, get_audit_logger

router = APIRouter()
api_logger = get_api_logger()
audit_logger = get_audit_logger()


@router.get("", response_model=list[CategoryResponse])
async def list_categories(
    current_user: CurrentUser,
    db: DbSession,
    search: Optional[str] = Query(None, description="Search by name"),
):
    """
    List all categories for the current user.
    """
    query = db.query(Category)

    if search:
        query = query.filter(Category.name.ilike(f"%{search}%"))

    query = query.order_by(Category.name)
    categories = query.all()

    api_logger.info("Categories listed", user_id=current_user.id, count=len(categories))

    return categories


@router.get("/paginated", response_model=CategoryListResponse)
async def list_categories_paginated(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name"),
):
    """
    List categories with pagination.
    """
    query = db.query(Category)

    if search:
        query = query.filter(Category.name.ilike(f"%{search}%"))

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    query = query.order_by(Category.name)
    query = query.offset((page - 1) * page_size).limit(page_size)
    categories = query.all()

    return CategoryListResponse(
        items=categories,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Get a specific category by ID.
    """
    category = db.query(Category).filter(
        Category.id == category_id,
    ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    return category


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    current_user: CurrentModerator,
    db: DbSession,
):
    """
    Create a new category.
    """
    # Check for duplicate name
    existing = db.query(Category).filter(
        Category.name == data.name,
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name already exists",
        )

    category = Category(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        color=data.color,
        icon=data.icon,
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    api_logger.info("Category created", user_id=current_user.id, category_id=category.id)
    audit_logger.info(
        "Category created",
        user_id=current_user.id,
        action="CREATE",
        table_name="categories",
        record_id=category.id,
    )

    return category


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    data: CategoryUpdate,
    current_user: CurrentModerator,
    db: DbSession,
):
    """
    Update a category.
    """
    category = db.query(Category).filter(
        Category.id == category_id,
    ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    # Check for duplicate name if updating
    if data.name and data.name != category.name:
        existing = db.query(Category).filter(
            Category.name == data.name,
            Category.id != category_id,
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category with this name already exists",
            )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)

    api_logger.info("Category updated", user_id=current_user.id, category_id=category.id)
    audit_logger.info(
        "Category updated",
        user_id=current_user.id,
        action="UPDATE",
        table_name="categories",
        record_id=category.id,
    )

    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    current_user: CurrentModerator,
    db: DbSession,
):
    """
    Delete a category.
    """
    category = db.query(Category).filter(
        Category.id == category_id,
    ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    # Check if category is in use
    if category.devices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete category that is assigned to devices",
        )

    db.delete(category)
    db.commit()

    api_logger.info("Category deleted", user_id=current_user.id, category_id=category_id)
    audit_logger.info(
        "Category deleted",
        user_id=current_user.id,
        action="DELETE",
        table_name="categories",
        record_id=category_id,
    )
