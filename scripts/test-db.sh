#!/usr/bin/env bash
# Aplica as migrações em um PostgreSQL descartável (com shim do Supabase)
# e executa os testes de autorização em supabase/tests/*.sql.
# Uso: PGHOST=localhost PGUSER=postgres npm run test:db
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="maya_test_$$"
export PGOPTIONS="--client-min-messages=warning"

createdb "$DB"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT

run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" >/dev/null; }

run "$ROOT/supabase/tests/shim/00_supabase_shim.sql"
SHIM_HELPERS="$ROOT/supabase/tests/shim/01_test_helpers.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  run "$f"
done

run "$SHIM_HELPERS"
status=0
for t in "$ROOT"/supabase/tests/*.sql; do
  if psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$t" >/tmp/maya_test_out_$$ 2>&1; then
    echo "PASS     $(basename "$t")"
  else
    echo "FAIL     $(basename "$t")"
    cat /tmp/maya_test_out_$$
    status=1
  fi
done
rm -f /tmp/maya_test_out_$$
exit $status
