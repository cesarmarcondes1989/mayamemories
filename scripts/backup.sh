#!/usr/bin/env bash
# Backup independente: banco (pg_dump) + arquivos (export-media).
# Requer: SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# Uso: npm run backup -- ./backups
set -euo pipefail
DEST="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DIR="$DEST/$STAMP"
mkdir -p "$DIR"
umask 077

if [[ -f .env.local ]]; then set -a; source .env.local; set +a; fi
: "${SUPABASE_DB_URL:?defina SUPABASE_DB_URL (connection string do Postgres)}"

echo "→ Banco de dados"
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage --file="$DIR/database.dump"

echo "→ Arquivos de mídia"
node scripts/export-media.mjs "$DIR/files"

( cd "$DIR" && find . -type f ! -name SHA256SUMS -print0 | xargs -0 sha256sum > SHA256SUMS )
echo "{\"finished_at\":\"$(date -u +%FT%TZ)\",\"result\":\"ok\"}" > "$DIR/backup-run.json"
echo "✓ Backup completo em $DIR"
echo "  Lembre-se: um backup só é confiável depois de um teste de restauração (docs/backup.md)."
