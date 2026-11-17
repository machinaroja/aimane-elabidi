#!/usr/bin/env bash
# Base locale de démonstration : migrations + données fictives + vrai calendrier officiel.
set -euo pipefail
cd "$(dirname "$0")/supabase"
DB=${DB:-lieusaint_dev}
pg_lsclusters | grep -q online || pg_ctlcluster 16 main start
dropdb --if-exists "$DB"; createdb "$DB"
P="psql -X -q -v ON_ERROR_STOP=1 -d $DB"
$P -f tests/00_auth_shim.sql
for f in migrations/*.sql; do $P -f "$f"; done
$P -f dev/seed_demo.sql
echo "✅ Base de démonstration prête : $DB"
