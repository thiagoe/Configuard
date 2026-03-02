"""
Brand model - Network device manufacturers
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timezone import now


class Brand(Base):
    """Brand model for network device manufacturers"""

    __tablename__ = "brands"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    logo_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=now, nullable=False)
    updated_at = Column(DateTime, default=now, onupdate=now, nullable=False)

    # Relationships
    user = relationship("User", backref="brands")
    devices = relationship("Device", back_populates="brand")

    def __repr__(self):
        return f"<Brand {self.name}>"
