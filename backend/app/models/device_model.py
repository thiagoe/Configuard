"""
Device Model - Device models/types (e.g., Cisco 2960, MikroTik RB750)
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timezone import now


class DeviceModel(Base):
    """Device model - represents specific device models/types"""

    __tablename__ = "device_models"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    brand_id = Column(String(36), ForeignKey("brands.id"), nullable=True)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=True)
    created_at = Column(DateTime, default=now, nullable=False)
    updated_at = Column(DateTime, default=now, onupdate=now, nullable=False)

    # Relationships
    user = relationship("User", backref="device_models")
    brand = relationship("Brand", backref="device_models")
    category = relationship("Category", backref="device_models")
    devices = relationship("Device", back_populates="model")

    def __repr__(self):
        return f"<DeviceModel {self.name}>"
