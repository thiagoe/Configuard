"""
BackupExecution model - Records of backup execution attempts
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timezone import now


class BackupExecution(Base):
    """
    Record of a backup execution attempt.

    This table tracks every backup execution, regardless of whether the
    configuration changed. This provides:
    - Complete audit trail of backup attempts
    - Evidence that backups were running (for compliance)
    - Error tracking for failed backups
    - Statistics on backup frequency vs actual changes
    """

    __tablename__ = "backup_executions"

    id = Column(String(36), primary_key=True)
    device_id = Column(String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)

    # Execution result
    status = Column(String(20), nullable=False)  # success, failed, timeout
    error_message = Column(Text, nullable=True)

    # Configuration reference (only if changes were detected or first backup)
    configuration_id = Column(String(36), ForeignKey("configurations.id", ondelete="SET NULL"), nullable=True)

    # Change detection
    config_changed = Column(Boolean, default=False, nullable=False)
    config_hash = Column(String(64), nullable=True)  # SHA-256 hash of the collected config

    # Execution method
    collection_method = Column(String(20), nullable=False)  # ssh, telnet, scheduled

    # Timing
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    # Metadata
    triggered_by = Column(String(20), default="manual", nullable=False)  # manual, scheduled
    schedule_id = Column(String(36), ForeignKey("backup_schedules.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=now, nullable=False)

    # Relationships
    # passive_deletes=True lets the DB handle ON DELETE CASCADE (avoids SQLAlchemy setting device_id=NULL)
    device = relationship("Device", back_populates="backup_executions", passive_deletes=True)
    user = relationship("User", backref="backup_executions")
    configuration = relationship("Configuration", backref="backup_executions")
    schedule = relationship("BackupSchedule", backref="backup_executions")

    def __repr__(self):
        return f"<BackupExecution device={self.device_id} status={self.status}>"
