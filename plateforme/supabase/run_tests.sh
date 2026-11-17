#!/usr/bin/env bash
# Recrée une base jetable, applique les migrations, puis exécute les tests multi-comptes.
set -euo pipefail
cd "$(dirname "$0")"
DB=${DB:-lieusaint_test}
PSQL="psql -X -q -v ON_ERROR_STOP=1 -d $DB"
dropdb --if-exists "$DB"; createdb "$DB"
$PSQL -f tests/00_auth_shim.sql
for f in migrations/*.sql; do echo "→ $f"; $PSQL -f "$f"; done
for f in tests/[1-9]*.sql; do echo "→ $f"; $PSQL -f "$f"; done
echo "✅ Tous les tests sont passés"
