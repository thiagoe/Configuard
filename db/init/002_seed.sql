-- Configuard - Initial Seed Data (PostgreSQL)
-- Version: 1.0.0

-- =============================================
-- DEFAULT ADMIN USER
-- Email: admin@configuard.com
-- Password: Admin@123 (bcrypt hashed)
-- =============================================

INSERT INTO users (id, email, password_hash, full_name, email_verified_at, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@configuard.com',
    '$2b$12$97lV34WIvXG29m/u/TFInuHSmQUPhnXzrEOt0JEChvAppnanc32nS',
    'System Administrator',
    NOW(),
    TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (id, user_id, role)
VALUES (
    'r0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'admin'
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- DEFAULT BRANDS
-- =============================================

INSERT INTO brands (id, user_id, name, description) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Cisco', 'Cisco Systems networking equipment'),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Juniper', 'Juniper Networks equipment'),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'MikroTik', 'MikroTik RouterOS devices'),
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Fortinet', 'Fortinet FortiGate firewalls'),
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Palo Alto', 'Palo Alto Networks firewalls'),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Arista', 'Arista Networks switches')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- DEFAULT BACKUP TEMPLATES
-- =============================================

-- Cisco IOS Template
INSERT INTO backup_templates (id, user_id, name, description, commands, use_steps, prompt_pattern, login_prompt, password_prompt, pagination_pattern, connection_timeout, command_timeout)
VALUES (
    't0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Cisco IOS - Full Backup',
    'Complete configuration backup for Cisco IOS devices',
    'terminal length 0\nshow running-config\nshow version\nshow ip interface brief\nshow interfaces status',
    FALSE,
    '#|>',
    'Username:|Login:',
    'Password:',
    '--More--',
    30,
    60
)
ON CONFLICT (id) DO NOTHING;

-- Cisco NX-OS Template
INSERT INTO backup_templates (id, user_id, name, description, commands, use_steps, prompt_pattern, pagination_pattern, connection_timeout, command_timeout)
VALUES (
    't0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Cisco NX-OS - Full Backup',
    'Complete configuration backup for Cisco Nexus devices',
    'terminal length 0\nshow running-config\nshow version\nshow interface brief',
    FALSE,
    '#',
    '--More--',
    30,
    90
)
ON CONFLICT (id) DO NOTHING;

-- Juniper JunOS Template
INSERT INTO backup_templates (id, user_id, name, description, commands, use_steps, prompt_pattern, pagination_pattern, connection_timeout, command_timeout)
VALUES (
    't0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'Juniper JunOS - Full Backup',
    'Complete configuration backup for Juniper devices',
    'set cli screen-length 0\nshow configuration | display set\nshow version\nshow interfaces terse',
    FALSE,
    '>|#',
    '---\(more\)---',
    30,
    60
)
ON CONFLICT (id) DO NOTHING;

-- MikroTik RouterOS Template
INSERT INTO backup_templates (id, user_id, name, description, commands, use_steps, prompt_pattern, pagination_pattern, connection_timeout, command_timeout)
VALUES (
    't0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'MikroTik RouterOS - Full Backup',
    'Complete configuration backup for MikroTik devices',
    '/export\n/system resource print\n/interface print',
    FALSE,
    '\[[^\]]+\]\s?>\s?$',
    NULL,
    30,
    180
)
ON CONFLICT (id) DO NOTHING;

-- Fortinet FortiOS Template
INSERT INTO backup_templates (id, user_id, name, description, commands, use_steps, prompt_pattern, pagination_pattern, connection_timeout, command_timeout, pre_commands)
VALUES (
    't0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000001',
    'Fortinet FortiOS - Full Backup',
    'Complete configuration backup for FortiGate firewalls',
    'show full-configuration\nget system status\nget hardware status',
    FALSE,
    '#|\$',
    '--More--',
    30,
    120,
    'config system console\nset output standard\nend'
)
ON CONFLICT (id) DO NOTHING;

-- Palo Alto PAN-OS Template
INSERT INTO backup_templates (id, user_id, name, description, commands, use_steps, prompt_pattern, pagination_pattern, connection_timeout, command_timeout, pre_commands)
VALUES (
    't0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000001',
    'Palo Alto PAN-OS - Full Backup',
    'Complete configuration backup for Palo Alto firewalls',
    'show config running\nshow system info\nshow interface all',
    FALSE,
    '>|#',
    NULL,
    30,
    120,
    'set cli pager off'
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- DEFAULT CATEGORIES
-- =============================================

INSERT INTO categories (id, user_id, name, description, backup_template_id) VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Core Switches', 'Core network switches', 't0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Access Switches', 'Access layer switches', 't0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Routers', 'WAN and edge routers', 't0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Firewalls', 'Perimeter firewalls', 't0000000-0000-0000-0000-000000000005'),
('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Wireless Controllers', 'Wireless LAN controllers', NULL)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- INITIAL AUDIT LOG
-- =============================================

INSERT INTO audit_logs (id, user_id, action, table_name, record_id, new_data, ip_address)
VALUES (
    'l0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'SYSTEM_INIT',
    NULL,
    NULL,
    '{"message": "System initialized with default data", "version": "2.0.0"}',
    '127.0.0.1'
)
ON CONFLICT (id) DO NOTHING;
