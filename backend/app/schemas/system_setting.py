"""
System settings schemas
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class SystemSettingBase(BaseModel):
    """Base system setting schema"""
    value: Optional[str] = None
    description: Optional[str] = None


class SystemSettingUpdate(BaseModel):
    """System setting update schema"""
    value: str


class SystemSettingResponse(SystemSettingBase):
    """System setting response schema"""
    model_config = ConfigDict(from_attributes=True)

    key: str
    updated_at: datetime


class SystemSettingsResponse(BaseModel):
    """All system settings response"""
    retention_versions: int
    audit_retention_days: int


class EmailSettingsResponse(BaseModel):
    """Email notification settings response (smtp_password masked)"""
    email_enabled: bool
    smtp_host: str
    smtp_port: int
    smtp_use_tls: bool
    smtp_username: str
    smtp_password_set: bool  # True if password is configured (never returned in plain)
    email_sender: str
    email_recipients: str
    notify_backup_failed: bool
    notify_backup_success: bool
    notify_device_disabled: bool
    notify_device_deleted: bool


class EmailSettingsUpdate(BaseModel):
    """Email notification settings update"""
    email_enabled: bool
    smtp_host: str
    smtp_port: int
    smtp_use_tls: bool
    smtp_username: str
    smtp_password: Optional[str] = None  # None = keep existing
    email_sender: str
    email_recipients: str
    notify_backup_failed: bool
    notify_backup_success: bool
    notify_device_disabled: bool
    notify_device_deleted: bool
