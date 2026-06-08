-- Migration 017: Change credentials.port from VARCHAR(5) to INTEGER
ALTER TABLE credentials
    ALTER COLUMN port TYPE INTEGER USING (port::INTEGER);
