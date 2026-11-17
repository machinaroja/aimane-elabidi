#!/usr/bin/env node
// Déploiement Supabase en UNE commande, à lancer depuis VOTRE ordinateur (le jeton ne quitte jamais votre machine).
//
//   export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx      # supabase.com/dashboard/account/tokens
//   export ADMIN_EMAIL=vous@exemple.fr             # premier administrateur du club
//   export SITE_URL=https://app.as-lieusaint.fr    # adresse publique (peut être provisoire, à corriger ensuite)
//   node plateforme/tools/deploy_supabase.mjs
//
// Il : crée le projet (Europe) ou réutilise celui du même nom -> applique les migrations (une seule fois chacune) ->
// crée le rôle « gateway » -> configure l'authentification (inscriptions publiques fermées) -> crée le compte du premier
// administrateur et le club -> VÉRIFIE le déploiement -> écrit gateway.env (variables du serveur). Relançable sans risque.
// Variables facultatives : PROJECT_NAME, REGION (défaut eu-west-3 = Paris), CLUB_NAME, ORG_ID, SMTP_HOST/PORT/USER/PASS/FROM.
import { readFileSync, readdirSync, writeFileSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SQL = join(here, '../supabase');
const E = process.env;
const API = (E.SUPABASE_API || 'https://api.supabase.com').replace(/\/+$/, '');
const TOKEN = E.SUPABASE_ACCESS_TOKEN, ADMIN = (E.ADMIN_EMAIL || '').trim().toLowerCase();
const SITE = (E.SITE_URL || '').replace(/\/+$/, ''), NAME = E.PROJECT_NAME || 'as-lieusaint', REGION = E.REGION || 'eu-west-3', CLUB = E.CLUB_NAME || 'AS Lieusaint';
const POLL = Number(E.POLL_MS || 5000);
const say = (m) => console.log(`\n▶ ${m}`), okk = (m) => console.log(`  ✔ ${m}`), die = (m) => { console.error(`\n✖ ${m}`); process.exit(1); };

if (!TOKEN || !TOKEN.startsWith('sbp_')) die('SUPABASE_ACCESS_TOKEN manquant ou invalide : un jeton d\'accès personnel commence par « sbp_ » (supabase.com/dashboard/account/tokens). Ce n\'est PAS une clé anon ou service_role.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN)) die('ADMIN_EMAIL manquant ou invalide.');
if (!/^https:\/\/|^http:\/\/localhost/.test(SITE)) die('SITE_URL manquant : adresse publique en https (ex. https://app.as-lieusaint.fr).');

async function call(method, path, body, { base = API, key = TOKEN } = {}) {
  const r = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${key}`, ...(base === API ? {} : { apikey: key }), 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}
const must = (r, what) => { if (!r.ok) die(`${what} a échoué (HTTP ${r.status}) : ${typeof r.data === 'string' ? r.data : JSON.stringify(r.data)}`); return r.data; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sqlLit = (s) => `'${String(s).replace(/'/g, "''")}'`;

// ---------- 1. projet
say('Projet Supabase');
const orgs = must(await call('GET', '/v1/organizations'), 'lecture des organisations');
if (!orgs.length) die('Aucune organisation Supabase : créez-en une sur supabase.com/dashboard puis relancez.');
let org = E.ORG_ID ? orgs.find((o) => o.id === E.ORG_ID || o.slug === E.ORG_ID) : orgs.length === 1 ? orgs[0] : null;
if (!org) die(`Plusieurs organisations : choisissez avec ORG_ID=… parmi ${orgs.map((o) => `${o.slug || o.id} (${o.name})`).join(', ')}`);
const projects = must(await call('GET', '/v1/projects'), 'lecture des projets');
let project = projects.find((p) => p.name === NAME);
const dbPass = randomBytes(24).toString('base64url');
let gatewayPass = randomBytes(24).toString('base64url');
if (project) okk(`projet existant réutilisé : ${project.name} (${project.id || project.ref}, ${project.region})`);
else {
  const payload = { name: NAME, organization_id: org.id, organization_slug: org.slug || org.id, db_pass: dbPass, region: REGION };
  let r = await call('POST', '/v1/projects', payload);
  if (!r.ok && r.status === 400) r = await call('POST', '/v1/projects', { name: NAME, organization_id: org.id, organization_slug: org.slug || org.id, db_pass: dbPass, region_selection: { type: 'specific', code: REGION } });
  project = must(r, 'création du projet');
  okk(`projet créé : ${NAME} (région ${REGION})`);
}
const ref = project.id || project.ref;
let status = project.status;
for (let i = 0; status !== 'ACTIVE_HEALTHY' && i < 160; i++) { await sleep(POLL); status = must(await call('GET', `/v1/projects/${ref}`), 'état du projet').status; if (i % 6 === 5) console.log(`  … ${status}`); }
if (status !== 'ACTIVE_HEALTHY') die(`le projet n'est pas prêt (état : ${status}). Relancez dans quelques minutes.`);
okk('projet prêt');
const q = async (query) => must(await call('POST', `/v1/projects/${ref}/database/query`, { query }), 'requête SQL');

// ---------- 2. migrations (une seule fois chacune)
say('Migrations');
await q(`create schema if not exists app; create table if not exists app.schema_migrations (name text primary key, applied_at timestamptz not null default now()); alter table app.schema_migrations enable row level security;`);
const done = new Set((await q('select name from app.schema_migrations')).map((r) => r.name));
for (const f of readdirSync(join(SQL, 'migrations')).filter((x) => x.endsWith('.sql')).sort()) {
  if (done.has(f)) { okk(`${f} (déjà appliquée)`); continue; }
  const res = await call('POST', `/v1/projects/${ref}/database/query`, { query: readFileSync(join(SQL, 'migrations', f), 'utf8') });
  if (!res.ok) die(`migration ${f} refusée : ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}\n  Le déploiement s'arrête ici : ne continuez pas avec un schéma incomplet. Envoyez-moi ce message.`);
  await q(`insert into app.schema_migrations (name) values (${sqlLit(f)})`); okk(f);
}

// ---------- 3. rôle de la passerelle
say('Rôle « gateway » (aucun droit direct sur les tables)');
const existsGw = (await q(`select 1 from pg_roles where rolname = 'gateway'`)).length > 0;
await q(`do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'gateway') then create role gateway login password ${sqlLit(gatewayPass)} noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  else alter role gateway login password ${sqlLit(gatewayPass)} noinherit nosuperuser nocreatedb nocreaterole nobypassrls; end if; end $$;
  grant authenticated to gateway; grant usage on schema app to gateway; grant execute on function app.auth_email_allowed(text) to gateway;
  alter role gateway set statement_timeout = '30s'; alter role gateway set idle_in_transaction_session_timeout = '30s';`);
okk(existsGw ? 'rôle mis à jour (nouveau mot de passe)' : 'rôle créé');

// ---------- 4. authentification
say('Authentification');
const authCfg = { site_url: SITE, uri_allow_list: `${SITE}/`, disable_signup: true, mailer_autoconfirm: false };
if (E.SMTP_HOST) Object.assign(authCfg, { smtp_host: E.SMTP_HOST, smtp_port: String(E.SMTP_PORT || 587), smtp_user: E.SMTP_USER, smtp_pass: E.SMTP_PASS, smtp_admin_email: E.SMTP_FROM, smtp_sender_name: CLUB });
must(await call('PATCH', `/v1/projects/${ref}/config/auth`, authCfg), 'configuration de l\'authentification');
okk('inscriptions publiques FERMÉES ; adresse du site et redirections configurées');
if (!E.SMTP_HOST) console.log('  ⚠ Aucun service d\'e-mail (SMTP_*) fourni : le service intégré de Supabase est limité et non prévu pour la production.\n    Les liens de connexion risquent de ne pas arriver. Créez un compte Brevo/Mailjet/Resend puis relancez avec SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.');

// ---------- 5. clés, administrateur, club
say('Premier administrateur et club');
const keys = must(await call('GET', `/v1/projects/${ref}/api-keys`), 'lecture des clés');
const anon = keys.find((k) => k.name === 'anon')?.api_key, service = keys.find((k) => k.name === 'service_role')?.api_key;
if (!anon || !service) die('clés anon / service_role introuvables.');
const SUPA = `https://${ref}.supabase.co`;
const base = E.SUPABASE_URL_OVERRIDE || SUPA;
const mk = await call('POST', '/auth/v1/admin/users', { email: ADMIN, email_confirm: true }, { base, key: service });
if (!mk.ok && mk.status !== 422) die(`création du compte administrateur impossible (HTTP ${mk.status}) : ${JSON.stringify(mk.data)}`);
okk(mk.ok ? `compte créé : ${ADMIN}` : `compte déjà existant : ${ADMIN}`);
if ((await q('select count(*)::int as n from public.clubs'))[0].n === 0) {
  await q(readFileSync(join(SQL, 'prod/02_bootstrap_first_club.sql'), 'utf8').replace('REMPLACER@exemple.fr', ADMIN).replace("'AS Lieusaint', 'as-lieusaint'", `${sqlLit(CLUB)}, 'as-lieusaint'`));
  okk(`club « ${CLUB} » créé, ${ADMIN} est administrateur`);
} else okk('un club existe déjà : non recréé');

// ---------- 6. vérification
say('Vérification du déploiement');
const rows = await q(readFileSync(join(SQL, 'prod/verify_deploy.sql'), 'utf8'));
let bad = 0; for (const r of rows) { console.log(`  ${r.ok ? '✔' : '✖'} ${r.controle}`); if (!r.ok) bad++; }
if (bad) die(`${bad} contrôle(s) en échec : NE PAS ouvrir le service. Envoyez-moi cette liste.`);

// ---------- 7. variables du serveur
say('Variables du serveur');
let host = `db.${ref}.supabase.co`, user = 'gateway';
const sv = await call('GET', `/v1/projects/${ref}/config/supavisor`);
const pool = Array.isArray(sv.data) ? (sv.data.find((p) => p.pool_mode === 'session') || sv.data[0]) : null;
if (pool?.db_host) { host = pool.db_host; user = `gateway.${ref}`; }
const env = [`NODE_ENV=production`, `PORT=8787`, `TRUST_PROXY=1`, `SITE_URL=${SITE}`, `SUPABASE_URL=${SUPA}`, `SUPABASE_ANON_KEY=${anon}`, `SUPABASE_SERVICE_ROLE_KEY=${service}`,
  `DATABASE_URL=postgresql://${user}:${gatewayPass}@${host}:5432/postgres`, `DATABASE_SSL=1`].join('\n') + '\n';
const out = join(process.cwd(), 'gateway.env'); writeFileSync(out, env, { mode: 0o600 }); try { chmodSync(out, 0o600); } catch { /* Windows */ }
okk(`écrit : ${out}  (SECRET : ne le commitez jamais ; saisissez ces valeurs dans l'hébergeur)`);
console.log(`\n✅ Supabase est prêt. Prochaine étape : déployer la passerelle (voir DEPLOIEMENT.md, « Chemin rapide »).\n   Administrateur : ${ADMIN} → ouvrira le site, saisira son adresse, recevra son lien de connexion.`);
