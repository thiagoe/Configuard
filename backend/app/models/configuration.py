"""
Configuration model - Device configuration snapshots
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timezone import now


class Configuration(Base):
    """Device configuration snapshot"""

    __tablename__ = "configurations"

    id = Column(String(36), primary_key=True)
    device_id = Column(String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)

    # Version tracking
    version = Column(Integer, nullable=False)

    # Configuration content
    config_data = Column(Text, nullable=False)
    config_hash = Column(String(64), nullable=False)  # SHA-256

    # Collection info
    collection_method = Column(String(20), default="ssh", nullable=False)  # ssh, telnet, api
    collected_at = Column(DateTime, default=now, nullable=False)
    collected_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    # Change detection
    changes_detected = Column(Boolean, default=False, nullable=False)
    previous_config_id = Column(String(36), ForeignKey("configurations.id"), nullable=True)

    # Storage info
    size_bytes = Column(Integer, nullable=True)
    lines_count = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=now, nullable=False)

    # Relationships
    device = relationship("Device", back_populates="configurations")
    collected_by_user = relationship("User", foreign_keys=[collected_by])
    previous_config = relationship("Configuration", remote_side=[id], foreign_keys=[previous_config_id])

    def __repr__(self):
        return f"<Configuration device={self.device_id} v{self.version}>"
