"""
Device Model schemas (Pydantic models)
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class BrandInfo(BaseModel):
    """Brand info for device model response"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class CategoryInfo(BaseModel):
    """Category info for device model response"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class DeviceModelBase(BaseModel):
    """Base device model schema"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    brand_id: Optional[str] = None
    category_id: Optional[str] = None


class DeviceModelCreate(DeviceModelBase):
    """Device model creation schema"""
    pass


class DeviceModelUpdate(BaseModel):
    """Device model update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    brand_id: Optional[str] = None
    category_id: Optional[str] = None


class DeviceModelResponse(BaseModel):
    """Device model response schema"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    brand_id: Optional[str] = None
    category_id: Optional[str] = None
    brand: Optional[BrandInfo] = None
    category: Optional[CategoryInfo] = None
    created_at: datetime
    updated_at: datetime


class DeviceModelListResponse(BaseModel):
    """Paginated device model list response"""
    items: list[DeviceModelResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
