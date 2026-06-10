"""
FastAPI dependencies for authentication and authorization.
Authentication uses a static API token defined in .env (API_TOKEN).
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.logging import get_auth_logger
from app.core.timezone import now

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
    created_at: datetime = field(default_factory=now)
    updated_at: datetime = field(default_factory=now)
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


def resolve_user_from_token(db: Session, token: Optional[str]) -> Optional[StaticUser]:
    """
    Decode a per-user JWT and load the user + current role from the database.

    The user id comes from the signed token's `sub` claim — never from a
    client-supplied header. Role and is_active are re-read from the DB so that
    deactivation / role changes take effect immediately. Returns None if the
    token is invalid/expired or the user no longer exists or is inactive.
    """
    from app.models.user import User, UserRole
    from app.core.security import decode_access_token

    if not token:
        return None

    payload = decode_access_token(token)
    if not payload:
        return None

    user = db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()
    if not user:
        return None

    user_role = db.query(UserRole).filter(UserRole.user_id == user.id).first()
    role = user_role.role if user_role else "user"
    return StaticUser(
        id=user.id, email=user.email, full_name=user.full_name,
        created_at=user.created_at, updated_at=user.updated_at, _role=role,
    )


async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[Session, Depends(get_db)],
    request: Request,
) -> StaticUser:
    """
    Authenticate via a per-user JWT in the Authorization: Bearer header.
    Identity and role are derived from the signed token, not from any header.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = resolve_user_from_token(db, credentials.credentials)
    if user is None:
        auth_logger.warning("Invalid or expired token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    request.state.user_id = user.id
    request.state.user_email = user.email
    return user


async def get_current_user_optional(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[Session, Depends(get_db)],
    request: Request,
) -> Optional[StaticUser]:
    """Returns StaticUser if the JWT is valid, None otherwise."""
    if not credentials:
        return None
    return resolve_user_from_token(db, credentials.credentials)


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


def user_id_filter(model, user: "StaticUser"):
    """Return SQLAlchemy filter for user isolation. Admins see all rows."""
    if user.is_admin:
        return None
    return model.user_id == user.id


# Type aliases for cleaner dependency injection
CurrentUser = Annotated[StaticUser, Depends(get_current_user)]
CurrentUserOptional = Annotated[Optional[StaticUser], Depends(get_current_user_optional)]
CurrentAdmin = Annotated[StaticUser, Depends(get_current_admin)]
CurrentModerator = Annotated[StaticUser, Depends(get_current_moderator)]
DbSession = Annotated[Session, Depends(get_db)]
