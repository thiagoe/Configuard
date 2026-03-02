-- Migration 009: Remove unused columns from devices and users tables
-- devices: location, serial_number, firmware_version — never used in UI
-- users: avatar_url, email_verified_at — never set or displayed

ALTER TABLE devices
    DROP COLUMN IF EXISTS location,
    DROP COLUMN IF EXISTS serial_number,
    DROP COLUMN IF EXISTS firmware_version;

ALTER TABLE users
    DROP COLUMN IF EXISTS avatar_url,
    DROP COLUMN IF EXISTS email_verified_at;
