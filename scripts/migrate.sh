#!/usr/bin/env bash
set -euo pipefail

echo "[migrate] Starting migrations"

: "${DATABASE_URL:?DATABASE_URL env var must be set, e.g. postgres://user:pass@localhost:5432/app?sslmode=disable}"

MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backend/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "[migrate] Migrations directory not found: $MIGRATIONS_DIR"
  exit 1
fi

echo "[migrate] Using DATABASE_URL=$DATABASE_URL"
echo "[migrate] Applying migrations from $MIGRATIONS_DIR"

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  echo "[migrate] No migration files found"
  exit 0
fi

# Run in lexical order
for f in "${files[@]}"; do
  echo "[migrate] Applying $(basename "$f")"
  PGPASSWORD="$(python3 - <<'PY'
import os,sys,urllib.parse
u=os.environ.get("DATABASE_URL","")
if not u:
  sys.exit(0)
p=urllib.parse.urlparse(u)
print(urllib.parse.unquote(p.password) if p.password else "")
PY
)" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "[migrate] Done"