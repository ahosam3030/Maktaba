#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/backups"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="$ROOT/backups/library_erp_${TS}.sql"
ENV_FILE="$ROOT/apps/api/.env"
DBURL=""
if [[ -f "$ENV_FILE" ]]; then
  DBURL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
if [[ -z "${DBURL}" ]]; then
  echo "DATABASE_URL missing in apps/api/.env"
  exit 1
fi
pg_dump "$DBURL" -F p -f "$OUT"
echo "Backup written: $OUT"
