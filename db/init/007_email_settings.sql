-- Migration 007: Email notification settings (PostgreSQL)
-- Inserts default email configuration into system_settings table

INSERT INTO system_settings (key, value, description, updated_at) VALUES
('email_enabled', 'false', 'Habilitar notificações por email', NOW()),
('smtp_host', '', 'Servidor SMTP', NOW()),
('smtp_port', '587', 'Porta SMTP', NOW()),
('smtp_use_tls', 'true', 'Usar TLS/STARTTLS', NOW()),
('smtp_username', '', 'Usuário SMTP', NOW()),
('smtp_password', '', 'Senha SMTP (criptografada com AES-256-GCM)', NOW()),
('email_sender', '', 'Email remetente (From)', NOW()),
('email_recipients', '', 'Destinatários separados por ponto-e-vírgula', NOW()),
('notify_backup_failed', 'true', 'Notificar falha em backup agendado', NOW()),
('notify_backup_success', 'false', 'Notificar sucesso em backup agendado', NOW()),
('notify_device_disabled', 'true', 'Notificar quando host for desativado', NOW()),
('notify_device_deleted', 'true', 'Notificar quando host for excluído', NOW())
ON CONFLICT (key) DO NOTHING;
