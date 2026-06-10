"""
JWT helpers for per-user authentication.

Replaces the previous shared static API token. Each authenticated user gets a
signed token carrying their identity (sub) and role. The backend never trusts a
client-supplied X-User-Id header anymore.
"""

from datetime import timedelta
from typing import Optional

from jose import jwt, JWTError

from app.core.config import settings
from app.core.timezone import now


def _secret() -> str:
    """Resolve the signing secret, falling back to API_TOKEN for safety in dev."""
    return settings.JWT_SECRET_KEY or settings.API_TOKEN


def create_access_token(user_id: str, email: str, role: str) -> str:
    """Sign a short-lived access token for a user."""
    issued = now()
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "iat": issued,
        "exp": issued + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, _secret(), algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Validate signature + expiry and return the payload, or None if invalid.
    Returns None for the wrong token type or any decode error.
    """
    try:
        payload = jwt.decode(token, _secret(), algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
    if payload.get("type") != "access" or not payload.get("sub"):
        return None
    return payload
