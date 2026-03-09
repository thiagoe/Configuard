-- Configuard - Migration 012
-- Remove backup_enabled column from devices table
-- Device activation/deactivation is now controlled exclusively by the status field

DROP INDEX IF EXISTS idx_devices_backup_enabled;

ALTER TABLE devices DROP COLUMN IF EXISTS backup_enabled;
