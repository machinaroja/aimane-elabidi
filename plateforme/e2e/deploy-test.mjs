// Teste tools/deploy_supabase.mjs contre un FAUX Supabase (API de gestion + auth admin) adossé à une vraie base PostgreSQL.
import http from 'node:http';
import { execSync, spawn } from 'node:child_process';
import { readFileSync, existsSync, rmSync, statSync, mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(new URL('../server/package.json', import.meta.url)); const pg = require('pg');
const DB = 'lieusaint_deploytest', PORT = 9199, REF = 'abcdefghij';
let pass = 0, fail = 0; const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? '✔' : '❌'} ${n}${c ? '' : ' ' + x}`); };

const fresh = () => { execSync(`dropdb --if-exists --force ${DB}; createdb ${DB}; psql -X -q -v ON_ERROR_STOP=1 -d ${DB} -f ${here}/../supabase/tests/00_auth_shim.sql`); };
const state = { polls: 0, created: 0, authCfg: null, failOn: null, users: [], bodies: [] };
let pool;
const send = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
const body = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`); const auth = req.headers.authorization;
  const b = req.method === 'GET' ? {} : await body(req);
  if (url.pathname.startsWith('/auth/v1/')) {
    if (auth !== 'Bearer svc-key') return send(res, 401, { msg: 'clé service requise' });
    const exists = (await pool.query('select 1 from auth.users where lower(email)=lower($1)', [b.email])).rowCount;
    if (exists) return send(res, 422, { msg: 'email_exists' });
    await pool.query('insert into auth.users (email) values (lower($1))', [b.email]); state.users.push(b.email); return send(res, 200, {});
  }
  if (auth !== 'Bearer sbp_test') return send(res, 401, { message: 'Invalid access token format' });
  const p = url.pathname;
  if (p === '/v1/organizations') return send(res, 200, [{ id: 'org1', slug: 'org-slug', name: 'AS Lieusaint' }]);
  if (p === '/v1/projects' && req.method === 'GET') return send(res, 200, state.created ? [{ id: REF, name: 'as-lieusaint', region: 'eu-west-3', status: 'ACTIVE_HEALTHY' }] : []);
  if (p === '/v1/projects' && req.method === 'POST') {
    state.bodies.push(b);
    if (b.region) return send(res, 400, { message: 'region is not allowed; use region_selection' });        // reproduit un changement d'API : le script doit se rabattre
    if (b.region_selection?.code !== 'eu-west-3' || !b.db_pass || b.db_pass.length < 20) return send(res, 400, { message: 'payload invalide' });
    state.created++; return send(res, 201, { id: REF, name: b.name, status: 'COMING_UP', region: 'eu-west-3' });
  }
  if (p === `/v1/projects/${REF}`) return send(res, 200, { id: REF, status: ++state.polls < 3 && state.created === 1 ? 'COMING_UP' : 'ACTIVE_HEALTHY' });
  if (p === `/v1/projects/${REF}/database/query`) {
    if (state.failOn && b.query.includes(state.failOn)) return send(res, 400, { message: `erreur simulée dans ${state.failOn}` });
    try { const r = await pool.query(b.query); const last = Array.isArray(r) ? r[r.length - 1] : r; return send(res, 201, last.rows ?? []); } catch (e) { return send(res, 400, { message: e.message }); }
  }
  if (p === `/v1/projects/${REF}/config/auth` && req.method === 'PATCH') { state.authCfg = b; return send(res, 200, {}); }
  if (p === `/v1/projects/${REF}/api-keys`) return send(res, 200, [{ name: 'anon', api_key: 'anon-key' }, { name: 'service_role', api_key: 'svc-key' }]);
  if (p === `/v1/projects/${REF}/config/supavisor`) return send(res, 200, [{ db_host: 'aws-0-eu-west-3.pooler.supabase.com', pool_mode: 'session' }]);
  send(res, 404, { message: 'introuvable' });
});
// asynchrone : le faux Supabase tourne dans CE processus, il doit pouvoir répondre pendant que le script s'exécute
const run = (env = {}, cwd) => new Promise((resolve) => { const c = spawn('node', [`${here}/../tools/deploy_supabase.mjs`], { cwd, env: { ...process.env, SUPABASE_API: `http://localhost:${PORT}`, SUPABASE_URL_OVERRIDE: `http://localhost:${PORT}`, POLL_MS: '20',
  SUPABASE_ACCESS_TOKEN: 'sbp_test', ADMIN_EMAIL: 'Admin@AS-Lieusaint.fr', SITE_URL: 'https://app.as-lieusaint.example', ...env } }); let stdout = '', stderr = ''; c.stdout.on('data', (d) => (stdout += d)); c.stderr.on('data', (d) => (stderr += d)); const t = setTimeout(() => c.kill('SIGKILL'), 60000); c.on('close', (status) => { clearTimeout(t); resolve({ status, stdout, stderr }); }); });

(async () => {
  fresh(); pool = new pg.Pool({ host: process.env.PGHOST || '/var/run/postgresql', user: process.env.PGUSER || 'root', password: process.env.PGPASSWORD || undefined, database: DB, max: 2 });
  await new Promise((r) => server.listen(PORT, r));
  const work = mkdtempSync(join(tmpdir(), 'deploy-'));
  try {
    // ---- refus propres des mauvaises entrées (rien n'est appelé)
    let r = await run({ SUPABASE_ACCESS_TOKEN: 'eyJhbGciOi.service.role' }, work); ok('une clé service_role / anon à la place du jeton est refusée avec un message clair', r.status === 1 && /sbp_/.test(r.stderr) && /PAS une clé/.test(r.stderr));
    r = await run({ ADMIN_EMAIL: 'pas-une-adresse' }, work); ok('adresse administrateur invalide refusée', r.status === 1 && /ADMIN_EMAIL/.test(r.stderr));
    r = await run({ SITE_URL: 'http://app.exemple.fr' }, work); ok('adresse du site non sécurisée (http) refusée', r.status === 1 && /SITE_URL/.test(r.stderr));
    r = await run({ SUPABASE_ACCESS_TOKEN: 'sbp_mauvais' }, work); ok('jeton refusé par Supabase : arrêt immédiat, rien de créé', r.status === 1 && state.created === 0 && /HTTP 401/.test(r.stderr));

    // ---- 1re exécution : migration en échec -> arrêt net
    state.failOn = 'create table public.team_objectives';
    r = await run({}, work); ok('migration en échec : le déploiement S\'ARRÊTE avec le fichier fautif et la consigne', r.status === 1 && /0010_objectives_evaluations\.sql refusée/.test(r.stderr) && /ne continuez pas/.test(r.stderr));
    ok('…et la région a été passée dans le nouveau format après le refus de l\'ancien (région Paris)', state.bodies.length >= 2 && state.bodies.at(-1).region_selection?.code === 'eu-west-3');
    ok('…les migrations réussies avant l\'échec sont enregistrées, pas la fautive', (await pool.query(`select count(*)::int n from app.schema_migrations`)).rows[0].n === 9);
    ok('…aucun fichier de variables n\'est écrit après un échec', !existsSync(join(work, 'gateway.env')));

    // ---- 2e exécution : reprise, succès complet
    state.failOn = null; r = await run({}, work);
    ok('reprise après correction : déploiement complet réussi', r.status === 0 && /Supabase est prêt/.test(r.stdout), r.stderr.slice(0, 300));
    ok('les 11 migrations sont appliquées une seule fois', (await pool.query(`select count(*)::int n from app.schema_migrations`)).rows[0].n === 11);
    const verif = r.stdout.split('Vérification du déploiement')[1].split('Variables du serveur')[0];
    ok('contrôle de déploiement : les 17 vérifications au vert, aucune ✖', (verif.match(/✔/g) || []).length === 17 && !/✖/.test(verif), verif.split('\n').filter((l) => /✖/.test(l)).join(' | '));
    ok('authentification : inscriptions publiques FERMÉES, adresse du site et redirection configurées', state.authCfg?.disable_signup === true && state.authCfg?.site_url === 'https://app.as-lieusaint.example' && state.authCfg?.uri_allow_list === 'https://app.as-lieusaint.example/' && state.authCfg?.mailer_autoconfirm === false);
    ok('absence de service d\'e-mail : avertissement explicite', /Aucun service d'e-mail/.test(r.stdout));
    ok('premier administrateur : compte créé (adresse en minuscules) et club créé', state.users.includes('admin@as-lieusaint.fr') && (await pool.query(`select count(*)::int n from public.memberships where role_key='club_admin'`)).rows[0].n === 1);
    ok('le rôle gateway est restreint (connexion, sans droits directs, membre de authenticated)', (await pool.query(`select rolcanlogin, rolinherit, rolsuper, has_table_privilege('gateway','public.players','select') as s from pg_roles where rolname='gateway'`)).rows.every((x) => x.rolcanlogin && !x.rolinherit && !x.rolsuper && !x.s));
    const env = readFileSync(join(work, 'gateway.env'), 'utf8');
    ok('gateway.env : toutes les variables du serveur présentes', ['NODE_ENV=production', 'TRUST_PROXY=1', 'SITE_URL=https://app.as-lieusaint.example', `SUPABASE_URL=https://${REF}.supabase.co`, 'SUPABASE_ANON_KEY=anon-key', 'SUPABASE_SERVICE_ROLE_KEY=svc-key', 'DATABASE_SSL=1'].every((l) => env.includes(l)));
    const dbUrl = env.match(/DATABASE_URL=(.*)/)[1];
    ok('gateway.env : le serveur utilise le rôle « gateway.<projet> » du pooler (jamais postgres)', /^postgresql:\/\/gateway\.abcdefghij:[^@]{20,}@aws-0-eu-west-3\.pooler\.supabase\.com:5432\/postgres$/.test(dbUrl));
    ok('gateway.env : lisible par son propriétaire seul (0600)', (statSync(join(work, 'gateway.env')).mode & 0o777) === 0o600);
    ok('le mot de passe du rôle gateway n\'est affiché nulle part à l\'écran', !r.stdout.includes(dbUrl.split(':')[2].split('@')[0]) && !r.stderr.includes(dbUrl.split(':')[2].split('@')[0]));
    ok('les clés secrètes ne sont pas affichées à l\'écran', !r.stdout.includes('svc-key') && !r.stdout.includes('sbp_test'));
    const cfg = require(join(here, '../server/config.mjs')); void cfg;
    const { loadConfig } = await import(`${here}/../server/config.mjs`);
    const envObj = Object.fromEntries(env.trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
    ok('le serveur ACCEPTE ce fichier de variables en production (aucune erreur de configuration)', loadConfig(envObj).errors.length === 0, JSON.stringify(loadConfig(envObj).errors));

    // ---- 3e exécution : idempotence
    const before = (await pool.query(`select (select count(*) from public.clubs)::int c, (select count(*) from auth.users)::int u, (select count(*) from app.schema_migrations)::int m`)).rows[0];
    r = await run({}, work); const after = (await pool.query(`select (select count(*) from public.clubs)::int c, (select count(*) from auth.users)::int u, (select count(*) from app.schema_migrations)::int m`)).rows[0];
    ok('relance : aucune duplication (1 club, mêmes comptes, mêmes migrations, projet réutilisé)', r.status === 0 && JSON.stringify(before) === JSON.stringify(after) && state.created === 1 && /déjà appliquée/.test(r.stdout) && /projet existant réutilisé/.test(r.stdout));
    ok('relance : le mot de passe du rôle gateway est renouvelé et le nouveau fichier fonctionne', /rôle mis à jour/.test(r.stdout) && readFileSync(join(work, 'gateway.env'), 'utf8').match(/DATABASE_URL=(.*)/)[1] !== dbUrl);

    // ---- service d'e-mail
    r = await run({ SMTP_HOST: 'smtp.exemple.fr', SMTP_PORT: '465', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_FROM: 'noreply@as-lieusaint.fr' }, work);
    ok('SMTP fourni : transmis à Supabase, plus d\'avertissement', state.authCfg?.smtp_host === 'smtp.exemple.fr' && state.authCfg?.smtp_port === '465' && state.authCfg?.smtp_admin_email === 'noreply@as-lieusaint.fr' && !/Aucun service d'e-mail/.test(r.stdout));
  } finally { server.close(); await pool.end(); rmSync(work, { recursive: true, force: true }); execSync(`dropdb --if-exists --force ${DB}`); }
  console.log(`\nBilan déploiement Supabase : ${pass} réussis, ${fail} échec(s)`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
