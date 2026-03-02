"""
Timezone utilities for the application.
All datetime operations should use these functions for consistency.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import settings


def get_timezone() -> ZoneInfo:
    """Get the application timezone."""
    return ZoneInfo(settings.TIMEZONE)


def now() -> datetime:
    """Get current datetime in application timezone."""
    return datetime.now(get_timezone())


def now_utc() -> datetime:
    """Get current datetime in UTC with timezone info."""
    return datetime.now(ZoneInfo("UTC"))


def to_local(dt: datetime) -> datetime:
    """Convert datetime to application timezone."""
    if dt.tzinfo is None:
        # Assume UTC if no timezone
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt.astimezone(get_timezone())


def to_utc(dt: datetime) -> datetime:
    """Convert datetime to UTC."""
    if dt.tzinfo is None:
        # Assume local timezone if no timezone
        dt = dt.replace(tzinfo=get_timezone())
    return dt.astimezone(ZoneInfo("UTC"))
