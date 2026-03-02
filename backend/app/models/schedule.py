"""
Backup schedule model - Automated backup scheduling
"""

from datetime import time
import uuid

from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    Boolean,
    Enum,
    ForeignKey,
    Time,
    Table,
    Integer,
)
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base
from app.core.timezone import now


schedule_devices = Table(
    "schedule_devices",
    Base.metadata,
    Column("id", String(36), primary_key=True, default=lambda: str(uuid.uuid4())),
    Column("schedule_id", String(36), ForeignKey("backup_schedules.id", ondelete="CASCADE"), nullable=False),
    Column("device_id", String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False),
    Column("created_at", DateTime, default=now, nullable=False),
)

# Many-to-many relationship: schedules can be associated with multiple categories
schedule_categories = Table(
    "schedule_categories",
    Base.metadata,
    Column("id", String(36), primary_key=True, default=lambda: str(uuid.uuid4())),
    Column("schedule_id", String(36), ForeignKey("backup_schedules.id", ondelete="CASCADE"), nullable=False),
    Column("category_id", String(36), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False),
    Column("created_at", DateTime, default=now, nullable=False),
)


class ScheduleType(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CRON = "cron"


class BackupSchedule(Base):
    """Backup schedule model"""

    __tablename__ = "backup_schedules"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    schedule_type = Column(String(20), default="daily", nullable=False)
    cron_expression = Column(String(100), nullable=True)
    time_of_day = Column(Time, default=time(2, 0), nullable=True)
    day_of_week = Column(Integer, nullable=True)
    day_of_month = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now, nullable=False)
    updated_at = Column(DateTime, default=now, onupdate=now, nullable=False)

    user = relationship("User", backref="backup_schedules")
    devices = relationship(
        "Device",
        secondary=schedule_devices,
        back_populates="schedules",
    )
    categories = relationship(
        "Category",
        secondary=schedule_categories,
        backref="schedules",
    )

    def __repr__(self) -> str:
        return f"<BackupSchedule {self.name} ({self.schedule_type})>"
