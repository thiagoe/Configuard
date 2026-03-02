"""
BackupExecution schemas (Pydantic models)
"""

from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, ConfigDict


ExecutionStatusEnum = Literal["success", "failed", "timeout"]
TriggeredByEnum = Literal["manual", "scheduled"]
CollectionMethodEnum = Literal["ssh", "telnet", "scheduled"]


class BackupExecutionResponse(BaseModel):
    """Backup execution response schema"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    device_id: str
    user_id: str
    status: ExecutionStatusEnum
    error_message: Optional[str] = None
    configuration_id: Optional[str] = None
    config_changed: bool = False
    config_hash: Optional[str] = None
    collection_method: CollectionMethodEnum
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    triggered_by: TriggeredByEnum = "manual"
    schedule_id: Optional[str] = None
    created_at: datetime


class DeviceSimpleForExecution(BaseModel):
    """Simple device schema for embedding in execution response"""
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    ip_address: str


class BackupExecutionWithDeviceResponse(BackupExecutionResponse):
    """Backup execution response with embedded device info"""
    device: Optional[DeviceSimpleForExecution] = None


class BackupExecutionListResponse(BaseModel):
    """Paginated backup execution list response"""
    items: list[BackupExecutionWithDeviceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class BackupExecutionStatsResponse(BaseModel):
    """Statistics for backup executions"""
    total_executions: int
    successful_executions: int
    failed_executions: int
    configs_with_changes: int
    configs_without_changes: int
    success_rate: float
    change_rate: float  # Percentage of successful backups that had changes
