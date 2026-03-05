-- Configuard - Database Schema (PostgreSQL)
-- Version: 2.0.0

-- =============================================
-- EXTENSIONS
-- =============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ENUM TYPES
-- =============================================

DO $$ BEGIN
    CREATE TYPE role_enum AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


DO $$ BEGIN
    CREATE TYPE step_type_enum AS ENUM (
        'command', 'expect', 'pause', 'set_prompt', 'send_key', 'conditional'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


DO $$ BEGIN
    CREATE TYPE device_status_enum AS ENUM ('active', 'inactive', 'error', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE backup_status_enum AS ENUM ('success', 'failed', 'running');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE collection_method_enum AS ENUM ('manual', 'scheduled', 'api', 'ssh', 'telnet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE schedule_type_enum AS ENUM ('daily', 'weekly', 'monthly', 'cron');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- TABLES
-- =============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name   VARCHAR(255),
    avatar_url  TEXT,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    is_active   BOOLEAN DEFAULT TRUE NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
    id         VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id    VARCHAR(36) NOT NULL UNIQUE,
    role       role_enum NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id    VARCHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash    ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Credentials table (SSH/Telnet credentials)
CREATE TABLE IF NOT EXISTS credentials (
    id                   VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id              VARCHAR(36) NOT NULL,
    name                 VARCHAR(255) NOT NULL,
    description          TEXT,
    username             VARCHAR(255) NOT NULL,
    password_encrypted   TEXT,
    private_key_encrypted TEXT,
    passphrase_encrypted TEXT,
    port                 VARCHAR(5),
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_credentials_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials(user_id);

-- Brands table
CREATE TABLE IF NOT EXISTS brands (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id     VARCHAR(36) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url    VARCHAR(500),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_brands_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_brands_user ON brands(user_id);

-- Backup templates table
CREATE TABLE IF NOT EXISTS backup_templates (
    id                       VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id                  VARCHAR(36) NOT NULL,
    name                     VARCHAR(255) NOT NULL,
    description              TEXT,
    is_default               BOOLEAN DEFAULT FALSE NOT NULL,
    commands                 TEXT NOT NULL,
    use_steps                BOOLEAN DEFAULT FALSE NOT NULL,
    prompt_pattern           VARCHAR(255) DEFAULT '#|>|$',
    login_prompt             VARCHAR(255) DEFAULT 'Username:|Login:',
    password_prompt          VARCHAR(255) DEFAULT 'Password:',
    enable_prompt            VARCHAR(255),
    enable_required          BOOLEAN DEFAULT FALSE NOT NULL,
    enable_password_required BOOLEAN DEFAULT FALSE NOT NULL,
    pagination_pattern       VARCHAR(255) DEFAULT '--More--|<--- More --->',
    pagination_key           VARCHAR(10) DEFAULT ' ',
    connection_timeout       INT DEFAULT 30,
    command_timeout          INT DEFAULT 60,
    pre_commands             TEXT,
    post_commands            TEXT,
    error_patterns           TEXT,
    line_ending              VARCHAR(10) DEFAULT '\n',
    output_cleanup_patterns  TEXT,
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_backup_templates_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_backup_templates_user ON backup_templates(user_id);


-- Template steps table
CREATE TABLE IF NOT EXISTS template_steps (
    id             VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    template_id    VARCHAR(36) NOT NULL,
    step_type      step_type_enum NOT NULL DEFAULT 'command',
    "order"        INT,
    content        TEXT,
    expect_pattern VARCHAR(255),
    timeout        INT,
    capture_output BOOLEAN DEFAULT TRUE NOT NULL,
    on_failure     VARCHAR(20) DEFAULT 'stop',
    variable_name  VARCHAR(100),
    condition      TEXT,
    max_retries    INT DEFAULT 0,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_template_steps_template FOREIGN KEY (template_id) REFERENCES backup_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_steps_template ON template_steps(template_id);
CREATE INDEX IF NOT EXISTS idx_template_steps_order    ON template_steps(template_id, "order");

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id                 VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id            VARCHAR(36) NOT NULL,
    name               VARCHAR(255) NOT NULL,
    description        TEXT,
    color              VARCHAR(7),
    icon               VARCHAR(50),
    backup_template_id VARCHAR(36),
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_categories_user     FOREIGN KEY (user_id)            REFERENCES users(id)             ON DELETE CASCADE,
    CONSTRAINT fk_categories_template FOREIGN KEY (backup_template_id) REFERENCES backup_templates(id)  ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

-- Device models table
CREATE TABLE IF NOT EXISTS device_models (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id     VARCHAR(36) NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    brand_id    VARCHAR(36),
    category_id VARCHAR(36),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_device_models_user     FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
    CONSTRAINT fk_device_models_brand    FOREIGN KEY (brand_id)    REFERENCES brands(id)     ON DELETE SET NULL,
    CONSTRAINT fk_device_models_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT uk_device_models_name_user UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_device_models_user     ON device_models(user_id);
CREATE INDEX IF NOT EXISTS idx_device_models_brand    ON device_models(brand_id);
CREATE INDEX IF NOT EXISTS idx_device_models_category ON device_models(category_id);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
    id                 VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id            VARCHAR(36) NOT NULL,
    name               VARCHAR(255) NOT NULL,
    hostname           VARCHAR(255),
    ip_address         VARCHAR(45) NOT NULL,
    port               INT DEFAULT 22,
    brand_id           VARCHAR(36),
    category_id        VARCHAR(36),
    model_id           VARCHAR(36),
    credential_id      VARCHAR(36),
    backup_template_id VARCHAR(36),
    backup_enabled     BOOLEAN DEFAULT TRUE NOT NULL,
    status             device_status_enum DEFAULT 'active',
    notes              TEXT,
    location           VARCHAR(255),
    serial_number      VARCHAR(100),
    firmware_version   VARCHAR(50),
    last_backup_at     TIMESTAMP WITH TIME ZONE,
    last_backup_status backup_status_enum,
    last_backup_error  TEXT,
    last_config_hash   VARCHAR(64),
    custom_retention   BOOLEAN DEFAULT FALSE NOT NULL,
    retention_versions INT,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_devices_user     FOREIGN KEY (user_id)            REFERENCES users(id)             ON DELETE CASCADE,
    CONSTRAINT fk_devices_brand    FOREIGN KEY (brand_id)           REFERENCES brands(id)            ON DELETE SET NULL,
    CONSTRAINT fk_devices_category FOREIGN KEY (category_id)        REFERENCES categories(id)        ON DELETE SET NULL,
    CONSTRAINT fk_devices_model    FOREIGN KEY (model_id)           REFERENCES device_models(id)     ON DELETE SET NULL,
    CONSTRAINT fk_devices_cred     FOREIGN KEY (credential_id)      REFERENCES credentials(id)       ON DELETE SET NULL,
    CONSTRAINT fk_devices_template FOREIGN KEY (backup_template_id) REFERENCES backup_templates(id)  ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_user              ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_status            ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_ip                ON devices(ip_address);
CREATE INDEX IF NOT EXISTS idx_devices_model             ON devices(model_id);
CREATE INDEX IF NOT EXISTS idx_devices_credential        ON devices(credential_id);
CREATE INDEX IF NOT EXISTS idx_devices_brand             ON devices(brand_id);
CREATE INDEX IF NOT EXISTS idx_devices_category          ON devices(category_id);
CREATE INDEX IF NOT EXISTS idx_devices_template          ON devices(backup_template_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_status       ON devices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_backup_enabled    ON devices(backup_enabled) WHERE backup_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_devices_last_backup       ON devices(last_backup_at DESC NULLS LAST);

-- Configurations table (backup history)
CREATE TABLE IF NOT EXISTS configurations (
    id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    device_id           VARCHAR(36) NOT NULL,
    version             INT NOT NULL,
    config_data         TEXT NOT NULL,
    config_hash         VARCHAR(64) NOT NULL,
    changes_detected    BOOLEAN DEFAULT FALSE NOT NULL,
    collection_method   VARCHAR(20) DEFAULT 'manual',  -- ssh, telnet, manual, scheduled, api
    collected_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    collected_by        VARCHAR(36),                    -- user_id who triggered
    previous_config_id  VARCHAR(36),                    -- previous version reference
    size_bytes          INT,
    lines_count         INT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_configurations_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_configurations_device         ON configurations(device_id);
CREATE INDEX IF NOT EXISTS idx_configurations_version        ON configurations(device_id, version);
CREATE INDEX IF NOT EXISTS idx_configurations_device_latest  ON configurations(device_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_configurations_collected      ON configurations(collected_at);
CREATE INDEX IF NOT EXISTS idx_configurations_hash           ON configurations(config_hash);

-- Full-Text Search index on config_data using 'simple' dictionary
-- (no stemming — preserves IP addresses, interface names, vendor-specific tokens)
CREATE INDEX IF NOT EXISTS idx_configurations_fts
    ON configurations USING GIN (to_tsvector('simple', config_data));

-- Backup schedules table
CREATE TABLE IF NOT EXISTS backup_schedules (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id         VARCHAR(36) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    schedule_type   schedule_type_enum NOT NULL DEFAULT 'daily',
    cron_expression VARCHAR(100),
    time_of_day     TIME DEFAULT '02:00:00',
    day_of_week     SMALLINT,
    day_of_month    SMALLINT,
    is_active       BOOLEAN DEFAULT TRUE NOT NULL,
    last_run_at     TIMESTAMP WITH TIME ZONE,
    next_run_at     TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_backup_schedules_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_backup_schedules_user     ON backup_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_active   ON backup_schedules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run ON backup_schedules(next_run_at);

-- Schedule devices (many-to-many)
CREATE TABLE IF NOT EXISTS schedule_devices (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    schedule_id VARCHAR(36) NOT NULL,
    device_id   VARCHAR(36) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_schedule_devices_schedule FOREIGN KEY (schedule_id) REFERENCES backup_schedules(id) ON DELETE CASCADE,
    CONSTRAINT fk_schedule_devices_device   FOREIGN KEY (device_id)   REFERENCES devices(id)          ON DELETE CASCADE,
    CONSTRAINT uk_schedule_device UNIQUE (schedule_id, device_id)
);

-- Schedule categories (many-to-many)
CREATE TABLE IF NOT EXISTS schedule_categories (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    schedule_id VARCHAR(36) NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_schedule_categories_schedule  FOREIGN KEY (schedule_id) REFERENCES backup_schedules(id) ON DELETE CASCADE,
    CONSTRAINT fk_schedule_categories_category  FOREIGN KEY (category_id) REFERENCES categories(id)       ON DELETE CASCADE,
    CONSTRAINT uk_schedule_category UNIQUE (schedule_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_categories_schedule  ON schedule_categories(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_categories_category  ON schedule_categories(category_id);

-- Backup executions table (audit trail for all backup attempts)
CREATE TABLE IF NOT EXISTS backup_executions (
    id                VARCHAR(36) PRIMARY KEY,
    device_id         VARCHAR(36) NOT NULL,
    user_id           VARCHAR(36) NOT NULL,
    status            VARCHAR(20) NOT NULL,
    error_message     TEXT,
    configuration_id  VARCHAR(36),
    config_changed    BOOLEAN NOT NULL DEFAULT FALSE,
    config_hash       VARCHAR(64),
    collection_method VARCHAR(20) NOT NULL,
    started_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at      TIMESTAMP WITH TIME ZONE,
    duration_seconds  INT,
    triggered_by      VARCHAR(20) NOT NULL DEFAULT 'manual',
    schedule_id       VARCHAR(36),
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_backup_exec_device   FOREIGN KEY (device_id)        REFERENCES devices(id)          ON DELETE CASCADE,
    CONSTRAINT fk_backup_exec_user     FOREIGN KEY (user_id)          REFERENCES users(id)            ON DELETE CASCADE,
    CONSTRAINT fk_backup_exec_config   FOREIGN KEY (configuration_id) REFERENCES configurations(id)   ON DELETE SET NULL,
    CONSTRAINT fk_backup_exec_schedule FOREIGN KEY (schedule_id)      REFERENCES backup_schedules(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_backup_exec_device         ON backup_executions(device_id);
CREATE INDEX IF NOT EXISTS idx_backup_exec_user           ON backup_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_exec_status         ON backup_executions(status);
CREATE INDEX IF NOT EXISTS idx_backup_exec_started        ON backup_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_exec_device_started ON backup_executions(device_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_exec_user_started   ON backup_executions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_exec_status_started ON backup_executions(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_exec_schedule       ON backup_executions(schedule_id) WHERE schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_backup_exec_config_changed ON backup_executions(config_changed);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id         VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id    VARCHAR(36),
    action     VARCHAR(50) NOT NULL,
    table_name VARCHAR(100),
    record_id  VARCHAR(36),
    old_data   JSONB,
    new_data   JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action  ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table   ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT NOT NULL DEFAULT '',
    description TEXT,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to get the latest config version for a device
CREATE OR REPLACE FUNCTION get_latest_version(p_device_id VARCHAR(36))
RETURNS INT AS $$
    SELECT COALESCE(MAX(version), 0) FROM configurations WHERE device_id = p_device_id;
$$ LANGUAGE sql STABLE;

-- Function used by the trigger to auto-increment configuration version
CREATE OR REPLACE FUNCTION fn_auto_version() RETURNS TRIGGER AS $$
BEGIN
    NEW.version := get_latest_version(NEW.device_id) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: automatically set version before each INSERT into configurations
DROP TRIGGER IF EXISTS before_configuration_insert ON configurations;
CREATE TRIGGER before_configuration_insert
    BEFORE INSERT ON configurations
    FOR EACH ROW EXECUTE FUNCTION fn_auto_version();
