"""
User schemas (Pydantic models)
"""

from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserBase(BaseModel):
    """Base user schema"""

    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, max_length=255)


class UserCreate(BaseModel):
    """User creation schema"""

    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    full_name: Optional[str] = Field(None, max_length=255)
    role: Literal["admin", "moderator", "user"] = "user"


class UserUpdate(BaseModel):
    """User update schema"""

    full_name: Optional[str] = Field(None, max_length=255)


class UserUpdateAdmin(BaseModel):
    """Admin user update schema"""

    full_name: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None
    role: Optional[Literal["admin", "moderator", "user"]] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)


class UserResponse(BaseModel):
    """User response schema"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: Optional[str] = None
    role: Literal["admin", "moderator", "user"] = "user"
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

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
            updated_at=user.updated_at,
        )


class UserListResponse(BaseModel):
    """Paginated user list response"""

    items: list[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
