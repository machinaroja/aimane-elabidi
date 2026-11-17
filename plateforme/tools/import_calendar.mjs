#!/usr/bin/env node
// Importe le calendrier officiel (JSON produit par sportcorico_sync.py) dans la base du club.
// À lancer avec une URL de base d'ADMINISTRATION (propriétaire des fonctions) : jamais celle de la passerelle.
//   python3 tools/sportcorico_sync.py a-s-lieusaint-football > calendrier.json
//   ADMIN_DATABASE_URL=postgresql://postgres:...@db.xxx.supabase.co:5432/postgres node tools/import_calendar.mjs calendrier.json as-lieusaint
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../server/package.json', import.meta.url)); const pg = require('pg');
const [file, slug] = process.argv.slice(2);
if (!file || !slug || !process.env.ADMIN_DATABASE_URL) { console.error('usage : ADMIN_DATABASE_URL=… node tools/import_calendar.mjs calendrier.json <slug-du-club>'); process.exit(2); }
const payload = JSON.parse(readFileSync(file, 'utf8'));
if (payload.source !== 'sportcorico' || !Array.isArray(payload.teams)) { console.error('fichier de calendrier invalide'); process.exit(2); }
const c = new pg.Client({ connectionString: process.env.ADMIN_DATABASE_URL, ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== '1' } : undefined });
await c.connect();
try {
  const club = (await c.query('select id from public.clubs where slug = $1', [slug])).rows[0];
  if (!club) throw new Error(`club « ${slug} » introuvable`);
  const r = (await c.query('select app.import_external_calendar($1, $2, $3::jsonb, true) as r', [club.id, 'sportcorico', JSON.stringify(payload)])).rows[0].r;
  console.log(JSON.stringify(r));
} finally { await c.end(); }
