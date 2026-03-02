"""
Authentication schemas (Pydantic models)
"""

from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, EmailStr, Field, ConfigDict


# Request schemas
class LoginRequest(BaseModel):
    """Login request schema — accepts email or sAMAccountName"""

    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class RegisterRequest(BaseModel):
    """Registration request schema"""

    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    full_name: Optional[str] = Field(None, max_length=255)


class RefreshTokenRequest(BaseModel):
    """Refresh token request schema"""

    refresh_token: str


class ChangePasswordRequest(BaseModel):
    """Change password request schema"""

    current_password: str
    new_password: str = Field(..., min_length=6, max_length=100)


# Response schemas
class UserResponse(BaseModel):
    """User response schema"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: Optional[str] = None
    role: Literal["admin", "moderator", "user"] = "user"
    is_active: bool = True
    created_at: datetime

    @classmethod
    def from_user(cls, user) -> "UserResponse":
        """Create response from User model"""
        return cls(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role_name,
            is_active=user.is_active,
            created_at=user.created_at,
        )


class TokenResponse(BaseModel):
    """Token response schema"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    """Full authentication response with user and tokens"""

    access_token: str
    refresh_token: Optional[str] = None  # None for LDAP users (no refresh token)
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    """Simple message response"""

    message: str
    success: bool = True
