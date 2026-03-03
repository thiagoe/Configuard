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
