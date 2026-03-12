#!/bin/bash

# Configuard - Migration helper for backup_templates.login_success_pattern

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATION_FILE="$PROJECT_DIR/db/init/014_backup_template_login_success_pattern.sql"

if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$PROJECT_DIR/.env"
    set +a
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-configuard}"
DB_USER="${DB_USER:-configuard}"
DB_PASSWORD="${DB_PASSWORD:-configuard123}"

run_psql_query() {
    local sql="$1"
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        if docker compose ps --status running postgresql >/dev/null 2>&1; then
            docker compose exec -T postgresql env PGPASSWORD="$DB_PASSWORD" \
                psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -tAc "$sql"
            return
        fi
    fi
    PGPASSWORD="$DB_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "$sql"
}

apply_migration_file() {
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        if docker compose ps --status running postgresql >/dev/null 2>&1; then
            docker compose exec -T postgresql env PGPASSWORD="$DB_PASSWORD" \
                psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$MIGRATION_FILE"
            return
        fi
    fi
    PGPASSWORD="$DB_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"
}

echo "Checking backup_templates.login_success_pattern..."

COLUMN_EXISTS="$(run_psql_query "SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'backup_templates'
      AND column_name = 'login_success_pattern'
);")"

if [ "$COLUMN_EXISTS" = "t" ]; then
    echo "Column already exists. Nothing to do."
    exit 0
fi

apply_migration_file

COLUMN_EXISTS="$(run_psql_query "SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'backup_templates'
      AND column_name = 'login_success_pattern'
);")"

if [ "$COLUMN_EXISTS" = "t" ]; then
    echo "Migration applied successfully."
else
    echo "Migration failed."
    exit 1
fi
