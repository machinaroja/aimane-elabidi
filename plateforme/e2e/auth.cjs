// Connexion de PRODUCTION de bout en bout : navigateur -> passerelle (NODE_ENV=production) -> faux Supabase Auth -> PostgreSQL.
const { chromium } = require('playwright');
const { execSync, spawn } = require('node:child_process');
const { createHmac, generateKeyPairSync, sign: cSign } = require('node:crypto');
const PORT = 8899, MOCK = 9099, BASE = `http://localhost:${PORT}`;
const sql = (q) => execSync(`psql -X -At -d lieusaint_dev -c "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
let pass = 0, fail = 0; const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? '✔' : '❌'} ${n}${c ? '' : ' ' + x}`); };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})), headers: r.headers });
const post = (path, body, tok) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify(body) }).then(j);
const get = (path, tok) => fetch(`${BASE}${path}`, { headers: tok ? { authorization: `Bearer ${tok}` } : {} }).then(j);
const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

(async () => {
  execSync(`${__dirname}/../dev.sh`, { stdio: 'ignore' });
  const { startMock } = await import('./mock-supabase.mjs'); const mock = await startMock({ port: MOCK });
  const mget = (p) => fetch(`http://localhost:${MOCK}${p}`).then((r) => r.json()); const mpost = (p, b) => fetch(`http://localhost:${MOCK}${p}`, { method: 'POST', body: JSON.stringify(b) });
  const gw = spawn('node', [`${__dirname}/../server/index.mjs`], { env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), DATABASE_URL: `postgresql://gateway:gw-test-pass@${process.env.PGHOST && !process.env.PGHOST.startsWith('/') ? process.env.PGHOST : 'localhost'}/lieusaint_dev`,   // rôle restreint, comme en production
    SUPABASE_URL: `http://localhost:${MOCK}`, SUPABASE_ANON_KEY: 'anon-test', SUPABASE_SERVICE_ROLE_KEY: 'svc-test', SITE_URL: BASE }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; gw.stdout.on('data', (d) => (logs += d)); gw.stderr.on('data', (d) => (logs += d));
  for (let i = 0; i < 50 && !(await fetch(`${BASE}/healthz`).then((r) => r.ok).catch(() => false)); i++) await new Promise((r) => setTimeout(r, 200));
  const browser = await chromium.launch();
  try {
    // ---------- 1. mode production : pas de connexion de démonstration
    const cfg = await get('/api/config'); ok('config : mode « supabase »', cfg.body.mode === 'supabase');
    ok('production : la connexion de démonstration n\'existe pas (404)', (await post('/api/auth/dev-login', { email: 'dt@demo.lieusaint.local' })).status === 404 && (await get('/api/dev/accounts')).status === 404);
    ok('santé : /healthz et /readyz répondent', (await get('/healthz')).status === 200 && (await get('/readyz')).status === 200);
    const h = (await get('/healthz')).headers;
    ok('en-têtes de sécurité : HSTS, CSP, nosniff, anti-cadre', /max-age=31536000/.test(h.get('strict-transport-security') || '') && /frame-ancestors 'none'/.test(h.get('content-security-policy') || '') && h.get('x-content-type-options') === 'nosniff' && h.get('x-frame-options') === 'DENY' && !h.get('x-powered-by'));

    const direct = await post('/api/auth/dev-login', {}); void direct;
    ok('la passerelle tourne avec le rôle « gateway » (aucun droit direct sur les tables)', sql(`select count(*) from pg_stat_activity where usename='gateway' and datname='lieusaint_dev'`) >= '1' && sql(`select has_table_privilege('gateway','public.players','select')`) === 'f');

    // ---------- 2. attaques sur les jetons
    const dt = await (await fetch(`http://localhost:${MOCK}/mock/token?email=dt@demo.lieusaint.local`)).json();
    ok('jeton valide du faux Supabase : accepté', (await get('/api/me', dt.token)).status === 200);
    ok('sans jeton : 401', (await get('/api/me')).status === 401);
    const other = generateKeyPairSync('ec', { namedCurve: 'P-256' }); const uid = sql(`select id from auth.users where email='dt@demo.lieusaint.local'`);
    const claims = { sub: uid, email: 'dt@demo.lieusaint.local', aud: 'authenticated', iss: `http://localhost:${MOCK}/auth/v1`, exp: Math.floor(Date.now() / 1000) + 600 };
    const forged = (() => { const d = `${b64u({ alg: 'ES256', typ: 'JWT', kid: 'mock-1' })}.${b64u(claims)}`; return `${d}.${cSign('sha256', Buffer.from(d), { key: other.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`; })();
    ok('jeton signé avec une AUTRE clé (usurpation de la direction technique) : 401', (await get('/api/me', forged)).status === 401);
    const devTok = (() => { const d = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ ...claims, iss: undefined })}`; return `${d}.${createHmac('sha256', 'dev-secret-ne-jamais-utiliser-en-production').update(d).digest('base64url')}`; })();
    ok('jeton de DÉMONSTRATION (secret connu du dépôt) : refusé en production', (await get('/api/me', devTok)).status === 401);
    const confusion = (() => { const d = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(claims)}`; return `${d}.${createHmac('sha256', JSON.stringify(mock.jwk)).update(d).digest('base64url')}`; })();
    ok('confusion d\'algorithme (HS256 signé avec la clé publique) : 401', (await get('/api/me', confusion)).status === 401);
    const none = `${b64u({ alg: 'none', kid: 'mock-1' })}.${b64u(claims)}.c2ln`; ok('alg « none » : 401', (await get('/api/me', none)).status === 401);
    const expired = (await (await fetch(`http://localhost:${MOCK}/mock/token?email=dt@demo.lieusaint.local&ttl=-30`)).json()).token; ok('jeton expiré : 401', (await get('/api/me', expired)).status === 401);
    const wrongIss = (() => { const d = `${b64u({ alg: 'ES256', typ: 'JWT', kid: 'mock-1' })}.${b64u({ ...claims, iss: 'https://pirate.example/auth/v1' })}`; return `${d}.${cSign('sha256', Buffer.from(d), { key: mock.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`; })();
    ok('bon sceau mais mauvais émetteur : 401', (await get('/api/me', wrongIss)).status === 401);
    const ghost = (() => { const d = `${b64u({ alg: 'ES256', typ: 'JWT', kid: 'mock-1' })}.${b64u({ ...claims, sub: '00000000-0000-4000-8000-000000000000', email: 'fantome@x.fr' })}`; return `${d}.${cSign('sha256', Buffer.from(d), { key: mock.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`; })();
    const gme = await get('/api/me', ghost); ok('compte authentifié mais SANS rôle dans le club : aucune donnée', gme.status === 200 && gme.body.memberships.length === 0 && (await get('/api/teams', ghost.valueOf())).body.length === 0);

    // ---------- 3. lien de connexion : adresse inconnue
    await fetch(`http://localhost:${MOCK}/mock/reset`);
    const t0 = Date.now(); const unknown = await post('/api/auth/request-link', { email: 'inconnu@pirate.example' }); const dUnknown = Date.now() - t0;
    let calls = await mget('/mock/calls');
    ok('adresse inconnue : réponse neutre et AUCUN compte créé, AUCUN e-mail envoyé', unknown.status === 200 && /connue du club/.test(unknown.body.message) && calls.admin.length === 0 && calls.otp.length === 0);
    const t1 = Date.now(); const known = await post('/api/auth/request-link', { email: 'dt@demo.lieusaint.local' }); const dKnown = Date.now() - t1;
    ok('adresse connue : MÊME réponse que l\'adresse inconnue (pas d\'énumération)', JSON.stringify(known.body) === JSON.stringify(unknown.body) && known.status === unknown.status);
    ok('durée de réponse indépendante de l\'adresse (≥ 650 ms dans les deux cas, écart < 400 ms)', dUnknown >= 650 && dKnown >= 650 && Math.abs(dKnown - dUnknown) < 400, `${dUnknown} / ${dKnown} ms`);
    ok('adresse malformée refusée (400)', (await post('/api/auth/request-link', { email: 'pas-une-adresse' })).status === 400 && (await post('/api/auth/request-link', { email: 'a@b.c\nbcc:pirate@x.fr' })).status === 400);
    ok('membre existant : l\'inscription publique n\'est JAMAIS demandée (create_user=false)', (await mget('/mock/calls')).otp.length === 1);

    // ---------- 4. membre existant : lien -> connexion -> hash nettoyé -> session conservée
    const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1100, height: 800 } }); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(BASE); await page.waitForSelector('#mail');
    ok('page de connexion : saisie d\'e-mail, aucune liste de comptes de démonstration', await page.locator('#acc').count() === 0 && await page.locator('text=Recevoir mon lien').count() === 1);
    await page.fill('#mail', 'resp-u14@demo.lieusaint.local'); await page.click('button:has-text("Recevoir mon lien")'); await page.waitForSelector('text=connue du club');
    const link = (await mget('/mock/link?email=resp-u14@demo.lieusaint.local')).url;
    ok('le lien reçu pointe vers le site du club', link.startsWith(`${BASE}/#access_token=`));
    await page.goto(link); await page.waitForSelector('header.top');
    ok('connexion par le lien : le responsable U14 est connecté', await page.locator('[data-testid=who]').count() === 1 && await page.locator('nav >> text=Tableau de bord').count() === 1);
    ok('les jetons ont été RETIRÉS de l\'adresse (historique, partage d\'écran)', !/access_token|refresh_token/.test(page.url()));
    await page.reload(); await page.waitForSelector('header.top');
    ok('la session survit au rechargement de la page', await page.locator('[data-testid=who]').count() === 1);
    ok('le jeton n\'est pas dans le stockage permanent (localStorage vide)', (await page.evaluate(() => localStorage.length)) === 0);

    // ---------- 5. invitation d'un NOUVEL éducateur (sans compte) par lien
    const clubId = sql('select id from clubs limit 1'); const t12 = sql(`select t.id from teams t join categories c on c.id=t.category_id where c.name='U12' and t.name='1'`);
    const dtUid = uid; const inviteToken = sql(`select set_config('request.jwt.claims', json_build_object('sub','${dtUid}','email','dt@demo.lieusaint.local')::text, false); set role authenticated; select public.create_invitation('${clubId}','recrue@club-exemple.fr','entraineur','${t12}')`).split('\n').pop();
    ok('invitation créée (jeton à usage unique)', /^[0-9a-f]{48}$/.test(inviteToken), inviteToken);
    await mget('/mock/reset');
    const ctx2 = await browser.newContext({ locale: 'fr-FR' }); const p2 = await ctx2.newPage(); const errs2 = []; p2.on('pageerror', (e) => errs2.push(e.message));
    await p2.goto(`${BASE}/?invite=${inviteToken}`); await p2.waitForSelector('#mail');
    ok('lien d\'invitation : bandeau explicatif et jeton retiré de l\'adresse', await p2.locator('text=Vous avez reçu une invitation').count() === 1 && !/invite=/.test(p2.url()));
    await p2.fill('#mail', 'recrue@club-exemple.fr'); await p2.press('#mail', 'Enter'); await p2.waitForSelector('text=connue du club');
    calls = await mget('/mock/calls');
    ok('adresse invitée : compte créé côté authentification + e-mail envoyé', calls.admin.includes('recrue@club-exemple.fr') && calls.otp.length === 1);
    await p2.goto((await mget('/mock/link?email=recrue@club-exemple.fr')).url); await p2.waitForSelector('.grid .card h3');
    ok('après le lien : l\'invitation est acceptée automatiquement, l\'éducateur voit son équipe (U12 1)', (await p2.locator('.grid .card h3').allInnerTexts()).join() === 'U12 1');
    ok('base : rôle et affectation créés, invitation consommée', sql(`select count(*) from memberships m join auth.users u on u.id=m.user_id where u.email='recrue@club-exemple.fr' and m.role_key='entraineur'`) === '1' && sql(`select count(*) from invitations where email='recrue@club-exemple.fr' and accepted_at is not null`) === '1');
    ok('jeton d\'invitation effacé du navigateur après usage', (await p2.evaluate(() => sessionStorage.getItem('lieusaint.invite'))) === null);
    ok('la recrue ne voit aucune autre équipe ni aucune autre catégorie', (await get('/api/teams', (await (await fetch(`http://localhost:${MOCK}/mock/token?email=recrue@club-exemple.fr`)).json()).token)).body.length === 1);

    // invitation détournée : un AUTRE membre ouvre le lien d'invitation d'autrui
    const stolen = sql(`select set_config('request.jwt.claims', json_build_object('sub','${dtUid}','email','dt@demo.lieusaint.local')::text, false); set role authenticated; select public.create_invitation('${clubId}','victime@club-exemple.fr','adjoint','${t12}')`).split('\n').pop();
    const ctx3 = await browser.newContext({ locale: 'fr-FR' }); const p3 = await ctx3.newPage();
    await p3.goto(`${BASE}/?invite=${stolen}`); await p3.waitForSelector('#mail'); await p3.fill('#mail', 'coach-u14@demo.lieusaint.local'); await p3.click('button:has-text("Recevoir mon lien")'); await p3.waitForSelector('text=connue du club');
    await p3.goto((await mget('/mock/link?email=coach-u14@demo.lieusaint.local')).url); await p3.waitForSelector('header.top');
    ok('invitation volée : refusée (adresse différente), rien n\'est attribué à l\'usurpateur', await p3.locator('.err').count() >= 1 && sql(`select count(*) from memberships m join auth.users u on u.id=m.user_id where u.email='coach-u14@demo.lieusaint.local'`) === '1' && sql(`select accepted_at is null from invitations where email='victime@club-exemple.fr'`) === 't');

    // ---------- 6. prolongation de session (jeton court) puis révocation
    await mpost('/mock/config', { ttl: 3 }); await mget('/mock/reset');
    const ctx4 = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1100, height: 800 } }); const p4 = await ctx4.newPage();
    await p4.goto(BASE); await p4.fill('#mail', 'coach-seniors1@demo.lieusaint.local'); await p4.click('button:has-text("Recevoir mon lien")'); await p4.waitForSelector('text=connue du club');
    await p4.goto((await mget('/mock/link?email=coach-seniors1@demo.lieusaint.local')).url); await p4.waitForSelector('header.top');
    await p4.waitForTimeout(4200);                                                                   // le jeton d'accès (3 s) a expiré
    await p4.click('nav >> text=Calendrier'); await p4.waitForSelector('h1:has-text("Calendrier")'); await p4.waitForSelector('text=Chargement…', { state: 'detached' });
    ok('jeton expiré : la session est prolongée SANS déconnecter l\'utilisateur', await p4.locator('header.top').count() === 1 && (await mget('/mock/calls')).refresh >= 1 && await p4.locator('.ev').count() > 0);
    await mpost('/mock/config', { revokeRefresh: true }); await p4.waitForTimeout(3600);
    await p4.click('nav >> text=Effectif').catch(() => {}); await p4.waitForSelector('#mail', { timeout: 8000 }).catch(() => {});
    ok('session révoquée côté Supabase : retour à la page de connexion, session effacée', await p4.locator('#mail').count() === 1 && (await p4.evaluate(() => sessionStorage.length)) === 0);
    await mpost('/mock/config', { revokeRefresh: false, ttl: 3600 });

    // ---------- 7. déconnexion
    await page.click('text=Déconnexion'); await page.waitForSelector('#mail');
    ok('déconnexion : plus aucun jeton dans le navigateur', (await page.evaluate(() => sessionStorage.length)) === 0);
    ok('lien expiré / déjà utilisé : message clair sur la page de connexion', await (async () => { await page.goto(`${BASE}/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`); await page.waitForSelector('#mail'); return (await page.locator('[role=alert]').innerText()).includes('expiré'); })());
    ok('aucune erreur JavaScript pendant les parcours', errs.length + errs2.length === 0, errs.concat(errs2).join('|'));

    // ---------- 8. limitation de débit (en dernier : consomme le quota de cette adresse IP)
    await mget('/mock/reset');
    const burst = await Promise.all(Array.from({ length: 5 }, () => post('/api/auth/request-link', { email: 'coach-u14@demo.lieusaint.local' })));
    ok('5 demandes pour la même adresse : au plus 3 e-mails réellement envoyés', (await mget('/mock/calls')).otp.length <= 3 && burst.every((r) => r.status === 200 || r.status === 429));
    await mget('/mock/reset');
    const flood = await Promise.all(Array.from({ length: 20 }, (_, i) => post('/api/auth/request-link', { email: `spam${i}@pirate.example` })));
    ok('inondation depuis une même IP : limitée (429) après le quota', flood.some((r) => r.status === 429) && (await mget('/mock/calls')).admin.length === 0);
    ok('aucun compte créé pour les adresses inconnues', sql(`select count(*) from auth.users where email like 'spam%'`) === '0');
    const logsOk = !/dt@demo|coach-u14@|eyJ|access_token|svc-test|anon-test/.test(logs);
    ok('journaux du serveur : aucune adresse e-mail, aucun jeton, aucune clé', logsOk, logs.split('\n').filter((l) => /@|eyJ|svc-test/.test(l)).slice(0, 2).join(' | '));
  } finally {
    await browser.close(); gw.kill('SIGTERM'); await mock.close();
  }
  console.log(`\nBilan connexion de production : ${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
