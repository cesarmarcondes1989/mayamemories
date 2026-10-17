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
# Upgrade: banco no formato antigo + dados reais -> aplica as migrações novas
UP="maya_upgrade_$$"
createdb "$UP"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true; dropdb --if-exists "$UP" >/dev/null 2>&1 || true' EXIT
upgrade_ok=1
psql -X -q -v ON_ERROR_STOP=1 -d "$UP" -f "$ROOT/supabase/tests/shim/00_supabase_shim.sql" >/dev/null || upgrade_ok=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  case "$(basename "$f")" in 20261017000009_*) break ;; esac
  psql -X -q -v ON_ERROR_STOP=1 -d "$UP" -f "$f" >/dev/null || upgrade_ok=0
done
psql -X -q -v ON_ERROR_STOP=1 -d "$UP" -f "$ROOT/supabase/tests/upgrade/legacy_seed.sql" >/dev/null 2>/tmp/maya_test_out_$$ || upgrade_ok=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  [[ "$(basename "$f")" < "20261017000009" ]] && continue
  psql -X -q -v ON_ERROR_STOP=1 -d "$UP" -f "$f" >/dev/null 2>>/tmp/maya_test_out_$$ || upgrade_ok=0
done
psql -X -q -v ON_ERROR_STOP=1 -d "$UP" -f "$ROOT/supabase/tests/shim/01_test_helpers.sql" >/dev/null || upgrade_ok=0
if [[ $upgrade_ok == 1 ]] && psql -X -q -v ON_ERROR_STOP=1 -d "$UP" -f "$ROOT/supabase/tests/upgrade/check.sql" >>/tmp/maya_test_out_$$ 2>&1; then
  echo "PASS     upgrade (legacy data -> current schema)"
else
  echo "FAIL     upgrade (legacy data -> current schema)"
  cat /tmp/maya_test_out_$$
  status=1
fi

rm -f /tmp/maya_test_out_$$
exit $status
