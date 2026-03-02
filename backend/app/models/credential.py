"""
Credential model - Encrypted SSH/Telnet credentials
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timezone import now


class Credential(Base):
    """Credential model with encrypted sensitive data"""

    __tablename__ = "credentials"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    username = Column(String(100), nullable=False)

    # Encrypted fields (stored as base64 encoded encrypted data)
    password_encrypted = Column(Text, nullable=True)
    private_key_encrypted = Column(Text, nullable=True)
    passphrase_encrypted = Column(Text, nullable=True)

    # Additional settings
    port = Column(String(5), nullable=True)  # Override default port

    created_at = Column(DateTime, default=now, nullable=False)
    updated_at = Column(DateTime, default=now, onupdate=now, nullable=False)

    # Relationships
    user = relationship("User", backref="credentials")
    devices = relationship("Device", back_populates="credential")

    def __repr__(self):
        return f"<Credential {self.name}>"
