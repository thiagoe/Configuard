#!/usr/bin/env python3
"""
migrate_to_postgres.py — MariaDB → PostgreSQL data migration for Configuard.

Usage:
    python db/migrate_to_postgres.py [--dry-run] [--maria-port 3307]

Requirements:
    pip install pymysql psycopg2-binary
"""

import sys
import argparse
from decimal import Decimal

try:
    import pymysql
    import pymysql.cursors
except ImportError:
    sys.exit("Missing pymysql. Run: pip install pymysql")

try:
    import psycopg2
except ImportError:
    sys.exit("Missing psycopg2-binary. Run: pip install psycopg2-binary")

MARIA_CFG = dict(
    host="127.0.0.1", port=3306, user="configuard",
    password="configuard123", db="configuard", charset="utf8mb4",
    cursorclass=pymysql.cursors.DictCursor,
)
PG_CFG = dict(
    host="127.0.0.1", port=5432, user="configuard",
    password="configuard123", dbname="configuard",
)

TABLES = [
    "users", "user_roles", "refresh_tokens", "credentials",
    "brands", "categories", "backup_templates", "template_steps",
    "device_models", "devices", "configurations", "backup_schedules",
    "schedule_devices", "schedule_categories", "backup_executions",
    "audit_logs", "system_settings",
]

PK_MAP = {"system_settings": "key"}

# Columns in old MariaDB that don't exist in new PostgreSQL schema → skip
SKIP_COLUMNS = {
    "brands":         {"logo_url"},
    "categories":     {"color", "icon"},
    "backup_templates": {"is_default"},
    "configurations": {"previous_config_id", "size_bytes", "lines_count", "collected_by"},
    "devices":        {"location", "serial_number", "firmware_version",
                       "last_backup_error", "last_config_hash",
                       "custom_retention", "retention_versions"},
}

# Columns renamed between old MariaDB and new PostgreSQL schema
RENAME_COLUMNS = {
    "template_steps": {
        "order":      "step_order",
        "content":    "command",
        "timeout":    "timeout_seconds",
        "on_failure": "on_error",
    },
}

# Default values to inject when a column exists in PG but NOT in old MariaDB
# (column was added in the new schema)
DEFAULT_VALUES = {
    "backup_templates": {"os_type": "other"},
    "devices":          {"os_type": "other"},
}

# Boolean columns stored as 0/1 int in MariaDB
BOOL_COLUMNS = {
    "users":             {"is_active"},
    "backup_templates":  {"use_steps", "enable_password_required"},
    "template_steps":    {"capture_output"},
    "devices":           {"backup_enabled"},
    "configurations":    {"changes_detected"},
    "backup_schedules":  {"is_active"},
    "backup_executions": {"config_changed"},
}

VALID_OS_TYPES = {
    "cisco_ios","cisco_nxos","juniper_junos","arista_eos",
    "mikrotik_routeros","fortinet_fortios","paloalto_panos","huawei_vrp","other",
}
VALID_COLLECTION_METHODS = {"manual","scheduled","api"}
VALID_SCHEDULE_TYPES = {"daily","weekly","monthly","cron"}
VALID_STEP_TYPES = {"command","expect","pause","set_prompt","send_key","conditional"}
VALID_ON_ERROR = {"continue","stop","retry"}


def coerce(table, col, val):
    if val is None:
        return None
    if col in BOOL_COLUMNS.get(table, set()):
        return bool(val)
    if col == "os_type" and val not in VALID_OS_TYPES:
        return "other"
    if col == "collection_method" and val not in VALID_COLLECTION_METHODS:
        return "manual"
    if col == "schedule_type" and val not in VALID_SCHEDULE_TYPES:
        return "daily"
    if col == "step_type" and val not in VALID_STEP_TYPES:
        return "command"
    if col == "on_error" and val not in VALID_ON_ERROR:
        return "continue"
    if isinstance(val, bytearray):
        return bytes(val)
    if isinstance(val, Decimal):
        return float(val)
    return val


def get_pg_columns(pg_conn, table):
    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=%s", (table,)
        )
        return {r[0] for r in cur.fetchall()}


def fetch_table(conn, table):
    with conn.cursor() as cur:
        cur.execute(f"SELECT * FROM `{table}`")
        return cur.fetchall()


def build_insert(table, row, pg_cols, pk_col="id"):
    skip = SKIP_COLUMNS.get(table, set())
    rename = RENAME_COLUMNS.get(table, {})
    defaults = DEFAULT_VALUES.get(table, {})

    mapped = []
    maria_keys = set(row.keys())

    for maria_col, val in row.items():
        if maria_col in skip:
            continue
        pg_col = rename.get(maria_col, maria_col)
        if pg_col not in pg_cols:
            continue
        mapped.append((pg_col, coerce(table, pg_col, val)))

    # Inject defaults for PG columns that don't exist in the old MariaDB row
    for pg_col, default_val in defaults.items():
        # Only inject if the column wasn't present in MariaDB (or was renamed)
        maria_col_equiv = {v: k for k, v in rename.items()}.get(pg_col, pg_col)
        if maria_col_equiv not in maria_keys and pg_col not in [c[0] for c in mapped]:
            if pg_col in pg_cols:
                mapped.append((pg_col, default_val))

    if not mapped:
        return None, None

    col_names = [c[0] for c in mapped]
    values    = [c[1] for c in mapped]
    ph = ", ".join(["%s"] * len(col_names))
    cols = ", ".join(f'"{c}"' for c in col_names)
    # system_settings: DO UPDATE so user-configured values override seed defaults
    if table == "system_settings":
        update_cols = [c for c in col_names if c != pk_col]
        if update_cols:
            set_clause = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in update_cols)
            conflict_action = f"DO UPDATE SET {set_clause}"
        else:
            conflict_action = "DO NOTHING"
    else:
        conflict_action = "DO NOTHING"

    sql = (
        f'INSERT INTO "{table}" ({cols}) VALUES ({ph}) '
        f'ON CONFLICT ("{pk_col}") {conflict_action}'
    )
    return sql, values


def count_pg(pg_conn, table):
    with pg_conn.cursor() as cur:
        cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        return cur.fetchone()[0]


def migrate_table(maria_conn, pg_conn, table, dry_run=False):
    rows = fetch_table(maria_conn, table)
    pk_col = PK_MAP.get(table, "id")
    pg_cols = get_pg_columns(pg_conn, table)

    if not rows:
        print(f"  {table}: 0 rows — skipped")
        return 0

    inserted = skipped = errors = 0
    first_errors = []

    with pg_conn.cursor() as cur:
        for row in rows:
            sql, values = build_insert(table, row, pg_cols, pk_col)
            if sql is None:
                continue
            if dry_run:
                inserted += 1
                continue
            try:
                cur.execute(sql, values)
                if cur.rowcount:
                    inserted += 1
                else:
                    skipped += 1
            except Exception as exc:
                pg_conn.rollback()
                errors += 1
                if errors <= 2:
                    first_errors.append(
                        f"    ERROR row {row.get(pk_col,'?')}: {str(exc)[:150]}"
                    )
                continue

    if not dry_run:
        pg_conn.commit()

    for e in first_errors:
        print(e)
    if errors > 2:
        print(f"    ... and {errors - 2} more errors")

    extra = f", errors {errors}" if errors else ""
    label = "(dry-run) would insert" if dry_run else "inserted"
    print(f"  {table}: {label} {inserted}, skipped {skipped}{extra} — total: {len(rows)}")
    return inserted


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--maria-port", type=int, default=3306)
    args = parser.parse_args()

    MARIA_CFG["port"] = args.maria_port

    print(f"Connecting to MariaDB (port {MARIA_CFG['port']})…")
    try:
        maria_conn = pymysql.connect(**MARIA_CFG)
    except Exception as exc:
        sys.exit(f"MariaDB connection failed: {exc}")

    print("Connecting to PostgreSQL…")
    try:
        pg_conn = psycopg2.connect(**PG_CFG)
        pg_conn.autocommit = False
    except Exception as exc:
        maria_conn.close()
        sys.exit(f"PostgreSQL connection failed: {exc}")

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Starting migration…\n")

    total = 0
    for table in TABLES:
        try:
            total += migrate_table(maria_conn, pg_conn, table, dry_run=args.dry_run)
        except Exception as exc:
            print(f"  {table}: FATAL — {exc}")
            pg_conn.rollback()

    print(f"\nMigration complete. Total rows inserted: {total}")

    if not args.dry_run:
        print("\nRow counts in PostgreSQL after migration:")
        for table in TABLES:
            try:
                print(f"  {table}: {count_pg(pg_conn, table)}")
            except Exception as exc:
                print(f"  {table}: error — {exc}")

    maria_conn.close()
    pg_conn.close()


if __name__ == "__main__":
    main()
