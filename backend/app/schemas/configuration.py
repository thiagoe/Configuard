"""
Configuration schemas (Pydantic models)
"""

from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, Field, ConfigDict


CollectionMethodEnum = Literal["ssh", "telnet", "api", "manual", "scheduled"]


class ConfigurationResponse(BaseModel):
    """Configuration response schema (without full config data)"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    device_id: str
    version: int
    config_hash: str
    collection_method: CollectionMethodEnum
    collected_at: datetime
    collected_by: Optional[str] = None
    changes_detected: bool = False
    previous_config_id: Optional[str] = None
    size_bytes: Optional[int] = None
    lines_count: Optional[int] = None
    created_at: datetime


class ConfigurationDetailResponse(ConfigurationResponse):
    """Configuration detail response schema with full data"""
    config_data: str


class ConfigurationListResponse(BaseModel):
    """Paginated configuration list response"""
    items: list[ConfigurationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class DeviceSimple(BaseModel):
    """Simple device schema for embedding in configuration response"""
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    ip_address: str


class ConfigurationWithDeviceResponse(ConfigurationResponse):
    """Configuration response with embedded device info"""
    device: Optional[DeviceSimple] = None


class ConfigurationWithDeviceListResponse(BaseModel):
    """Paginated configuration list response with device info"""
    items: list[ConfigurationWithDeviceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ConfigurationDiffResponse(BaseModel):
    """Configuration diff response schema"""
    device_id: str
    from_config_id: str
    to_config_id: str
    from_version: int
    to_version: int
    diff: str
    added_lines: int
    removed_lines: int
