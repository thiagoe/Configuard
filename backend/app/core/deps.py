"""
FastAPI dependencies for authentication and authorization.
Authentication uses a static API token defined in .env (API_TOKEN).
"""

from dataclasses import dataclass, field
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.logging import get_auth_logger

auth_logger = get_auth_logger()

# HTTP Bearer token security scheme
security = HTTPBearer(auto_error=False)


@dataclass
class StaticUser:
    """
    Represents an authenticated user when the API token is valid.
    Role is resolved from the database using the X-User-Id header.
    """
    id: str = "api-user"
    email: str = "api@system"
    full_name: Optional[str] = "API User"
    is_active: bool = True
    _role: str = field(default="user", repr=False)

    @property
    def role_name(self) -> str:
        return self._role

    @property
    def is_admin(self) -> bool:
        return self._role == "admin"

    @property
    def is_moderator(self) -> bool:
        return self._role in ("admin", "moderator")


def _resolve_user(db: Session, user_id: Optional[str]) -> StaticUser:
    """
    Resolve the real user and their role from the database using the X-User-Id header.
    Falls back to the first active admin if not found (e.g. LDAP users without local account).
    """
    from app.models.user import User, UserRole

    if user_id:
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if user:
            user_role = db.query(UserRole).filter(UserRole.user_id == user.id).first()
            role = user_role.role if user_role else "user"
            return StaticUser(id=user.id, email=user.email, full_name=user.full_name, _role=role)

    # Fallback: first active admin
    admin = (
        db.query(User)
        .join(UserRole, User.id == UserRole.user_id)
        .filter(UserRole.role == "admin", User.is_active == True)
        .first()
    )
    if admin:
        return StaticUser(id=admin.id, email=admin.email, full_name=admin.full_name, _role="admin")
    return StaticUser(_role="admin")


async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[Session, Depends(get_db)],
    request: Request,
) -> StaticUser:
    """
    Validate the API token from the Authorization: Bearer header.
    Uses X-User-Id header to resolve the real user identity for audit logging.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    if not settings.API_TOKEN or token != settings.API_TOKEN:
        auth_logger.warning("Invalid API token attempt")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_header = request.headers.get("X-User-Id")
    static_user = _resolve_user(db, user_id_header)
    request.state.user_id = static_user.id
    request.state.user_email = static_user.email

    return static_user


async def get_current_user_optional(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[Session, Depends(get_db)],
    request: Request,
) -> Optional[StaticUser]:
    """Returns StaticUser if token is valid, None otherwise."""
    if not credentials:
        return None
    if credentials.credentials == settings.API_TOKEN:
        user_id_header = request.headers.get("X-User-Id")
        return _resolve_user(db, user_id_header)
    return None


async def get_current_admin(
    current_user: Annotated[StaticUser, Depends(get_current_user)],
) -> StaticUser:
    """Require admin role."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user


async def get_current_moderator(
    current_user: Annotated[StaticUser, Depends(get_current_user)],
) -> StaticUser:
    """Require moderator or admin role."""
    if not current_user.is_moderator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Moderator role required",
        )
    return current_user


# Type aliases for cleaner dependency injection
CurrentUser = Annotated[StaticUser, Depends(get_current_user)]
CurrentUserOptional = Annotated[Optional[StaticUser], Depends(get_current_user_optional)]
CurrentAdmin = Annotated[StaticUser, Depends(get_current_admin)]
CurrentModerator = Annotated[StaticUser, Depends(get_current_moderator)]
DbSession = Annotated[Session, Depends(get_db)]
