"""
Category model - Device categories/types
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timezone import now


class Category(Base):
    """Category model for device classification"""

    __tablename__ = "categories"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), nullable=True)  # Hex color like #FF5733
    icon = Column(String(50), nullable=True)  # Icon name
    created_at = Column(DateTime, default=now, nullable=False)
    updated_at = Column(DateTime, default=now, onupdate=now, nullable=False)

    # Relationships
    user = relationship("User", backref="categories")
    devices = relationship("Device", back_populates="category")

    def __repr__(self):
        return f"<Category {self.name}>"
