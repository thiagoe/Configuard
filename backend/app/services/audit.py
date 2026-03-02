"""
Audit service - Records detailed changes to entities
"""

import uuid
from typing import Any, Optional
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.core.logging import get_audit_logger

audit_logger = get_audit_logger()


def _serialize_value(value: Any) -> Any:
    """Convert value to JSON-serializable format."""
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if hasattr(value, 'isoformat'):  # datetime
        return value.isoformat()
    if hasattr(value, '__dict__'):
        return str(value)
    return str(value)


def _get_changes(old_data: dict, new_data: dict) -> dict:
    """
    Compare old and new data, return only changed fields.
    Returns dict with format: {field: {old: value, new: value}}
    """
    changes = {}

    # Fields to ignore in comparison
    ignore_fields = {'updated_at', 'created_at', 'id', 'user_id', 'password_hash'}

    all_keys = set(old_data.keys()) | set(new_data.keys())

    for key in all_keys:
        if key in ignore_fields:
            continue

        old_val = old_data.get(key)
        new_val = new_data.get(key)

        # Normalize None and empty string for comparison
        if old_val == '' and new_val is None:
            continue
        if old_val is None and new_val == '':
            continue

        if old_val != new_val:
            changes[key] = {
                'old': _serialize_value(old_val),
                'new': _serialize_value(new_val)
            }

    return changes


def model_to_dict(model: Any, exclude: set = None) -> dict:
    """Convert SQLAlchemy model to dictionary."""
    if model is None:
        return {}

    exclude = exclude or set()
    result = {}

    for column in model.__table__.columns:
        if column.name not in exclude:
            value = getattr(model, column.name, None)
            result[column.name] = _serialize_value(value)

    return result


def log_create(
    db: Session,
    user_id: str,
    table_name: str,
    record_id: str,
    new_data: dict,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """Log a CREATE action with the new entity data."""

    # Remove sensitive fields
    safe_data = {k: v for k, v in new_data.items()
                 if k not in {'password', 'password_hash', 'encryption_key'}}

    audit = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        action="CREATE",
        table_name=table_name,
        record_id=record_id,
        old_data=None,
        new_data=safe_data,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.add(audit)

    audit_logger.info(
        f"CREATE {table_name}",
        user_id=user_id,
        record_id=record_id,
        data=safe_data,
    )

    return audit


def log_update(
    db: Session,
    user_id: str,
    table_name: str,
    record_id: str,
    old_data: dict,
    new_data: dict,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Optional[AuditLog]:
    """Log an UPDATE action with old and new values for changed fields."""

    # Remove sensitive fields
    safe_old = {k: v for k, v in old_data.items()
                if k not in {'password', 'password_hash', 'encryption_key'}}
    safe_new = {k: v for k, v in new_data.items()
                if k not in {'password', 'password_hash', 'encryption_key'}}

    # Get only the changes
    changes = _get_changes(safe_old, safe_new)

    if not changes:
        return None  # No actual changes

    audit = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        action="UPDATE",
        table_name=table_name,
        record_id=record_id,
        old_data={"changes": changes},
        new_data={"fields_changed": list(changes.keys())},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.add(audit)

    audit_logger.info(
        f"UPDATE {table_name}",
        user_id=user_id,
        record_id=record_id,
        changes=changes,
    )

    return audit


def log_delete(
    db: Session,
    user_id: str,
    table_name: str,
    record_id: str,
    old_data: dict,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """Log a DELETE action with the deleted entity data."""

    # Remove sensitive fields
    safe_data = {k: v for k, v in old_data.items()
                 if k not in {'password', 'password_hash', 'encryption_key'}}

    audit = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        action="DELETE",
        table_name=table_name,
        record_id=record_id,
        old_data=safe_data,
        new_data=None,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.add(audit)

    audit_logger.info(
        f"DELETE {table_name}",
        user_id=user_id,
        record_id=record_id,
        deleted_data=safe_data,
    )

    return audit


def log_action(
    db: Session,
    user_id: str,
    action: str,
    table_name: Optional[str] = None,
    record_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """Log a custom action (login, logout, backup, etc.)."""

    audit = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_data=None,
        new_data=details,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.add(audit)

    audit_logger.info(
        action,
        user_id=user_id,
        table_name=table_name,
        record_id=record_id,
        details=details,
    )

    return audit
