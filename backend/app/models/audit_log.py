"""
Audit log model - Records security-relevant actions
"""

from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timezone import now


class AuditLog(Base):
    """Audit log entry"""

    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(50), nullable=False)
    table_name = Column(String(100), nullable=True)
    record_id = Column(String(36), nullable=True)
    old_data = Column(JSON, nullable=True)
    new_data = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now, nullable=False)

    user = relationship("User")

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} {self.table_name} {self.record_id}>"
