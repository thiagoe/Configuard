-- Configuard - Performance Indexes (Migration 011)
-- Adds missing FK indexes, composite indexes, and partial indexes
-- Safe to run on existing databases: uses IF NOT EXISTS and DROP IF EXISTS

-- =============================================
-- DEVICES: FK indexes faltantes
-- =============================================

CREATE INDEX IF NOT EXISTS idx_devices_credential     ON devices(credential_id);
CREATE INDEX IF NOT EXISTS idx_devices_brand          ON devices(brand_id);
CREATE INDEX IF NOT EXISTS idx_devices_category       ON devices(category_id);
CREATE INDEX IF NOT EXISTS idx_devices_template       ON devices(backup_template_id);

-- Composite: filtro comum user + status
CREATE INDEX IF NOT EXISTS idx_devices_user_status    ON devices(user_id, status);

-- Ordenação por último backup
CREATE INDEX IF NOT EXISTS idx_devices_last_backup    ON devices(last_backup_at DESC NULLS LAST);

-- =============================================
-- CONFIGURATIONS: index composto por data
-- =============================================

-- "Último backup por dispositivo" — query mais comum
CREATE INDEX IF NOT EXISTS idx_configurations_device_latest ON configurations(device_id, collected_at DESC);

-- =============================================
-- BACKUP SCHEDULES: partial index (só ativos)
-- =============================================

-- Substituir index simples por partial index (schedules inativos ignorados)
DROP INDEX IF EXISTS idx_backup_schedules_active;
CREATE INDEX IF NOT EXISTS idx_backup_schedules_active ON backup_schedules(is_active) WHERE is_active = TRUE;

-- =============================================
-- BACKUP EXECUTIONS: indexes compostos e parciais
-- =============================================

-- Corrigir index started_at para ordenação DESC (padrão das queries)
DROP INDEX IF EXISTS idx_backup_exec_started;
CREATE INDEX IF NOT EXISTS idx_backup_exec_started ON backup_executions(started_at DESC);

-- Composite: filtro por usuário + ordenação temporal
CREATE INDEX IF NOT EXISTS idx_backup_exec_user_started   ON backup_executions(user_id, started_at DESC);

-- Composite: filtro por status + ordenação temporal (usado em alertas do dashboard)
CREATE INDEX IF NOT EXISTS idx_backup_exec_status_started ON backup_executions(status, started_at DESC);

-- Partial: execuções agendadas (schedule_id NOT NULL é subconjunto menor)
CREATE INDEX IF NOT EXISTS idx_backup_exec_schedule ON backup_executions(schedule_id) WHERE schedule_id IS NOT NULL;

-- Confirmação
DO $$
BEGIN
    RAISE NOTICE 'Migration 011: performance indexes applied successfully';
END $$;
