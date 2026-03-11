-- Migration 013: add transport_options JSONB to backup_templates

ALTER TABLE backup_templates
    ADD COLUMN IF NOT EXISTS transport_options JSONB;
