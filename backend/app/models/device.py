"""
Device model - Network devices to backup
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, Integer, Enum
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base
from app.core.timezone import now


class DeviceStatus(str, enum.Enum):
    """Device operational status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"
    ERROR = "error"


class Device(Base):
    """Network device model"""

    __tablename__ = "devices"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)

    # Basic info
    name = Column(String(100), nullable=False)
    ip_address = Column(String(45), nullable=False)  # IPv4 or IPv6
    hostname = Column(String(255), nullable=True)
    port = Column(Integer, default=22, nullable=False)

    # Foreign keys
    brand_id = Column(String(36), ForeignKey("brands.id"), nullable=True)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=True)
    model_id = Column(String(36), ForeignKey("device_models.id"), nullable=True)
    credential_id = Column(String(36), ForeignKey("credentials.id"), nullable=True)
    backup_template_id = Column(String(36), ForeignKey("backup_templates.id"), nullable=True)

    # Status
    status = Column(String(20), default="active", nullable=False)
    backup_enabled = Column(Boolean, default=True, nullable=False)

    # Last backup info
    last_backup_at = Column(DateTime, nullable=True)
    last_backup_status = Column(String(20), nullable=True)  # success, error, timeout
    last_backup_error = Column(Text, nullable=True)
    last_config_hash = Column(String(64), nullable=True)  # SHA-256 hash

    # Retention settings
    custom_retention = Column(Boolean, default=False, nullable=False)  # Use custom retention instead of global
    retention_versions = Column(Integer, nullable=True)  # Max versions to keep (null = use global)

    # Additional info
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=now, nullable=False)
    updated_at = Column(DateTime, default=now, onupdate=now, nullable=False)

    # Relationships
    user = relationship("User", backref="devices")
    brand = relationship("Brand", back_populates="devices")
    category = relationship("Category", back_populates="devices")
    model = relationship("DeviceModel", back_populates="devices")
    credential = relationship("Credential", back_populates="devices")
    backup_template = relationship("BackupTemplate", back_populates="devices")
    configurations = relationship("Configuration", back_populates="device", cascade="all, delete-orphan")
    backup_executions = relationship("BackupExecution", back_populates="device", passive_deletes=True)
    schedules = relationship("BackupSchedule", secondary="schedule_devices", back_populates="devices")

    def __repr__(self):
        return f"<Device {self.name} ({self.ip_address})>"
