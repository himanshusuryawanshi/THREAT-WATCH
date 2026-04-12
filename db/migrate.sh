#!/bin/bash
# Run all migrations in order against the threatwatch database.
# Safe to run multiple times — all SQL uses IF NOT EXISTS / DO NOTHING patterns.
#
# Usage:
#   ./db/migrate.sh
#   PGDATABASE=mydb ./db/migrate.sh
#   DATABASE_URL=postgres://... ./db/migrate.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Connection: prefer DATABASE_URL, fall back to individual PG* vars ─────────
if [ -n "$DATABASE_URL" ]; then
  PSQL_CMD="psql $DATABASE_URL"
else
  DB_NAME="${PGDATABASE:-threatwatch}"
  DB_USER="${PGUSER:-threatwatch}"
  DB_HOST="${PGHOST:-localhost}"
  DB_PORT="${PGPORT:-5432}"
  PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME"
fi

echo "=== ThreatWatch migrations starting ==="

for f in "$SCRIPT_DIR"/0*.sql; do
  echo "  ▶ $(basename $f)..."
  $PSQL_CMD -f "$f" -v ON_ERROR_STOP=1 -q
done

echo "=== All migrations complete ==="
