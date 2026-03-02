"""
API route definitions
"""

from fastapi import APIRouter

from app.api.routes import (
    health,
    auth,
    users,
    brands,
    categories,
    credentials,
    templates,
    devices,
    device_models,
    configurations,
    backup_executions,
    schedules,
    audit,
    admin,
    search,
)

api_router = APIRouter()

# Include route modules
api_router.include_router(health.router, prefix="/health", tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(brands.router, prefix="/brands", tags=["Brands"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(credentials.router, prefix="/credentials", tags=["Credentials"])
api_router.include_router(templates.router, prefix="/templates", tags=["Templates"])
api_router.include_router(devices.router, prefix="/devices", tags=["Devices"])
api_router.include_router(device_models.router, prefix="/device-models", tags=["Device Models"])
api_router.include_router(configurations.router, tags=["Configurations"])
api_router.include_router(backup_executions.router, prefix="/backup-executions", tags=["Backup Executions"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["Schedules"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(search.router, prefix="/search", tags=["Search"])

# Future routes will be added here:
# api_router.include_router(audit.router, prefix="/audit", tags=["Audit"])
# api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
