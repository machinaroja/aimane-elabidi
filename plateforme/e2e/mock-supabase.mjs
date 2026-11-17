// Faux Supabase Auth, pour tester la connexion de production sans compte Supabase.
// Reproduit : JWKS (ES256), création de compte (admin), envoi de lien (OTP), rafraîchissement avec rotation du jeton.
import http from 'node:http';
import { createRequire } from 'node:module';
import { generateKeyPairSync, sign, randomUUID, randomBytes } from 'node:crypto';
const require = createRequire(new URL('../server/package.json', import.meta.url));
const pg = require('pg');

export async function startMock({ port = 9099, anon = 'anon-test', service = 'svc-test', db = 'lieusaint_dev' } = {}) {
  const pool = new pg.Pool({ host: process.env.PGHOST || '/var/run/postgresql', user: process.env.PGUSER || 'root', password: process.env.PGPASSWORD || undefined, database: db, max: 3 });
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'mock-1', alg: 'ES256', use: 'sig' };
  const base = `http://localhost:${port}`;
  const st = { ttl: 3600, admin: [], otp: [], refresh: 0, links: new Map(), refreshTokens: new Map(), revokeRefresh: false };
  const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const jwt = (user, ttl = st.ttl, extra = {}) => {
    const d = `${b64u({ alg: 'ES256', typ: 'JWT', kid: 'mock-1' })}.${b64u({ sub: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', iss: `${base}/auth/v1`, exp: Math.floor(Date.now() / 1000) + ttl, ...extra })}`;
    return `${d}.${sign('sha256', Buffer.from(d), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  };
  const session = (user) => { const rt = randomBytes(12).toString('hex'); st.refreshTokens.set(rt, user.id); return { access_token: jwt(user), refresh_token: rt, expires_in: st.ttl }; };
  const read = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
  const send = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const findUser = async (email) => (await pool.query('select id, email from auth.users where lower(email) = lower($1)', [email])).rows[0];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, base); const key = req.headers.apikey;
    try {
      if (url.pathname === '/auth/v1/.well-known/jwks.json') return send(res, 200, { keys: [jwk] });
      if (url.pathname === '/auth/v1/admin/users' && req.method === 'POST') {
        if (key !== service) return send(res, 401, { msg: 'clé service requise' });
        const { email } = await read(req); st.admin.push(email);
        if (await findUser(email)) return send(res, 422, { msg: 'email_exists' });
        await pool.query('insert into auth.users (email) values (lower($1))', [email]); return send(res, 200, { email });
      }
      if (url.pathname === '/auth/v1/otp' && req.method === 'POST') {
        if (key !== anon) return send(res, 401, { msg: 'clé anon requise' });
        const body = await read(req); st.otp.push(body.email);
        const u = await findUser(body.email);
        if (!u || body.create_user !== false) return send(res, 400, { msg: 'signups_disabled' });      // inscriptions publiques désactivées
        st.links.set(u.email.toLowerCase(), { user: u, redirect: body.options?.email_redirect_to }); return send(res, 200, {});
      }
      if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
        if (key !== anon) return send(res, 401, {}); st.refresh += 1;
        const { refresh_token } = await read(req); const uid = st.refreshTokens.get(refresh_token);
        if (!uid || st.revokeRefresh) return send(res, 400, { error: 'invalid_grant' });
        st.refreshTokens.delete(refresh_token);                                                          // rotation : un refresh_token ne sert qu'une fois
        const u = (await pool.query('select id, email from auth.users where id = $1', [uid])).rows[0]; return send(res, 200, session(u));
      }
      // ---- pilotage par le test
      if (url.pathname === '/mock/link') {                                                               // lien reçu par e-mail
        const l = st.links.get((url.searchParams.get('email') || '').toLowerCase()); if (!l) return send(res, 404, {});
        const s = session(l.user); return send(res, 200, { url: `${l.redirect}#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=${s.expires_in}&token_type=bearer&type=magiclink` });
      }
      if (url.pathname === '/mock/token') { const u = await findUser(url.searchParams.get('email')); return send(res, 200, { token: jwt(u, Number(url.searchParams.get('ttl') || st.ttl)) }); }
      if (url.pathname === '/mock/config' && req.method === 'POST') { Object.assign(st, await read(req)); return send(res, 200, {}); }
      if (url.pathname === '/mock/calls') return send(res, 200, { admin: st.admin, otp: st.otp, refresh: st.refresh });
      if (url.pathname === '/mock/reset') { st.admin = []; st.otp = []; st.refresh = 0; return send(res, 200, {}); }
      send(res, 404, {});
    } catch (e) { send(res, 500, { msg: e.message }); }
  });
  await new Promise((r) => server.listen(port, r));
  return { base, publicKey, privateKey, jwk, st, close: async () => { server.close(); await pool.end(); } };
}
