"""
Brand schemas (Pydantic models)
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class BrandBase(BaseModel):
    """Base brand schema"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    logo_url: Optional[str] = Field(None, max_length=500)


class BrandCreate(BrandBase):
    """Brand creation schema"""
    pass


class BrandUpdate(BaseModel):
    """Brand update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    logo_url: Optional[str] = Field(None, max_length=500)


class BrandResponse(BrandBase):
    """Brand response schema"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class BrandListResponse(BaseModel):
    """Paginated brand list response"""
    items: list[BrandResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
