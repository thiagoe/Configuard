"""
System settings model - Global configuration settings
"""

from sqlalchemy import Column, String, Text, DateTime

from app.core.database import Base
from app.core.timezone import now


class SystemSetting(Base):
    """System-wide configuration settings stored as key-value pairs"""

    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=now, onupdate=now, nullable=False)

    def __repr__(self):
        return f"<SystemSetting {self.key}={self.value}>"


# Default settings
DEFAULT_SETTINGS = {
    "retention_versions": {
        "value": "10",
        "description": "Número máximo de versões de backup por dispositivo (padrão)"
    },
    "audit_retention_days": {
        "value": "90",
        "description": "Número de dias para manter logs de auditoria"
    },
    # Email notification settings
    "email_enabled": {"value": "false", "description": "Habilitar notificações por email"},
    "smtp_host": {"value": "", "description": "Servidor SMTP"},
    "smtp_port": {"value": "587", "description": "Porta SMTP"},
    "smtp_use_tls": {"value": "true", "description": "Usar TLS/STARTTLS"},
    "smtp_username": {"value": "", "description": "Usuário SMTP"},
    "smtp_password": {"value": "", "description": "Senha SMTP (criptografada com AES-256-GCM)"},
    "email_sender": {"value": "", "description": "Email remetente (From)"},
    "email_recipients": {"value": "", "description": "Destinatários separados por ponto-e-vírgula"},
    "notify_backup_failed": {"value": "true", "description": "Notificar falha em backup agendado"},
    "notify_backup_success": {"value": "false", "description": "Notificar sucesso em backup agendado"},
    "notify_device_disabled": {"value": "true", "description": "Notificar quando host for desativado"},
    "notify_device_deleted": {"value": "true", "description": "Notificar quando host for excluído"},
    # LDAP / Active Directory settings
    "ldap_enabled": {"value": "false", "description": "Habilitar autenticação LDAP/AD"},
    "ldap_server": {"value": "", "description": "Servidor LDAP (hostname ou IP)"},
    "ldap_port": {"value": "389", "description": "Porta LDAP"},
    "ldap_use_ssl": {"value": "false", "description": "Usar SSL (LDAPS, porta 636)"},
    "ldap_use_starttls": {"value": "false", "description": "Usar STARTTLS"},
    "ldap_bind_dn": {"value": "", "description": "DN da conta de serviço (Bind DN)"},
    "ldap_bind_password": {"value": "", "description": "Senha da conta de serviço (criptografada)"},
    "ldap_base_dn": {"value": "", "description": "DN base para busca de usuários"},
    "ldap_user_filter": {"value": "(&(objectClass=person)(sAMAccountName={username}))", "description": "Filtro de busca de usuários"},
    "ldap_username_attr": {"value": "sAMAccountName", "description": "Atributo de nome de usuário"},
    "ldap_email_attr": {"value": "mail", "description": "Atributo de email"},
    "ldap_display_name_attr": {"value": "displayName", "description": "Atributo de nome de exibição"},
    "ldap_group_search_base": {"value": "", "description": "DN base para busca de grupos"},
    "ldap_group_search_filter": {"value": "(&(objectClass=group)(member={dn}))", "description": "Filtro para buscar grupos do usuário"},
    "ldap_group_mappings": {"value": "[]", "description": "Mapeamento grupo DN -> role (JSON array)"},
    "ldap_default_role": {"value": "user", "description": "Role padrão para usuários LDAP sem grupo mapeado"},
    "ldap_access_token_ttl": {"value": "480", "description": "Duração do token LDAP em minutos (padrão 8h)"},
}
