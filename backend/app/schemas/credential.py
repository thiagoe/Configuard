"""
Credential schemas (Pydantic models)
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class CredentialBase(BaseModel):
    """Base credential schema"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    username: str = Field(..., min_length=1, max_length=100)


class CredentialCreate(CredentialBase):
    """Credential creation schema - includes sensitive data"""
    password: Optional[str] = Field(None, min_length=1)
    private_key: Optional[str] = None
    passphrase: Optional[str] = None


class CredentialUpdate(BaseModel):
    """Credential update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    username: Optional[str] = Field(None, min_length=1, max_length=100)
    password: Optional[str] = None
    private_key: Optional[str] = None
    passphrase: Optional[str] = None


class CredentialResponse(BaseModel):
    """Credential response schema - excludes sensitive data"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    username: str
    has_password: bool = False
    has_private_key: bool = False
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_credential(cls, credential) -> "CredentialResponse":
        """Create response from Credential model"""
        return cls(
            id=credential.id,
            name=credential.name,
            description=credential.description,
            username=credential.username,
            has_password=bool(credential.password_encrypted),
            has_private_key=bool(credential.private_key_encrypted),
            created_at=credential.created_at,
            updated_at=credential.updated_at,
        )


class CredentialListResponse(BaseModel):
    """Paginated credential list response"""
    items: list[CredentialResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
