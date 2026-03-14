-- Migration 015: search performance indexes
-- Adds pg_trgm support and a trigram GIN index for ILIKE/regex search paths.
-- This file is safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Use CONCURRENTLY because this migration is intended for existing production tables.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_configurations_config_data_trgm
    ON configurations USING GIN (config_data gin_trgm_ops);

ANALYZE configurations;
