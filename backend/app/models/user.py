"""
User and UserRole models
"""

from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, generate_uuid
from app.core.database import Base
from app.core.timezone import now


class User(BaseModel):
    """User model"""

    __tablename__ = "users"

    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    role = relationship("UserRole", back_populates="user", uselist=False, lazy="joined")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email}>"

    @property
    def role_name(self) -> str:
        """Get user role name"""
        return self.role.role if self.role else "user"

    @property
    def is_admin(self) -> bool:
        """Check if user is admin"""
        return self.role_name == "admin"

    @property
    def is_moderator(self) -> bool:
        """Check if user is moderator or admin"""
        return self.role_name in ("admin", "moderator")


class UserRole(Base):
    """User role model"""

    __tablename__ = "user_roles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    role = Column(
        Enum("admin", "moderator", "user", name="app_role"),
        nullable=False,
        default="user"
    )
    created_at = Column(DateTime, default=now, nullable=False)
    updated_at = Column(DateTime, default=now, onupdate=now, nullable=False)

    # Relationships
    user = relationship("User", back_populates="role")

    def __repr__(self):
        return f"<UserRole {self.user_id}: {self.role}>"


class RefreshToken(Base):
    """Refresh token model for JWT authentication"""

    __tablename__ = "refresh_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now, nullable=False)

    # Relationships
    user = relationship("User", back_populates="refresh_tokens")

    def __repr__(self):
        return f"<RefreshToken {self.id}>"

    @property
    def is_expired(self) -> bool:
        """Check if token is expired"""
        return now() > self.expires_at

    @property
    def is_revoked(self) -> bool:
        """Check if token is revoked"""
        return self.revoked_at is not None

    @property
    def is_valid(self) -> bool:
        """Check if token is valid"""
        return not self.is_expired and not self.is_revoked
