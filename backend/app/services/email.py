"""
Email notification service for Configuard.
Sends notifications for backup failures, successes, host deactivation, and deletion.
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from sqlalchemy.orm import Session

from app.models.system_setting import SystemSetting
from app.services.encryption import decrypt, is_encrypted
from app.core.logging import get_backup_logger


backup_logger = get_backup_logger()

_EMAIL_SETTING_KEYS = [
    "email_enabled",
    "smtp_host",
    "smtp_port",
    "smtp_use_tls",
    "smtp_username",
    "smtp_password",
    "email_sender",
    "email_recipients",
    "notify_backup_failed",
    "notify_backup_success",
    "notify_device_disabled",
    "notify_device_deleted",
]


def _get_email_settings(db: Session) -> dict:
    """Load email settings from database, decrypting smtp_password."""
    settings = db.query(SystemSetting).filter(
        SystemSetting.key.in_(_EMAIL_SETTING_KEYS)
    ).all()
    result = {s.key: (s.value or "") for s in settings}

    # Decrypt SMTP password if encrypted
    pwd = result.get("smtp_password", "")
    if pwd and is_encrypted(pwd):
        try:
            result["smtp_password"] = decrypt(pwd)
        except Exception:
            result["smtp_password"] = ""

    return result


def send_notification(db: Session, event_type: str, context: dict) -> None:
    """
    Send an email notification if enabled and the event type is configured.

    Args:
        db: Database session
        event_type: One of "backup_failed", "backup_success",
                    "device_disabled", "device_deleted"
        context: Dict with context data (device_name, error, etc.)
    """
    try:
        cfg = _get_email_settings(db)
    except Exception as exc:
        backup_logger.error("Failed to load email settings", error=str(exc))
        return

    if cfg.get("email_enabled") != "true":
        return

    notify_key = f"notify_{event_type}"
    if cfg.get(notify_key) != "true":
        return

    recipients_raw = cfg.get("email_recipients", "")
    recipients = [r.strip() for r in recipients_raw.split(";") if r.strip()]
    if not recipients:
        backup_logger.warning("Email notification skipped: no recipients configured", event_type=event_type)
        return

    if not cfg.get("smtp_host"):
        backup_logger.warning("Email notification skipped: SMTP host not configured", event_type=event_type)
        return

    subject, body = _build_message(event_type, context)

    try:
        _send_smtp(cfg, recipients, subject, body)
        backup_logger.info(
            "Email notification sent",
            event_type=event_type,
            recipients=recipients,
            device_name=context.get("device_name"),
        )
    except Exception as exc:
        backup_logger.error(
            "Failed to send email notification",
            event_type=event_type,
            error=str(exc),
        )


def _build_message(event_type: str, context: dict) -> tuple[str, str]:
    """Build email subject and body for the given event type."""
    device = context.get("device_name", "desconhecido")

    if event_type == "backup_failed":
        subject = f"[Configuard] Falha no backup: {device}"
        body = (
            f"O backup agendado do dispositivo '{device}' falhou.\n\n"
            f"Erro: {context.get('error', 'desconhecido')}\n\n"
            f"Verifique os logs do sistema para mais detalhes."
        )
    elif event_type == "backup_success":
        subject = f"[Configuard] Backup concluído: {device}"
        body = (
            f"O backup agendado do dispositivo '{device}' foi concluído com sucesso."
        )
    elif event_type == "device_disabled":
        subject = f"[Configuard] Host desativado: {device}"
        body = (
            f"O dispositivo '{device}' foi desativado no sistema Configuard.\n\n"
            f"Backups agendados para este dispositivo não serão executados enquanto estiver desativado."
        )
    elif event_type == "device_deleted":
        subject = f"[Configuard] Host excluído: {device}"
        body = (
            f"O dispositivo '{device}' foi excluído do sistema Configuard.\n\n"
            f"Todos os dados de backup associados foram removidos."
        )
    else:
        subject = f"[Configuard] Evento: {event_type}"
        body = str(context)

    return subject, body


def _send_smtp(cfg: dict, recipients: list[str], subject: str, body: str) -> None:
    """Send email via SMTP with optional STARTTLS."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = cfg.get("email_sender") or cfg.get("smtp_username", "")
    msg["To"] = "; ".join(recipients)
    msg.attach(MIMEText(body, "plain", "utf-8"))

    host = cfg.get("smtp_host", "")
    port = int(cfg.get("smtp_port") or 587)
    use_tls = cfg.get("smtp_use_tls", "true") == "true"
    username = cfg.get("smtp_username", "")
    password = cfg.get("smtp_password", "")

    server = smtplib.SMTP(host, port, timeout=15)
    try:
        server.ehlo()
        if use_tls:
            server.starttls()
            server.ehlo()
        if username and password:
            server.login(username, password)
        server.sendmail(msg["From"], recipients, msg.as_string())
    finally:
        server.quit()


def test_email_connection(db: Session) -> dict:
    """
    Test SMTP configuration by sending a test email.
    Returns {"success": bool, "message": str}
    """
    try:
        cfg = _get_email_settings(db)
    except Exception as exc:
        return {"success": False, "message": f"Erro ao carregar configurações: {exc}"}

    if not cfg.get("smtp_host"):
        return {"success": False, "message": "Servidor SMTP não configurado"}

    recipients_raw = cfg.get("email_recipients", "")
    recipients = [r.strip() for r in recipients_raw.split(";") if r.strip()]
    if not recipients:
        return {"success": False, "message": "Nenhum destinatário configurado"}

    subject = "[Configuard] Teste de Notificação por Email"
    body = (
        "Este é um email de teste do sistema Configuard.\n\n"
        "As configurações de email estão corretas e o sistema está pronto para enviar notificações."
    )

    try:
        _send_smtp(cfg, recipients, subject, body)
        return {"success": True, "message": f"Email de teste enviado para: {', '.join(recipients)}"}
    except Exception as exc:
        return {"success": False, "message": f"Falha ao enviar email: {exc}"}
