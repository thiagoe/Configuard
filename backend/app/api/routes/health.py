"""
Health check endpoints
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.core.config import settings
from app.core.logging import logger

router = APIRouter()


@router.get("")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/db")
async def database_health(db: Session = Depends(get_db)):
    """Database connectivity health check"""
    try:
        result = db.execute(text("SELECT 1"))
        result.fetchone()
        return {
            "status": "healthy",
            "database": "connected",
            "host": settings.DB_HOST,
            "database_name": settings.DB_NAME,
        }
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
        }


@router.get("/ready")
async def readiness_check(db: Session = Depends(get_db)):
    """Readiness probe for orchestration systems"""
    checks = {
        "database": False,
    }

    # Check database
    try:
        result = db.execute(text("SELECT 1"))
        result.fetchone()
        checks["database"] = True
    except Exception as e:
        logger.error("Readiness check - database failed", error=str(e))

    all_healthy = all(checks.values())

    return {
        "status": "ready" if all_healthy else "not_ready",
        "checks": checks,
    }
