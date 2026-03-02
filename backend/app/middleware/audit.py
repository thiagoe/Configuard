"""
Audit logging middleware
"""

import re
import uuid
from typing import Callable, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.database import SessionLocal
from app.models.audit_log import AuditLog
from app.core.config import settings
from app.core.logging import get_audit_logger


audit_logger = get_audit_logger()

UUID_PATTERN = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


def _extract_table_name(path: str) -> Optional[str]:
    parts = [p for p in path.split("/") if p]
    if not parts:
        return None
    if parts[0] == "api":
        parts = parts[1:]
    return parts[0] if parts else None


def _extract_record_id(path: str) -> Optional[str]:
    match = UUID_PATTERN.search(path)
    if match:
        return match.group(0)
    return None


def _extract_user_id(request: Request) -> Optional[str]:
    if hasattr(request.state, "user_id"):
        return request.state.user_id

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.replace("Bearer ", "")
    if token == settings.API_TOKEN:
        return request.headers.get("X-User-Id") or None
    return None


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that records audit logs for mutating requests."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return response

        if request.url.path.startswith("/api/health"):
            return response

        user_id = _extract_user_id(request)
        table_name = _extract_table_name(request.url.path)
        record_id = _extract_record_id(request.url.path)

        client_ip = request.client.host if request.client else None
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()

        action = request.method
        new_data = {
            "path": request.url.path,
            "method": request.method,
            "status_code": response.status_code,
            "query": str(request.query_params) if request.query_params else None,
        }

        db = SessionLocal()
        try:
            audit = AuditLog(
                id=str(uuid.uuid4()),
                user_id=user_id,
                action=action,
                table_name=table_name,
                record_id=record_id,
                old_data=None,
                new_data=new_data,
                ip_address=client_ip,
                user_agent=request.headers.get("User-Agent"),
            )
            db.add(audit)
            db.commit()
        except Exception as exc:
            db.rollback()
            audit_logger.error(
                "Failed to write audit log",
                error=str(exc),
                path=request.url.path,
                method=request.method,
            )
        finally:
            db.close()

        return response
