-- Migration 010: Remove backup_template_id from categories table
-- Template association with categories is unnecessary and was blocking template deletion

ALTER TABLE categories
    DROP COLUMN IF EXISTS backup_template_id;
