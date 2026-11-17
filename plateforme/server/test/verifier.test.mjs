import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign, createHmac, sign as cSign } from 'node:crypto';
import { createVerifier } from '../verifier.mjs';

const b64u = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
const SUB = '11111111-2222-3333-4444-555555555555';
const ISS = 'https://abc.supabase.co/auth/v1';
const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwkEc = { ...ec.publicKey.export({ format: 'jwk' }), kid: 'ec-1', alg: 'ES256', use: 'sig' };
const jwkRsa = { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'rsa-1', alg: 'RS256', use: 'sig' };
const claims = (o = {}) => ({ sub: SUB, email: 'Educ@Club.FR', iss: ISS, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 600, ...o });
const es256 = (payload, kid = 'ec-1', priv = ec.privateKey) => { const d = `${b64u({ alg: 'ES256', typ: 'JWT', kid })}.${b64u(payload)}`; return `${d}.${cSign('sha256', Buffer.from(d), { key: priv, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`; };
const rs256 = (payload, kid = 'rsa-1') => { const d = `${b64u({ alg: 'RS256', typ: 'JWT', kid })}.${b64u(payload)}`; return `${d}.${createSign('sha256').update(d).sign(rsa.privateKey).toString('base64url')}`; };
const jwksServer = (keys, counter = { n: 0 }) => async () => { counter.n++; return { ok: true, status: 200, json: async () => ({ keys }) }; };
const mk = (o = {}) => createVerifier({ issuer: ISS, jwksUrl: 'https://abc.supabase.co/auth/v1/.well-known/jwks.json', fetchImpl: jwksServer([jwkEc, jwkRsa]), ...o });

test('ES256 valide accepté, e-mail normalisé en minuscules', async () => { const u = await mk()(es256(claims())); assert.equal(u.sub, SUB); assert.equal(u.email, 'educ@club.fr'); });
test('RS256 valide accepté', async () => assert.equal((await mk()(rs256(claims()))).sub, SUB));
test('signature falsifiée refusée', async () => { const t = es256(claims()); assert.equal(await mk()(t.slice(0, -4) + 'AAAA'), null); });
test('payload modifié après signature refusé', async () => { const [h, , s] = es256(claims()).split('.'); assert.equal(await mk()(`${h}.${b64u(claims({ sub: '99999999-2222-3333-4444-555555555555' }))}.${s}`), null); });
test('jeton signé par une AUTRE clé privée refusé', async () => { const other = generateKeyPairSync('ec', { namedCurve: 'P-256' }); assert.equal(await mk()(es256(claims(), 'ec-1', other.privateKey)), null); });
test('kid inconnu refusé', async () => assert.equal(await mk()(es256(claims(), 'inconnu')), null));
test('expiré refusé', async () => assert.equal(await mk()(es256(claims({ exp: Math.floor(Date.now() / 1000) - 5 }))), null));
test('mauvais émetteur refusé', async () => assert.equal(await mk()(es256(claims({ iss: 'https://pirate.example/auth/v1' }))), null));
test('mauvaise audience refusée', async () => assert.equal(await mk()(es256(claims({ aud: 'anon' }))), null));
test('sujet absent ou invalide refusé', async () => { assert.equal(await mk()(es256(claims({ sub: undefined }))), null); assert.equal(await mk()(es256(claims({ sub: '1; drop table' }))), null); });
test('« alg: none » refusé (avec ou sans signature)', async () => {
  assert.equal(await mk()(`${b64u({ alg: 'none', kid: 'ec-1' })}.${b64u(claims())}.`), null);
  assert.equal(await mk()(`${b64u({ alg: 'none', kid: 'ec-1' })}.${b64u(claims())}.c2lnbmF0dXJl`), null);
});
test('algorithmes non prévus refusés même correctement signés (HS512 avec le bon secret, PS256)', async () => {
  const d = `${b64u({ alg: 'HS512', typ: 'JWT' })}.${b64u(claims())}`;
  assert.equal(await mk({ hsSecret: 'vrai-secret' })(`${d}.${createHmac('sha512', 'vrai-secret').update(d).digest('base64url')}`), null);
  const d2 = `${b64u({ alg: 'PS256', typ: 'JWT', kid: 'rsa-1' })}.${b64u(claims())}`;
  assert.equal(await mk()(`${d2}.${createSign('sha256').update(d2).sign(rsa.privateKey).toString('base64url')}`), null);
});
test('CONFUSION D\'ALGORITHME : HS256 signé avec la clé publique refusé (secret HS non configuré)', async () => {
  const pub = JSON.stringify(jwkEc); const d = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(claims())}`;
  assert.equal(await mk()(`${d}.${createHmac('sha256', pub).update(d).digest('base64url')}`), null);
});
test('CONFUSION D\'ALGORITHME : HS256 signé avec la clé publique PEM refusé même si un secret HS existe', async () => {
  const pem = ec.publicKey.export({ type: 'spki', format: 'pem' }); const d = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(claims())}`;
  assert.equal(await mk({ hsSecret: 'vrai-secret' })(`${d}.${createHmac('sha256', pem).update(d).digest('base64url')}`), null);
});
test('ES256 annoncé mais clé RSA, avec une signature RSA VALIDE : refusé (l\'algorithme doit correspondre à la clé)', async () => {
  const d = `${b64u({ alg: 'ES256', typ: 'JWT', kid: 'rsa-1' })}.${b64u(claims())}`;
  assert.equal(await mk()(`${d}.${createSign('sha256').update(d).sign(rsa.privateKey).toString('base64url')}`), null);
});
test('RS256 annoncé mais clé EC, avec une signature EC valide : refusé', async () => {
  const d = `${b64u({ alg: 'RS256', typ: 'JWT', kid: 'ec-1' })}.${b64u(claims())}`;
  assert.equal(await mk()(`${d}.${cSign('sha256', Buffer.from(d), { key: ec.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`), null);
});
test('HS256 accepté seulement avec un secret configuré (ancien mode Supabase)', async () => {
  const d = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(claims())}`; const t = `${d}.${createHmac('sha256', 'vrai-secret').update(d).digest('base64url')}`;
  assert.equal((await mk({ hsSecret: 'vrai-secret' })(t)).sub, SUB); assert.equal(await mk()(t), null); assert.equal(await mk({ hsSecret: 'autre' })(t), null);
});
test('HS256 avec un « kid » refusé (un jeton à clé publique ne peut pas devenir symétrique)', async () => {
  const d = `${b64u({ alg: 'HS256', typ: 'JWT', kid: 'ec-1' })}.${b64u(claims())}`; assert.equal(await mk({ hsSecret: 's' })(`${d}.${createHmac('sha256', 's').update(d).digest('base64url')}`), null);
});
test('rotation de clé : une clé inconnue déclenche UN rechargement et le nouveau jeton est accepté', async () => {
  const k2 = generateKeyPairSync('ec', { namedCurve: 'P-256' }); const jwk2 = { ...k2.publicKey.export({ format: 'jwk' }), kid: 'ec-2' };
  let keys = [jwkEc]; const c = { n: 0 }; const v = createVerifier({ issuer: ISS, jwksUrl: 'https://x/jwks', minRefetchMs: 0, fetchImpl: async () => { c.n++; return { ok: true, json: async () => ({ keys }) }; } });
  assert.ok(await v(es256(claims())));
  keys = [jwkEc, jwk2]; assert.ok(await v(es256(claims(), 'ec-2', k2.privateKey)));
  assert.equal(c.n, 2);
});
test('les clés sont mises en cache (pas de requête par jeton)', async () => { const c = { n: 0 }; const v = mk({ fetchImpl: jwksServer([jwkEc], c) }); for (let i = 0; i < 20; i++) await v(es256(claims())); assert.equal(c.n, 1); });
test('serveur de clés en panne : jeton refusé proprement, pas de plantage', async () => { const w = []; const v = createVerifier({ issuer: ISS, jwksUrl: 'https://x/jwks', fetchImpl: async () => { throw new Error('réseau coupé'); }, onWarn: (m) => w.push(m) }); assert.equal(await v(es256(claims())), null); assert.ok(w.length >= 1); });
test('serveur de clés en panne APRÈS un 1er chargement : les clés connues restent utilisables', async () => {
  let up = true; const v = createVerifier({ issuer: ISS, jwksUrl: 'https://x/jwks', jwksTtlMs: 0, minRefetchMs: 0, fetchImpl: async () => { if (!up) throw new Error('panne'); return { ok: true, json: async () => ({ keys: [jwkEc] }) }; } });
  assert.ok(await v(es256(claims()))); up = false; assert.ok(await v(es256(claims())));
});
test('entrées absurdes refusées', async () => { const v = mk(); for (const t of [undefined, null, '', 'a.b', 'a.b.c.d', '..', 'x'.repeat(5000), `${'a'.repeat(5000)}.b.c`]) assert.equal(await v(t), null); });
test('jeton de développement (HS256, sans émetteur) accepté seulement dans un vérificateur de développement', async () => {
  const d = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: SUB, email: 'a@b.c', exp: Math.floor(Date.now() / 1000) + 60, aud: 'authenticated' })}`; const t = `${d}.${createHmac('sha256', 'dev').update(d).digest('base64url')}`;
  assert.ok(await createVerifier({ hsSecret: 'dev' })(t)); assert.equal(await mk({ hsSecret: 'dev' })(t), null);   // en production (issuer imposé) il est refusé
});
