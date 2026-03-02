"""
Admin API routes (admin only)
"""

from fastapi import APIRouter, HTTPException

from app.core.deps import CurrentAdmin, DbSession
from app.models import (
    User,
    Brand,
    Category,
    Credential,
    BackupTemplate,
    Device,
    Configuration,
    BackupSchedule,
    AuditLog,
    SystemSetting,
    DEFAULT_SETTINGS,
)
from app.schemas.system_setting import (
    SystemSettingsResponse,
    SystemSettingUpdate,
    EmailSettingsResponse,
    EmailSettingsUpdate,
)
from app.schemas.ldap import LdapSettingsResponse, LdapSettingsUpdate, LdapTestRequest, LdapTestResponse, LdapGroupMapping
from app.services.encryption import encrypt, is_encrypted
from app.services.email import test_email_connection
from app.services.ldap_service import LDAPService, get_ldap_config

router = APIRouter()


def _get_setting(db: DbSession, key: str) -> str:
    """Get a system setting value, creating it with default if not exists."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if setting:
        return setting.value
    # Create with default value
    default = DEFAULT_SETTINGS.get(key, {"value": "", "description": ""})
    new_setting = SystemSetting(
        key=key,
        value=default["value"],
        description=default["description"]
    )
    db.add(new_setting)
    db.commit()
    return default["value"]


@router.get("/db-stats")
async def get_db_stats(current_admin: CurrentAdmin, db: DbSession):
    """
    Basic database statistics for admin dashboard.
    """
    from sqlalchemy import text
    size_result = db.execute(text("SELECT pg_database_size(current_database())")).scalar()
    return {
        "users": db.query(User).count(),
        "brands": db.query(Brand).count(),
        "categories": db.query(Category).count(),
        "credentials": db.query(Credential).count(),
        "templates": db.query(BackupTemplate).count(),
        "devices": db.query(Device).count(),
        "configurations": db.query(Configuration).count(),
        "schedules": db.query(BackupSchedule).count(),
        "audit_logs": db.query(AuditLog).count(),
        "db_size_bytes": size_result or 0,
    }


@router.get("/settings", response_model=SystemSettingsResponse)
async def get_system_settings(current_admin: CurrentAdmin, db: DbSession):
    """
    Get all system settings.
    """
    retention_versions = _get_setting(db, "retention_versions")
    audit_retention_days = _get_setting(db, "audit_retention_days")
    return SystemSettingsResponse(
        retention_versions=int(retention_versions) if retention_versions else 10,
        audit_retention_days=int(audit_retention_days) if audit_retention_days else 90
    )


@router.patch("/settings/retention_versions")
async def update_retention_versions(
    data: SystemSettingUpdate,
    current_admin: CurrentAdmin,
    db: DbSession
):
    """
    Update the global retention versions setting.
    """
    try:
        value = int(data.value)
        if value < 1 or value > 1000:
            raise ValueError("Value must be between 1 and 1000")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    setting = db.query(SystemSetting).filter(SystemSetting.key == "retention_versions").first()
    if setting:
        setting.value = data.value
    else:
        setting = SystemSetting(
            key="retention_versions",
            value=data.value,
            description=DEFAULT_SETTINGS["retention_versions"]["description"]
        )
        db.add(setting)
    db.commit()
    return {"key": "retention_versions", "value": data.value}


@router.patch("/settings/audit_retention_days")
async def update_audit_retention_days(
    data: SystemSettingUpdate,
    current_admin: CurrentAdmin,
    db: DbSession
):
    """
    Update the audit log retention days setting.
    """
    try:
        value = int(data.value)
        if value < 1 or value > 3650:
            raise ValueError("Value must be between 1 and 3650 (10 years)")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    setting = db.query(SystemSetting).filter(SystemSetting.key == "audit_retention_days").first()
    if setting:
        setting.value = data.value
    else:
        setting = SystemSetting(
            key="audit_retention_days",
            value=data.value,
            description=DEFAULT_SETTINGS["audit_retention_days"]["description"]
        )
        db.add(setting)
    db.commit()
    return {"key": "audit_retention_days", "value": data.value}


def _upsert_setting(db: DbSession, key: str, value: str) -> None:
    """Insert or update a system setting."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if setting:
        setting.value = value
    else:
        default = DEFAULT_SETTINGS.get(key, {"value": "", "description": ""})
        db.add(SystemSetting(key=key, value=value, description=default["description"]))


@router.get("/settings/email", response_model=EmailSettingsResponse)
async def get_email_settings(current_admin: CurrentAdmin, db: DbSession):
    """Get email notification settings. SMTP password is never returned."""
    def gs(key: str, default: str = "") -> str:
        return _get_setting(db, key) or default

    smtp_password_raw = gs("smtp_password")
    password_set = bool(smtp_password_raw)

    return EmailSettingsResponse(
        email_enabled=gs("email_enabled") == "true",
        smtp_host=gs("smtp_host"),
        smtp_port=int(gs("smtp_port") or 587),
        smtp_use_tls=gs("smtp_use_tls", "true") == "true",
        smtp_username=gs("smtp_username"),
        smtp_password_set=password_set,
        email_sender=gs("email_sender"),
        email_recipients=gs("email_recipients"),
        notify_backup_failed=gs("notify_backup_failed", "true") == "true",
        notify_backup_success=gs("notify_backup_success") == "true",
        notify_device_disabled=gs("notify_device_disabled", "true") == "true",
        notify_device_deleted=gs("notify_device_deleted", "true") == "true",
    )


@router.patch("/settings/email", response_model=EmailSettingsResponse)
async def update_email_settings(
    data: EmailSettingsUpdate,
    current_admin: CurrentAdmin,
    db: DbSession,
):
    """Update email notification settings."""
    _upsert_setting(db, "email_enabled", "true" if data.email_enabled else "false")
    _upsert_setting(db, "smtp_host", data.smtp_host)
    _upsert_setting(db, "smtp_port", str(data.smtp_port))
    _upsert_setting(db, "smtp_use_tls", "true" if data.smtp_use_tls else "false")
    _upsert_setting(db, "smtp_username", data.smtp_username)
    _upsert_setting(db, "email_sender", data.email_sender)
    _upsert_setting(db, "email_recipients", data.email_recipients)
    _upsert_setting(db, "notify_backup_failed", "true" if data.notify_backup_failed else "false")
    _upsert_setting(db, "notify_backup_success", "true" if data.notify_backup_success else "false")
    _upsert_setting(db, "notify_device_disabled", "true" if data.notify_device_disabled else "false")
    _upsert_setting(db, "notify_device_deleted", "true" if data.notify_device_deleted else "false")

    # Only update password if a new one was provided (non-empty string)
    if data.smtp_password:
        encrypted_pwd = encrypt(data.smtp_password)
        _upsert_setting(db, "smtp_password", encrypted_pwd)

    db.commit()

    return await get_email_settings(current_admin, db)


@router.post("/settings/email/test")
async def test_email_settings(current_admin: CurrentAdmin, db: DbSession):
    """Send a test email using the current SMTP configuration."""
    result = test_email_connection(db)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


# ---------------------------------------------------------------------------
# LDAP / Active Directory settings
# ---------------------------------------------------------------------------

@router.get("/settings/ldap", response_model=LdapSettingsResponse)
async def get_ldap_settings(current_admin: CurrentAdmin, db: DbSession):
    """Get LDAP configuration. Bind password is never returned in plain text."""
    import json

    def gs(key: str, default: str = "") -> str:
        return _get_setting(db, key) or default

    bind_password_raw = gs("ldap_bind_password")
    password_set = bool(bind_password_raw)

    mappings_raw = gs("ldap_group_mappings", "[]")
    try:
        mappings = [LdapGroupMapping(**m) for m in json.loads(mappings_raw)]
    except Exception:
        mappings = []

    return LdapSettingsResponse(
        ldap_enabled=gs("ldap_enabled") == "true",
        ldap_server=gs("ldap_server"),
        ldap_port=int(gs("ldap_port") or 389),
        ldap_use_ssl=gs("ldap_use_ssl") == "true",
        ldap_use_starttls=gs("ldap_use_starttls") == "true",
        ldap_bind_dn=gs("ldap_bind_dn"),
        ldap_bind_password_set=password_set,
        ldap_base_dn=gs("ldap_base_dn"),
        ldap_user_filter=gs("ldap_user_filter", "(&(objectClass=person)(sAMAccountName={username}))"),
        ldap_username_attr=gs("ldap_username_attr", "sAMAccountName"),
        ldap_email_attr=gs("ldap_email_attr", "mail"),
        ldap_display_name_attr=gs("ldap_display_name_attr", "displayName"),
        ldap_group_search_base=gs("ldap_group_search_base"),
        ldap_group_search_filter=gs("ldap_group_search_filter", "(&(objectClass=group)(member={dn}))"),
        ldap_group_mappings=mappings,
        ldap_default_role=gs("ldap_default_role", "user"),
        ldap_access_token_ttl=int(gs("ldap_access_token_ttl") or 480),
    )


@router.patch("/settings/ldap", response_model=LdapSettingsResponse)
async def update_ldap_settings(
    data: LdapSettingsUpdate,
    current_admin: CurrentAdmin,
    db: DbSession,
):
    """Update LDAP configuration. If ldap_bind_password is None/empty, keep existing."""
    import json

    _upsert_setting(db, "ldap_enabled", "true" if data.ldap_enabled else "false")
    _upsert_setting(db, "ldap_server", data.ldap_server)
    _upsert_setting(db, "ldap_port", str(data.ldap_port))
    _upsert_setting(db, "ldap_use_ssl", "true" if data.ldap_use_ssl else "false")
    _upsert_setting(db, "ldap_use_starttls", "true" if data.ldap_use_starttls else "false")
    _upsert_setting(db, "ldap_bind_dn", data.ldap_bind_dn)
    _upsert_setting(db, "ldap_base_dn", data.ldap_base_dn)
    _upsert_setting(db, "ldap_user_filter", data.ldap_user_filter)
    _upsert_setting(db, "ldap_username_attr", data.ldap_username_attr)
    _upsert_setting(db, "ldap_email_attr", data.ldap_email_attr)
    _upsert_setting(db, "ldap_display_name_attr", data.ldap_display_name_attr)
    _upsert_setting(db, "ldap_group_search_base", data.ldap_group_search_base)
    _upsert_setting(db, "ldap_group_search_filter", data.ldap_group_search_filter)
    _upsert_setting(db, "ldap_group_mappings", json.dumps([m.model_dump() for m in data.ldap_group_mappings]))
    _upsert_setting(db, "ldap_default_role", data.ldap_default_role)
    _upsert_setting(db, "ldap_access_token_ttl", str(data.ldap_access_token_ttl))

    if data.ldap_bind_password:
        _upsert_setting(db, "ldap_bind_password", encrypt(data.ldap_bind_password))

    db.commit()
    return await get_ldap_settings(current_admin, db)


@router.post("/settings/ldap/test", response_model=LdapTestResponse)
async def test_ldap_connection(
    body: LdapTestRequest,
    current_admin: CurrentAdmin,
    db: DbSession,
):
    """Test LDAP connection using current configuration."""
    config = get_ldap_config(db)
    if config.get("ldap_enabled") == "false" or not config.get("ldap_server"):
        # Still allow testing even if disabled
        if not config.get("ldap_server"):
            return LdapTestResponse(success=False, message="Servidor LDAP não configurado")

    service = LDAPService(config)
    result = service.test_connection(test_username=body.test_username or None)
    return LdapTestResponse(**result)
