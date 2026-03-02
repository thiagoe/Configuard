"""
Device schemas (Pydantic models)
"""

from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, Field, ConfigDict


DeviceStatusEnum = Literal["active", "inactive", "maintenance", "error"]


class BrandSimple(BaseModel):
    """Simple brand schema for embedding"""
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str


class CategorySimple(BaseModel):
    """Simple category schema for embedding"""
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str


class ModelSimple(BaseModel):
    """Simple model schema for embedding"""
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str


class DeviceBase(BaseModel):
    """Base device schema"""
    name: str = Field(..., min_length=1, max_length=100)
    ip_address: str = Field(..., min_length=1, max_length=45)
    hostname: Optional[str] = Field(None, max_length=255)
    port: int = Field(22, ge=1, le=65535)
    brand_id: Optional[str] = None
    category_id: Optional[str] = None
    model_id: Optional[str] = None
    credential_id: Optional[str] = None
    backup_template_id: Optional[str] = None
    status: DeviceStatusEnum = "active"
    backup_enabled: bool = True
    custom_retention: bool = False
    retention_versions: Optional[int] = Field(None, ge=1, le=1000)
    notes: Optional[str] = None


class DeviceCreate(DeviceBase):
    """Device creation schema"""
    pass


class DeviceUpdate(BaseModel):
    """Device update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    ip_address: Optional[str] = Field(None, min_length=1, max_length=45)
    hostname: Optional[str] = Field(None, max_length=255)
    port: Optional[int] = Field(None, ge=1, le=65535)
    brand_id: Optional[str] = None
    category_id: Optional[str] = None
    model_id: Optional[str] = None
    credential_id: Optional[str] = None
    backup_template_id: Optional[str] = None
    status: Optional[DeviceStatusEnum] = None
    backup_enabled: Optional[bool] = None
    custom_retention: Optional[bool] = None
    retention_versions: Optional[int] = Field(None, ge=1, le=1000)
    notes: Optional[str] = None


class DeviceResponse(DeviceBase):
    """Device response schema"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    last_backup_at: Optional[datetime] = None
    last_backup_status: Optional[str] = None
    last_backup_error: Optional[str] = None
    last_config_hash: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Embedded related objects
    brand: Optional[BrandSimple] = None
    category: Optional[CategorySimple] = None
    model: Optional[ModelSimple] = None


class DeviceListResponse(BaseModel):
    """Paginated device list response"""
    items: list[DeviceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
