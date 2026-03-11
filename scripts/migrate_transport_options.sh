#!/bin/bash

# Configuard - Migration helper for backup_templates.transport_options
# Usage:
#   ./scripts/migrate_transport_options.sh
#
# The script is idempotent:
# - if the column already exists, it exits successfully
# - otherwise, it applies db/init/013_backup_template_transport_options.sql

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATION_FILE="$PROJECT_DIR/db/init/013_backup_template_transport_options.sql"

# Load .env values if present, but let explicit environment variables win.
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

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

run_psql_query() {
    local sql="$1"

    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        if docker compose ps --status running postgresql >/dev/null 2>&1; then
            docker compose exec -T postgresql \
                env PGPASSWORD="$DB_PASSWORD" \
                psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -tAc "$sql"
            return
        fi
    fi

    if ! command -v psql >/dev/null 2>&1; then
        log_error "Neither a running 'postgresql' docker compose service nor a local 'psql' client was found."
        exit 1
    fi

    PGPASSWORD="$DB_PASSWORD" \
        psql \
        -v ON_ERROR_STOP=1 \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -tAc "$sql"
}

apply_migration_file() {
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        if docker compose ps --status running postgresql >/dev/null 2>&1; then
            docker compose exec -T postgresql \
                env PGPASSWORD="$DB_PASSWORD" \
                psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$MIGRATION_FILE"
            return
        fi
    fi

    if ! command -v psql >/dev/null 2>&1; then
        log_error "Local 'psql' client not found."
        exit 1
    fi

    PGPASSWORD="$DB_PASSWORD" \
        psql \
        -v ON_ERROR_STOP=1 \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$MIGRATION_FILE"
}

if [ ! -f "$MIGRATION_FILE" ]; then
    log_error "Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo ""
echo "=============================================="
echo " Configuard - transport_options DB migration "
echo "=============================================="
echo ""

log_info "Checking whether backup_templates.transport_options already exists..."
COLUMN_EXISTS="$(run_psql_query "SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'backup_templates'
      AND column_name = 'transport_options'
);")"

if [ "$COLUMN_EXISTS" = "t" ]; then
    log_success "Column backup_templates.transport_options already exists. Nothing to do."
    exit 0
fi

log_info "Applying migration from $MIGRATION_FILE"
apply_migration_file

log_info "Verifying migration result..."
COLUMN_EXISTS="$(run_psql_query "SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'backup_templates'
      AND column_name = 'transport_options'
);")"

if [ "$COLUMN_EXISTS" = "t" ]; then
    log_success "Migration applied successfully."
else
    log_error "Migration finished but the column was not found."
    exit 1
fi
