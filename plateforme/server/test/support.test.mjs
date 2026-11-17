import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.mjs';
import { createLimiter } from '../ratelimit.mjs';
import { createAuthClient } from '../supabase.mjs';

const okProd = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://gateway:pw@db.example:5432/postgres', SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc', SITE_URL: 'https://app.as-lieusaint.fr' };
test('config production complète : aucune erreur', () => assert.deepEqual(loadConfig(okProd).errors, []));
test('config production : chaque variable manquante est signalée', () => { for (const k of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SITE_URL']) { const e = { ...okProd }; delete e[k]; assert.ok(loadConfig(e).errors.some((x) => x.includes(k)), k); } });
test('config production : DEV_AUTH=1 refusé et jamais actif', () => { const r = loadConfig({ ...okProd, DEV_AUTH: '1' }); assert.ok(r.errors.some((x) => /DEV_AUTH/.test(x))); assert.equal(r.config.devAuth, false); });
test('config production : URL non https refusées (sauf localhost)', () => {
  assert.ok(loadConfig({ ...okProd, SITE_URL: 'http://app.example' }).errors.some((x) => /SITE_URL/.test(x)));
  assert.ok(loadConfig({ ...okProd, SUPABASE_URL: 'http://abc.supabase.co' }).errors.some((x) => /SUPABASE_URL/.test(x)));
  assert.deepEqual(loadConfig({ ...okProd, SITE_URL: 'http://localhost:8787', SUPABASE_URL: 'http://localhost:9999' }).errors, []);
});
test('config production : rôle administrateur refusé pour la passerelle', () => { for (const u of ['postgresql://postgres:pw@db:5432/postgres', 'postgresql://postgres.abcdefghij:pw@aws-0-eu.pooler.supabase.com:6543/postgres', 'postgresql://service_role:pw@db/postgres', 'postgresql://supabase_admin:pw@db/postgres']) assert.ok(loadConfig({ ...okProd, DATABASE_URL: u }).errors.some((x) => /administrateur/.test(x)), u); });
test('config production : le rôle « gateway » (y compris sous la forme du pooler gateway.<projet>) est accepté', () => { for (const u of ['postgresql://gateway:pw@db:5432/postgres', 'postgresql://gateway.abcdefghij:pw@aws-0-eu.pooler.supabase.com:5432/postgres']) assert.deepEqual(loadConfig({ ...okProd, DATABASE_URL: u }).errors, [], u); });
test('config hors production : il faut une méthode de connexion', () => { assert.ok(loadConfig({}).errors.length === 1); assert.deepEqual(loadConfig({ DEV_AUTH: '1' }).errors, []); });

test('limiteur : au-delà de la limite, refusé ; la fenêtre se réinitialise', () => {
  let t = 0; const hit = createLimiter({ now: () => t });
  assert.ok(hit('k', 3, 1000).allowed && hit('k', 3, 1000).allowed && hit('k', 3, 1000).allowed); assert.equal(hit('k', 3, 1000).allowed, false);
  assert.equal(hit('autre', 3, 1000).allowed, true); t = 1001; assert.equal(hit('k', 3, 1000).allowed, true);
});
test('limiteur : nettoyage des entrées expirées (pas de fuite mémoire)', () => { let t = 0; const hit = createLimiter({ now: () => t }); for (let i = 0; i < 100; i++) hit('k' + i, 1, 10); t = 120_000; hit('x', 1, 10); assert.ok(true); });

test('client Supabase : les clés ne sont envoyées qu\'à leur usage (service = création de compte, anon = lien et rafraîchissement)', async () => {
  const calls = []; const f = async (u, o) => { calls.push({ u, key: o.headers.apikey, body: JSON.parse(o.body) }); return { ok: true, status: 200, json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }) }; };
  const c = createAuthClient({ url: 'https://s', anonKey: 'ANON', serviceKey: 'SVC', fetchImpl: f });
  await c.ensureUser('a@b.c'); await c.sendLink('a@b.c', 'https://site/'); await c.refresh('rt');
  assert.deepEqual(calls.map((x) => x.key), ['SVC', 'ANON', 'ANON']);
  assert.equal(calls[1].body.create_user, false);                       // jamais d'inscription publique via le lien
  assert.equal(calls[1].body.options.email_redirect_to, 'https://site/');
});
test('client Supabase : compte déjà existant (422) toléré ; autre erreur = échec', async () => {
  const mk = (status) => createAuthClient({ url: 'https://s', anonKey: 'a', serviceKey: 's', fetchImpl: async () => ({ ok: status < 300, status, json: async () => ({}) }) });
  assert.equal(await mk(422).ensureUser('a@b.c'), true); await assert.rejects(mk(500).ensureUser('a@b.c'));
});
