"""
Authentication API routes.
Login validates credentials (local or LDAP) and returns the static API token.
"""

from fastapi import APIRouter, HTTPException, status, Request

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.schemas.auth import LoginRequest, AuthResponse, MessageResponse, UserResponse
from app.services.auth import AuthService
from app.services.ldap_service import LDAPService, get_ldap_config
from app.core.logging import get_auth_logger
from app.models.user import User, UserRole

router = APIRouter()
auth_logger = get_auth_logger()


def _upsert_ldap_user(db, ldap_user: dict) -> User:
    """
    Create or update a local user record for an LDAP-authenticated user.
    This ensures the user has a real ID that can be used for audit logging.
    Password is set to a non-usable value since login is via LDAP.
    """
    from app.services.password import hash_password
    import uuid

    email = ldap_user["email"].lower()
    role = ldap_user.get("role", "user")
    full_name = ldap_user.get("full_name")

    user = db.query(User).filter(User.email == email).first()
    if user:
        # Update name if changed
        if full_name and user.full_name != full_name:
            user.full_name = full_name
        # Update role if changed
        if user.role and user.role.role != role:
            user.role.role = role
        db.commit()
        db.refresh(user)
        return user

    # Create new user (no usable password — LDAP only)
    user = User(
        email=email,
        password_hash=hash_password(str(uuid.uuid4())),
        full_name=full_name,
        is_active=True,
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role=role))
    db.commit()
    db.refresh(user)
    return user


def _get_client_info(request: Request) -> dict:
    client_ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    return {"ip_address": client_ip, "user_agent": request.headers.get("User-Agent")}


@router.post("/login", response_model=AuthResponse)
async def login(
    data: LoginRequest,
    db: DbSession,
    request: Request,
):
    """
    Authenticate with email/password (local or LDAP).
    Returns the static API token on success.
    """
    client_info = _get_client_info(request)
    auth_service = AuthService(db)
    login_input = data.email.strip()

    # 1. Try local authentication (only if input looks like an email)
    if "@" in login_input:
        user = auth_service.authenticate(login_input, data.password)
        if user:
            auth_logger.info("User logged in (local)", user_id=user.id, email=user.email, **client_info)
            return AuthResponse(
                access_token=settings.API_TOKEN,
                refresh_token=None,
                user=UserResponse.from_user(user),
            )

    # 2. Try LDAP if enabled
    ldap_config = get_ldap_config(db)
    if ldap_config.get("ldap_enabled") == "true" and ldap_config.get("ldap_server"):
        ldap_service = LDAPService(ldap_config)
        # Accept sAMAccountName directly or extract from email (user@domain → user)
        ldap_username = login_input.split("@")[0] if "@" in login_input else login_input
        ldap_user = ldap_service.authenticate(ldap_username, data.password)

        if ldap_user:
            auth_logger.info(
                "User logged in (LDAP)",
                username=ldap_username,
                email=ldap_user["email"],
                role=ldap_user["role"],
                **client_info,
            )
            # Upsert local user record so the ID can be used for audit logging
            local_user = _upsert_ldap_user(db, ldap_user)
            return AuthResponse(
                access_token=settings.API_TOKEN,
                refresh_token=None,
                user=UserResponse.from_user(local_user),
            )

    # 3. Both failed
    auth_logger.warning("Login failed", login=login_input, **client_info)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas",
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user: CurrentUser,
    request: Request,
):
    """
    Logout — no-op since the token is static and cannot be revoked.
    The frontend should discard the token from localStorage.
    """
    auth_logger.info("User logged out (token-based)", **_get_client_info(request))
    return MessageResponse(message="Logout realizado com sucesso")
