"""
Backup schedule schemas (Pydantic models)
"""

from datetime import datetime, time
from typing import Optional, Literal

from pydantic import BaseModel, Field, ConfigDict


ScheduleTypeEnum = Literal["daily", "weekly", "monthly", "cron"]


class ScheduleBase(BaseModel):
    """Base schedule schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    schedule_type: ScheduleTypeEnum = "daily"
    cron_expression: Optional[str] = Field(None, max_length=100)
    time_of_day: Optional[time] = Field(default=time(2, 0))
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    is_active: bool = True
    device_ids: list[str] = []
    category_ids: list[str] = []  # Categories to include all their devices


class ScheduleCreate(ScheduleBase):
    """Schedule creation schema"""
    pass


class ScheduleUpdate(BaseModel):
    """Schedule update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    schedule_type: Optional[ScheduleTypeEnum] = None
    cron_expression: Optional[str] = Field(None, max_length=100)
    time_of_day: Optional[time] = None
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    is_active: Optional[bool] = None
    device_ids: Optional[list[str]] = None
    category_ids: Optional[list[str]] = None


class ScheduleResponse(ScheduleBase):
    """Schedule response schema"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_schedule(cls, schedule) -> "ScheduleResponse":
        return cls(
            id=schedule.id,
            name=schedule.name,
            description=schedule.description,
            schedule_type=schedule.schedule_type.value if hasattr(schedule.schedule_type, "value") else schedule.schedule_type,
            cron_expression=schedule.cron_expression,
            time_of_day=schedule.time_of_day,
            day_of_week=schedule.day_of_week,
            day_of_month=schedule.day_of_month,
            is_active=schedule.is_active,
            device_ids=[device.id for device in schedule.devices],
            category_ids=[category.id for category in schedule.categories],
            last_run_at=schedule.last_run_at,
            next_run_at=schedule.next_run_at,
            created_at=schedule.created_at,
            updated_at=schedule.updated_at,
        )


class ScheduleListResponse(BaseModel):
    """Paginated schedule list response"""
    items: list[ScheduleResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
