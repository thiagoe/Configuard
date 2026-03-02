"""
Audit log schemas (Pydantic models)
"""

from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, ConfigDict


class UserInfo(BaseModel):
    """User info for audit log"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: Optional[str] = None


class AuditLogResponse(BaseModel):
    """Audit log response schema"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: Optional[str] = None
    action: str
    table_name: Optional[str] = None
    record_id: Optional[str] = None
    old_data: Optional[Any] = None
    new_data: Optional[Any] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime
    user: Optional[UserInfo] = None


class AuditLogListResponse(BaseModel):
    """Paginated audit log list response"""
    items: list[AuditLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
