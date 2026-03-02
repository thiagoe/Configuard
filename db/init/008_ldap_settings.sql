-- Migration 008: LDAP / Active Directory authentication settings (PostgreSQL)
-- Inserts default LDAP configuration into system_settings table

INSERT INTO system_settings (key, value, description, updated_at) VALUES
('ldap_enabled', 'false', 'Habilitar autenticação LDAP/AD', NOW()),
('ldap_server', '', 'Servidor LDAP (hostname ou IP)', NOW()),
('ldap_port', '389', 'Porta LDAP', NOW()),
('ldap_use_ssl', 'false', 'Usar SSL (LDAPS, porta 636)', NOW()),
('ldap_use_starttls', 'false', 'Usar STARTTLS', NOW()),
('ldap_bind_dn', '', 'DN da conta de serviço (Bind DN)', NOW()),
('ldap_bind_password', '', 'Senha da conta de serviço (criptografada)', NOW()),
('ldap_base_dn', '', 'DN base para busca de usuários', NOW()),
('ldap_user_filter', '(&(objectClass=person)(sAMAccountName={username}))', 'Filtro de busca de usuários', NOW()),
('ldap_username_attr', 'sAMAccountName', 'Atributo de nome de usuário', NOW()),
('ldap_email_attr', 'mail', 'Atributo de email', NOW()),
('ldap_display_name_attr', 'displayName', 'Atributo de nome de exibição', NOW()),
('ldap_group_search_base', '', 'DN base para busca de grupos', NOW()),
('ldap_group_search_filter', '(&(objectClass=group)(member={dn}))', 'Filtro para buscar grupos do usuário', NOW()),
('ldap_group_mappings', '[]', 'Mapeamento grupo DN -> role (JSON array)', NOW()),
('ldap_default_role', 'user', 'Role padrão para usuários LDAP sem grupo mapeado', NOW()),
('ldap_access_token_ttl', '480', 'Duração do token LDAP em minutos (padrão 8h)', NOW())
ON CONFLICT (key) DO NOTHING;
