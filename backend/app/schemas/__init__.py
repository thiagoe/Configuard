"""
Schemas package - Pydantic models for request/response validation
"""

from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RefreshTokenRequest,
    ChangePasswordRequest,
    AuthResponse,
    MessageResponse,
)
from app.schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserUpdateAdmin,
    UserResponse,
    UserListResponse,
)
from app.schemas.brand import (
    BrandBase,
    BrandCreate,
    BrandUpdate,
    BrandResponse,
    BrandListResponse,
)
from app.schemas.category import (
    CategoryBase,
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    CategoryListResponse,
)
from app.schemas.credential import (
    CredentialBase,
    CredentialCreate,
    CredentialUpdate,
    CredentialResponse,
    CredentialListResponse,
)
from app.schemas.template import (
    TemplateStepBase,
    TemplateStepCreate,
    TemplateStepUpdate,
    TemplateStepResponse,
    BackupTemplateBase,
    BackupTemplateCreate,
    BackupTemplateUpdate,
    BackupTemplateResponse,
    BackupTemplateListResponse,
)
from app.schemas.device import (
    DeviceBase,
    DeviceCreate,
    DeviceUpdate,
    DeviceResponse,
    DeviceListResponse,
)
from app.schemas.configuration import (
    ConfigurationResponse,
    ConfigurationDetailResponse,
    ConfigurationListResponse,
    ConfigurationDiffResponse,
)
from app.schemas.schedule import (
    ScheduleBase,
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    ScheduleListResponse,
)
from app.schemas.audit import (
    AuditLogResponse,
    AuditLogListResponse,
)
from app.schemas.search import (
    SearchSnippet,
    SearchResult,
    SearchResponse,
)

__all__ = [
    # Auth
    "LoginRequest",
    "RegisterRequest",
    "RefreshTokenRequest",
    "ChangePasswordRequest",
    "AuthResponse",
    "MessageResponse",
    # User
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserUpdateAdmin",
    "UserResponse",
    "UserListResponse",
    # Brand
    "BrandBase",
    "BrandCreate",
    "BrandUpdate",
    "BrandResponse",
    "BrandListResponse",
    # Category
    "CategoryBase",
    "CategoryCreate",
    "CategoryUpdate",
    "CategoryResponse",
    "CategoryListResponse",
    # Credential
    "CredentialBase",
    "CredentialCreate",
    "CredentialUpdate",
    "CredentialResponse",
    "CredentialListResponse",
    # Template
    "TemplateStepBase",
    "TemplateStepCreate",
    "TemplateStepUpdate",
    "TemplateStepResponse",
    "BackupTemplateBase",
    "BackupTemplateCreate",
    "BackupTemplateUpdate",
    "BackupTemplateResponse",
    "BackupTemplateListResponse",
    # Device
    "DeviceBase",
    "DeviceCreate",
    "DeviceUpdate",
    "DeviceResponse",
    "DeviceListResponse",
    # Configuration
    "ConfigurationResponse",
    "ConfigurationDetailResponse",
    "ConfigurationListResponse",
    "ConfigurationDiffResponse",
    # Schedule
    "ScheduleBase",
    "ScheduleCreate",
    "ScheduleUpdate",
    "ScheduleResponse",
    "ScheduleListResponse",
    # Audit
    "AuditLogResponse",
    "AuditLogListResponse",
    # Search
    "SearchSnippet",
    "SearchResult",
    "SearchResponse",
]
