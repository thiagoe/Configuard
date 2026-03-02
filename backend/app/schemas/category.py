"""
Category schemas (Pydantic models)
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class CategoryBase(BaseModel):
    """Base category schema"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: Optional[str] = Field(None, max_length=50)


class CategoryCreate(CategoryBase):
    """Category creation schema"""
    pass


class CategoryUpdate(BaseModel):
    """Category update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: Optional[str] = Field(None, max_length=50)


class CategoryResponse(CategoryBase):
    """Category response schema"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class CategoryListResponse(BaseModel):
    """Paginated category list response"""
    items: list[CategoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
