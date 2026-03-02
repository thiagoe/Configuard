"""
Logging configuration using Loguru

Log files:
- app.log: General application logs
- api.log: API request/response logs
- auth.log: Authentication events
- backup.log: Backup execution logs
- audit.log: Security audit trail
- error.log: Error-only logs
"""

import sys
import os
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict
from contextvars import ContextVar

from loguru import logger

from app.core.config import settings

# Context variable for request ID tracking
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")


def get_request_id() -> str:
    """Get current request ID from context"""
    return request_id_ctx.get()


def set_request_id(request_id: str) -> None:
    """Set request ID in context"""
    request_id_ctx.set(request_id)


def custom_json_patcher(record: Dict[str, Any]) -> None:
    """Patch log record with additional fields for JSON serialization."""
    record["extra"]["request_id"] = get_request_id() or None


# Standard format for file logs (non-JSON)
FILE_FORMAT = "{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {module}:{function}:{line} | {message} | {extra}"


def setup_logging() -> None:
    """Configure logging with multiple handlers"""

    # Create logs directory
    log_dir = Path(settings.LOG_DIR)
    log_dir.mkdir(parents=True, exist_ok=True)

    # Remove default handler
    logger.remove()

    # Console handler (development)
    if settings.DEBUG:
        logger.add(
            sys.stdout,
            level="DEBUG",
            format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{module}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | {message}",
            colorize=True,
        )
    else:
        logger.add(
            sys.stdout,
            level="INFO",
            format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {module}:{function}:{line} | {message}",
            colorize=False,
        )

    # Common rotation and retention settings
    rotation = "00:00"  # Daily rotation at midnight
    retention = f"{settings.LOG_RETENTION_DAYS} days"
    compression = "gz"

    # Configure logger to add request_id to all records
    logger.configure(patcher=custom_json_patcher)

    # App log - General application logs (JSON format)
    logger.add(
        log_dir / "app.log",
        level=settings.LOG_LEVEL,
        format=FILE_FORMAT,
        rotation=rotation,
        retention=retention,
        compression=compression,
        enqueue=True,
    )

    # API log - Request/response logs
    logger.add(
        log_dir / "api.log",
        level="INFO",
        format=FILE_FORMAT,
        rotation=rotation,
        retention=retention,
        compression=compression,
        filter=lambda record: record["extra"].get("log_type") == "api",
        enqueue=True,
    )

    # Auth log - Authentication events
    logger.add(
        log_dir / "auth.log",
        level="INFO",
        format=FILE_FORMAT,
        rotation=rotation,
        retention=retention,
        compression=compression,
        filter=lambda record: record["extra"].get("log_type") == "auth",
        enqueue=True,
    )

    # Backup log - Backup execution logs
    logger.add(
        log_dir / "backup.log",
        level="DEBUG",
        format=FILE_FORMAT,
        rotation=rotation,
        retention=retention,
        compression=compression,
        filter=lambda record: record["extra"].get("log_type") == "backup",
        enqueue=True,
    )

    # Audit log - Security audit trail
    logger.add(
        log_dir / "audit.log",
        level="INFO",
        format=FILE_FORMAT,
        rotation=rotation,
        retention=retention,
        compression=compression,
        filter=lambda record: record["extra"].get("log_type") == "audit",
        enqueue=True,
    )

    # Error log - Errors only
    logger.add(
        log_dir / "error.log",
        level="ERROR",
        format=FILE_FORMAT,
        rotation=rotation,
        retention=retention,
        compression=compression,
        enqueue=True,
        backtrace=True,
        diagnose=True,
    )

    logger.info(
        f"Logging initialized",
        log_dir=str(log_dir),
        log_level=settings.LOG_LEVEL,
        retention_days=settings.LOG_RETENTION_DAYS,
    )


# Logger instances for different log types
def get_api_logger():
    """Get logger for API requests"""
    return logger.bind(log_type="api")


def get_auth_logger():
    """Get logger for authentication events"""
    return logger.bind(log_type="auth")


def get_backup_logger():
    """Get logger for backup operations"""
    return logger.bind(log_type="backup")


def get_audit_logger():
    """Get logger for audit trail"""
    return logger.bind(log_type="audit")


# Export main logger and specialized loggers
__all__ = [
    "logger",
    "setup_logging",
    "get_api_logger",
    "get_auth_logger",
    "get_backup_logger",
    "get_audit_logger",
    "get_request_id",
    "set_request_id",
]
