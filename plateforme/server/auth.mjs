// JWT HS256 minimal (secret partagé avec Supabase Auth en production : SUPABASE_JWT_SECRET).
import { createHmac, timingSafeEqual } from 'node:crypto';
const b64u = (b) => Buffer.from(b).toString('base64url');
export function sign(payload, secret, ttlSeconds = 8 * 3600) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const data = `${b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64u(JSON.stringify(body))}`;
  return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
}
export function verify(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  let header; try { header = JSON.parse(Buffer.from(parts[0], 'base64url')); } catch { return null; }
  if (header.alg !== 'HS256') return null;                       // refuse « none » et tout autre algorithme
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const got = Buffer.from(parts[2], 'base64url');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  let p; try { p = JSON.parse(Buffer.from(parts[1], 'base64url')); } catch { return null; }
  if (!p.exp || p.exp < Math.floor(Date.now() / 1000) || !p.sub) return null;
  return p;
}
