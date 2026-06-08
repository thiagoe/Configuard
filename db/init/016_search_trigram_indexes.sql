-- Migration 016: trigram indexes for ILIKE search on entity name fields
-- Adds GIN trigram indexes so name/hostname/ip_address ILIKE '%term%' queries
-- use index scans instead of sequential scans.
-- Also adds composite partial index on audit_logs for the common filtered query pattern.
-- Safe to run multiple times (IF NOT EXISTS throughout).

-- pg_trgm already enabled in 001_schema.sql, but guard here for safety
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Devices: name, hostname, ip_address searched together via OR ILIKE in devices.py
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_name_trgm
    ON devices USING GIN (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_hostname_trgm
    ON devices USING GIN (hostname gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_ip_trgm
    ON devices USING GIN (ip_address gin_trgm_ops);

-- Credentials: name ILIKE search in credentials.py
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credentials_name_trgm
    ON credentials USING GIN (name gin_trgm_ops);

-- Brands: name ILIKE search in brands.py
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brands_name_trgm
    ON brands USING GIN (name gin_trgm_ops);

-- Categories: name ILIKE search in categories.py
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_name_trgm
    ON categories USING GIN (name gin_trgm_ops);

-- Templates: name ILIKE search in templates.py
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backup_templates_name_trgm
    ON backup_templates USING GIN (name gin_trgm_ops);

-- Device models: name ILIKE search in device_models.py
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_device_models_name_trgm
    ON device_models USING GIN (name gin_trgm_ops);

-- Schedules: name ILIKE search in schedules.py
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backup_schedules_name_trgm
    ON backup_schedules USING GIN (name gin_trgm_ops);

-- Users: email + full_name ILIKE search in users.py
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_trgm
    ON users USING GIN (email gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_full_name_trgm
    ON users USING GIN (full_name gin_trgm_ops);

-- Audit logs: common query is action != 'HTTP_REQUEST' ORDER BY created_at DESC.
-- Composite partial index eliminates sorting on the filtered subset.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_created
    ON audit_logs(created_at DESC)
    WHERE action != 'HTTP_REQUEST';

ANALYZE devices;
ANALYZE credentials;
ANALYZE brands;
ANALYZE categories;
ANALYZE backup_templates;
ANALYZE device_models;
ANALYZE backup_schedules;
ANALYZE users;
ANALYZE audit_logs;
