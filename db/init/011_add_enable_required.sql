-- Migration 011: Add enable_required column to backup_templates
-- The model has this column but it was missing from the initial schema

ALTER TABLE backup_templates
    ADD COLUMN IF NOT EXISTS enable_required BOOLEAN DEFAULT FALSE NOT NULL;
