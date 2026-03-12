-- Migration 014: add login_success_pattern to backup_templates

ALTER TABLE backup_templates
    ADD COLUMN IF NOT EXISTS login_success_pattern VARCHAR(255);
