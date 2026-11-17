import test from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify } from '../auth.mjs';
const S = 'secret-de-test';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
test('jeton valide accepté', () => assert.equal(verify(sign({ sub: 'u1', email: 'a@b.c' }, S), S).sub, 'u1'));
test('mauvais secret refusé', () => assert.equal(verify(sign({ sub: 'u1' }, S), 'autre'), null));
test('jeton expiré refusé', () => assert.equal(verify(sign({ sub: 'u1' }, S, -10), S), null));
test('jeton falsifié (payload modifié) refusé', () => {
  const [h, , s] = sign({ sub: 'u1' }, S).split('.');
  assert.equal(verify(`${h}.${b64u({ sub: 'admin', exp: 9999999999 })}.${s}`, S), null);
});
test('algorithme « none » refusé', () => assert.equal(verify(`${b64u({ alg: 'none' })}.${b64u({ sub: 'x', exp: 9999999999 })}.`, S), null));
test('autre algorithme (HS512) refusé', () => assert.equal(verify(`${b64u({ alg: 'HS512' })}.${b64u({ sub: 'x', exp: 9999999999 })}.abc`, S), null));
test('jeton sans sujet refusé', () => assert.equal(verify(sign({ email: 'x@y.z' }, S), S), null));
test('entrées absurdes refusées', () => { for (const t of [undefined, null, '', 'a.b', 'a.b.c.d', '....']) assert.equal(verify(t, S), null); });
