"""
Models package - SQLAlchemy ORM models
"""

from app.models.user import User, UserRole, RefreshToken
from app.models.brand import Brand
from app.models.category import Category
from app.models.credential import Credential
from app.models.backup_template import BackupTemplate, TemplateStep
from app.models.device import Device, DeviceStatus
from app.models.device_model import DeviceModel
from app.models.configuration import Configuration
from app.models.audit_log import AuditLog
from app.models.schedule import BackupSchedule, ScheduleType
from app.models.backup_execution import BackupExecution
from app.models.system_setting import SystemSetting, DEFAULT_SETTINGS

__all__ = [
    # User models
    "User",
    "UserRole",
    "RefreshToken",
    # Brand
    "Brand",
    # Category
    "Category",
    # Credential
    "Credential",
    # Backup Template
    "BackupTemplate",
    "TemplateStep",
    # Device
    "Device",
    "DeviceStatus",
    # Device Model
    "DeviceModel",
    # Configuration
    "Configuration",
    # Audit
    "AuditLog",
    # Schedules
    "BackupSchedule",
    "ScheduleType",
    # Backup Execution
    "BackupExecution",
    # System Settings
    "SystemSetting",
    "DEFAULT_SETTINGS",
]
