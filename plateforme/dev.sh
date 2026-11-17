#!/usr/bin/env bash
# Base locale de démonstration : migrations + données fictives + vrai calendrier officiel.
set -euo pipefail
cd "$(dirname "$0")/supabase"
DB=${DB:-lieusaint_dev}
if command -v pg_lsclusters >/dev/null 2>&1 && ! pg_lsclusters | grep -q online; then pg_ctlcluster 16 main start; fi
dropdb --if-exists --force "$DB"; createdb "$DB"
P="psql -X -q -v ON_ERROR_STOP=1 -d $DB"
$P -f tests/00_auth_shim.sql
for f in migrations/*.sql; do $P -f "$f"; done
$P -f dev/seed_demo.sql
# Rôle de connexion de la passerelle, tel qu'en production (voir supabase/prod/01_create_gateway_role.sql) : aucun droit direct sur les tables.
$P -c "alter role gateway login password 'gw-test-pass' noinherit nosuperuser nocreatedb nocreaterole nobypassrls; grant authenticated to gateway; grant usage on schema app to gateway; grant execute on function app.auth_email_allowed(text) to gateway;"
echo "✅ Base de démonstration prête : $DB"
