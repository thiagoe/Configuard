"""
Base model with common fields
"""

import uuid
from sqlalchemy import Column, String, DateTime

from app.core.database import Base
from app.core.timezone import now


def generate_uuid() -> str:
    """Generate a UUID string"""
    return str(uuid.uuid4())


class BaseModel(Base):
    """Abstract base model with common fields"""

    __abstract__ = True

    id = Column(String(36), primary_key=True, default=generate_uuid)
    created_at = Column(DateTime, default=now, nullable=False)
    updated_at = Column(DateTime, default=now, onupdate=now, nullable=False)
