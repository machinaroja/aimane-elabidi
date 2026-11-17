// Passerelle d'API de la plateforme AS Lieusaint.
// Aucune règle de droits ici : chaque requête s'exécute dans PostgreSQL au nom de l'utilisateur (RLS).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sign, verify } from './auth.mjs';
import { pool, withUser, httpError } from './db.mjs';

const PROD = process.env.NODE_ENV === 'production';
const DEV_AUTH = process.env.DEV_AUTH === '1' && !PROD;           // connexion de démonstration : jamais en production
const SECRET = process.env.SUPABASE_JWT_SECRET || (DEV_AUTH ? 'dev-secret-ne-jamais-utiliser-en-production' : '');
if (!SECRET) { console.error('SUPABASE_JWT_SECRET manquant'); process.exit(1); }
const WEB = resolve(fileURLToPath(new URL('../web/dist', import.meta.url)));

// ---------- validation ----------
const bad = (m) => Object.assign(new Error(m), { status: 400, message: m });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const v = {
  uuid: (x, n = 'identifiant') => { if (!UUID.test(String(x))) throw bad(`${n} invalide`); return x; },
  uuidOrNull: (x, n) => (x == null || x === '' ? null : v.uuid(x, n)),
  str: (x, n, max = 200, min = 1) => { const s = typeof x === 'string' ? x.trim() : ''; if (s.length < min || s.length > max) throw bad(`${n} invalide`); return s; },
  strOrNull: (x, max = 500) => (x == null || x === '' ? null : v.str(x, 'texte', max)),
  enum: (x, list, n) => { if (!list.includes(x)) throw bad(`${n} invalide`); return x; },
  ts: (x, n) => { const d = new Date(x); if (!x || isNaN(d)) throw bad(`${n} invalide`); return d.toISOString(); },
  int: (x, n, min, max) => { const i = Number(x); if (!Number.isInteger(i) || i < min || i > max) throw bad(`${n} invalide`); return i; },
  body: (x) => {                                   // contenu structuré d'une version : objet de textes / listes de textes
    if (!x || typeof x !== 'object' || Array.isArray(x)) throw bad('contenu invalide');
    const e = Object.entries(x);
    if (e.length > 20) throw bad('trop de sections');
    let total = 0;
    for (const [k, val] of e) {
      if (!k || k.length > 60) throw bad('titre de section invalide');
      const items = Array.isArray(val) ? val : [val];
      if (items.length > 100 || items.some((i) => typeof i !== 'string' || i.length > 5000)) throw bad('section invalide');
      total += k.length + items.reduce((a, i) => a + i.length, 0);
    }
    if (total > 30000) throw bad('contenu trop volumineux');
    return x;
  },
  intOrNull: (x, n, min, max) => (x == null || x === '' ? null : v.int(x, n, min, max)),
};

// ---------- routeur ----------
const routes = [];
const route = (method, path, handler, { auth = true } = {}) =>
  routes.push({ method, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, auth });
const A = (fn) => async (ctx) => withUser(ctx.user, (c) => fn(c, ctx));

// ---------- santé / connexion de démonstration ----------
route('GET', '/api/health', async () => ({ ok: true }), { auth: false });
route('GET', '/api/dev/accounts', async () => {
  if (!DEV_AUTH) throw Object.assign(new Error('introuvable'), { status: 404 });
  const r = await pool.query(`select email from auth.users where email like '%@demo.lieusaint.local' order by email`);
  return r.rows.map((x) => x.email);
}, { auth: false });
route('POST', '/api/auth/dev-login', async ({ body }) => {
  if (!DEV_AUTH) throw Object.assign(new Error('introuvable'), { status: 404 });
  const r = await pool.query(`select id, email from auth.users where email = $1 and email like '%@demo.lieusaint.local'`, [String(body.email)]);
  if (!r.rowCount) throw Object.assign(new Error('compte inconnu'), { status: 401 });
  return { token: sign({ sub: r.rows[0].id, email: r.rows[0].email, role: 'authenticated' }, SECRET) };
}, { auth: false });

// ---------- profil, structure ----------
route('GET', '/api/me', A(async (c, { user }) => {
  const m = await c.query(`select m.id, m.club_id, cl.name as club_name, m.role_key, r.label as role_label, r.scope_level
                           from memberships m join clubs cl on cl.id = m.club_id
                           join club_roles r on r.club_id = m.club_id and r.key = m.role_key
                           where m.user_id = auth.uid() and m.status = 'active' order by r.rank desc`);
  const clubIds = [...new Set(m.rows.map((x) => x.club_id))];
  const caps = {};
  for (const id of clubIds) {
    const k = await c.query(`select app.has_perm($1,null,'categories','add') as categories_add, app.has_perm($1,null,'teams','add') as teams_add,
      app.has_perm($1,null,'invitations','add') as invitations_add, app.has_perm($1,null,'methodology','add') as methodology_add, app.has_perm($1,null,'methodology','edit') as methodology_edit,
      app.has_perm($1,null,'calendar','add') as club_events_add, app.has_perm($1,null,'calendar','administer') as calendar_admin,
      app.has_perm($1,null,'players','view') as players_view_all`, [id]);
    caps[id] = k.rows[0];
  }
  return { email: user.email, memberships: m.rows, club_caps: caps };
}));

route('GET', '/api/teams', A(async (c) => (await c.query(
  `select t.id, t.club_id, t.name, t.category_id, ca.name as category, ca.sort_order,
          app.has_perm(t.club_id, t.id, 'calendar', 'add')      as can_event,
          app.has_perm(t.club_id, t.id, 'players', 'add')       as can_player,
          app.has_perm(t.club_id, t.id, 'attendance', 'add')    as can_attendance,
          app.has_perm(t.club_id, t.id, 'convocations', 'add')  as can_convoke,
          app.has_perm(t.club_id, t.id, 'matches', 'edit')      as can_match,
          app.has_perm(t.club_id, t.id, 'players', 'view')      as can_view_players,
          app.has_perm(t.club_id, t.id, 'players', 'edit')      as can_transfer
   from teams t join categories ca on ca.id = t.category_id
   order by ca.sort_order, ca.name, t.name`)).rows));
route('GET', '/api/categories', A(async (c) => (await c.query(`select id, club_id, name, age_min, age_max, sort_order from categories order by sort_order, name`)).rows));
route('GET', '/api/seasons', A(async (c) => (await c.query(`select id, club_id, label, is_current from seasons order by starts_on desc`)).rows));
route('POST', '/api/categories', A(async (c, { body }) => (await c.query(
  `insert into categories (club_id, name, age_min, age_max) values ($1,$2,$3,$4) returning id, name`,
  [v.uuid(body.club_id, 'club'), v.str(body.name, 'nom', 60), v.intOrNull(body.age_min, 'âge min', 3, 99), v.intOrNull(body.age_max, 'âge max', 3, 99)])).rows[0]));
route('POST', '/api/teams', A(async (c, { body }) => (await c.query(
  `insert into teams (club_id, season_id, category_id, name) values ($1,$2,$3,$4) returning id, name`,
  [v.uuid(body.club_id, 'club'), v.uuid(body.season_id, 'saison'), v.uuid(body.category_id, 'catégorie'), v.str(body.name, 'nom', 30)])).rows[0]));
route('GET', '/api/facilities', A(async (c) => (await c.query(`select id, name, kind from facilities order by name`)).rows));

// ---------- calendrier ----------
route('GET', '/api/events', A(async (c, { query }) => {
  const from = query.from ? v.ts(query.from, 'début') : new Date(Date.now() - 7 * 864e5).toISOString();
  const to = query.to ? v.ts(query.to, 'fin') : new Date(Date.now() + 90 * 864e5).toISOString();
  const team = v.uuidOrNull(query.team, 'équipe');
  return (await c.query(
    `select e.id, e.team_id, t.name as team_name, ca.name as category, e.kind, e.title, e.starts_at, e.ends_at, e.status,
            (e.external_id is not null) as official, e.time_known, e.competition, f.name as facility,
            d.opponent, d.home_away, d.our_score, d.their_score, d.status as match_status
     from events e
     left join teams t on t.id = e.team_id left join categories ca on ca.id = t.category_id
     left join facilities f on f.id = e.facility_id left join match_details d on d.event_id = e.id
     where e.starts_at >= $1 and e.starts_at < $2 and ($3::uuid is null or e.team_id = $3)
     order by e.starts_at limit 1500`, [from, to, team])).rows;
}));
route('POST', '/api/events', A(async (c, { body }) => (await c.query(
  `select public.create_event($1,$2,$3,$4,$5,$6,$7,$8) as id`,
  [v.uuid(body.club_id, 'club'), v.uuidOrNull(body.team_id, 'équipe'), v.enum(body.kind, ['training', 'match', 'tournament', 'event', 'meeting'], 'type'),
   v.str(body.title, 'titre', 120), v.ts(body.starts_at, 'début'), v.ts(body.ends_at, 'fin'), v.uuidOrNull(body.facility_id, 'installation'), body.force === true])).rows[0]));
route('POST', '/api/events/:id/reschedule', A(async (c, { params, body }) => {
  await c.query(`select public.reschedule_event($1,$2,$3,$4,$5)`, [v.uuid(params.id), v.ts(body.starts_at, 'début'), v.ts(body.ends_at, 'fin'), v.uuidOrNull(body.facility_id), body.force === true]);
  return { ok: true };
}));
route('POST', '/api/events/:id/cancel', A(async (c, { params }) => { await c.query(`select public.cancel_event($1)`, [v.uuid(params.id)]); return { ok: true }; }));

// Fiche d'un événement : joueurs de l'équipe à la date, présences, convocations, match.
route('GET', '/api/events/:id/sheet', A(async (c, { params }) => {
  const id = v.uuid(params.id);
  const e = (await c.query(
    `select e.id, e.club_id, e.team_id, t.name as team_name, ca.name as category, e.kind, e.title, e.starts_at, e.ends_at, e.status,
            (e.external_id is not null) as official, e.time_known, e.competition,
            app.event_perm(e.id,'attendance','add') as can_attendance, app.event_perm(e.id,'convocations','add') as can_convoke,
            app.event_perm(e.id,'matches','edit') as can_match, app.event_perm(e.id,'calendar','edit') as can_edit
     from events e left join teams t on t.id = e.team_id left join categories ca on ca.id = t.category_id where e.id = $1`, [id])).rows[0];
  if (!e) throw Object.assign(new Error('Événement introuvable.'), { status: 404 });
  const players = (await c.query(
    `select p.id, p.first_name, p.last_name, a.status as attendance, a.minutes_late, cv.status as convocation
     from players p
     join player_team_history h on h.player_id = p.id and h.team_id = $2 and h.started_on <= $3::date and (h.ended_on is null or h.ended_on >= $3::date)
     left join attendance_records a on a.event_id = $1 and a.player_id = p.id
     left join convocations cv on cv.event_id = $1 and cv.player_id = p.id
     order by p.last_name, p.first_name`, [id, e.team_id, e.starts_at])).rows;
  const match = (await c.query(`select opponent, home_away, competition, our_score, their_score, lineup, notes, status, forfeit_by_us from match_details where event_id = $1`, [id])).rows[0] || null;
  return { event: e, players, match };
}));
route('POST', '/api/events/:id/attendance', A(async (c, { params, body }) => {
  await c.query(`select public.record_attendance($1,$2,$3,$4,$5)`, [v.uuid(params.id), v.uuid(body.player_id, 'joueur'),
    v.enum(body.status, ['present', 'absent', 'late', 'excused'], 'statut'), v.intOrNull(body.minutes_late, 'retard', 0, 240), v.strOrNull(body.note)]);
  return { ok: true };
}));
route('POST', '/api/events/:id/convocations', A(async (c, { params, body }) => {
  if (!Array.isArray(body.player_ids) || body.player_ids.length > 60) throw bad('liste de joueurs invalide');
  const r = await c.query(`select public.convoke_players($1,$2::uuid[]) as n`, [v.uuid(params.id), body.player_ids.map((x) => v.uuid(x, 'joueur'))]);
  return r.rows[0];
}));
route('POST', '/api/events/:id/convocations/response', A(async (c, { params, body }) => {
  await c.query(`select public.set_convocation_response($1,$2,$3,$4)`, [v.uuid(params.id), v.uuid(body.player_id, 'joueur'), v.enum(body.status, ['pending', 'accepted', 'declined', 'maybe'], 'réponse'), v.strOrNull(body.note)]);
  return { ok: true };
}));
route('POST', '/api/events/:id/match', A(async (c, { params, body }) => {
  const lineup = Array.isArray(body.lineup) ? body.lineup.map((x) => v.uuid(x, 'joueur')) : [];
  await c.query(`select public.save_match($1,$2,$3,$4,$5,$6,$7::uuid[],$8)`, [v.uuid(params.id), v.str(body.opponent, 'adversaire', 100), v.enum(body.home_away, ['home', 'away', 'neutral'], 'lieu'),
    v.strOrNull(body.competition, 100), v.intOrNull(body.our_score, 'score', 0, 99), v.intOrNull(body.their_score, 'score', 0, 99), lineup, v.strOrNull(body.notes, 2000)]);
  return { ok: true };
}));

// ---------- effectif ----------
route('GET', '/api/teams/:id/players', A(async (c, { params }) => (await c.query(
  `select p.id, p.first_name, p.last_name, p.birth_date, p.license_no, h.started_on
   from players p join player_team_history h on h.player_id = p.id and h.ended_on is null and h.team_id = $1
   order by p.last_name, p.first_name`, [v.uuid(params.id, 'équipe')])).rows));
route('POST', '/api/teams/:id/players', A(async (c, { params, body }) => (await c.query(`select public.add_player($1,$2,$3,$4,$5) as id`,
  [v.uuid(params.id, 'équipe'), v.str(body.first_name, 'prénom', 60), v.str(body.last_name, 'nom', 60), body.birth_date ? v.ts(body.birth_date, 'date').slice(0, 10) : null, v.strOrNull(body.license_no, 30)])).rows[0]));

route('GET', '/api/players/:id/history', A(async (c, { params }) => (await c.query(
  `select h.id, h.started_on, h.ended_on, t.name as team_name, ca.name as category
   from player_team_history h left join teams t on t.id = h.team_id left join categories ca on ca.id = t.category_id
   where h.player_id = $1 order by h.started_on desc, h.ended_on desc nulls first`, [v.uuid(params.id, 'joueur')])).rows));
route('POST', '/api/players/:id/transfer', A(async (c, { params, body }) => {
  await c.query(`select public.transfer_player($1,$2)`, [v.uuid(params.id, 'joueur'), v.uuid(body.to_team_id, 'équipe')]);
  return { ok: true };
}));

// ---------- méthodologie et espace personnel ----------
route('GET', '/api/methodology', A(async (c) => (await c.query(
  `select i.id, i.club_id, i.kind, i.title, i.status, i.category_id, ca.name as category, vv.id as version_id, vv.version_no, vv.published_at, vv.body,
          exists (select 1 from methodology_versions d where d.item_id = i.id and d.status = 'draft') as has_draft
   from methodology_items i left join categories ca on ca.id = i.category_id
   left join methodology_versions vv on vv.id = i.current_version_id
   order by i.kind, i.title`)).rows));

// Historique des versions (les éducateurs ne voient que le publié ; la direction technique voit aussi les brouillons).
route('GET', '/api/methodology/:id/versions', A(async (c, { params }) => (await c.query(
  `select v.id, v.version_no, v.status, v.change_note, v.body, v.created_at, v.published_at,
          (select count(*) from methodology_reads r where r.version_id = v.id) as reads
   from methodology_versions v where v.item_id = $1 order by v.version_no desc`, [v.uuid(params.id)])).rows));

route('POST', '/api/methodology', A(async (c, { body }) => {
  const club = v.uuid(body.club_id, 'club');
  const item = (await c.query(`insert into methodology_items (club_id, kind, title, category_id, created_by) values ($1,$2,$3,$4,auth.uid()) returning id`,
    [club, v.enum(body.kind, ['philosophy','principle','document','reference_session','exercise','scheme','objective','behavior','coaching_cue','correction','progression'], 'type'),
     v.str(body.title, 'titre', 160), v.uuidOrNull(body.category_id, 'catégorie')])).rows[0];
  const ver = (await c.query(`insert into methodology_versions (club_id, item_id, body, change_note) values ($1,$2,$3::jsonb,$4) returning id, version_no`,
    [club, item.id, JSON.stringify(v.body(body.content)), v.strOrNull(body.change_note, 300) ?? 'Création'])).rows[0];
  return { item_id: item.id, version_id: ver.id, version_no: ver.version_no };
}));
route('POST', '/api/methodology/:id/meta', A(async (c, { params, body }) => {
  const r = await c.query(`update methodology_items set title = $2, category_id = $3 where id = $1`, [v.uuid(params.id), v.str(body.title, 'titre', 160), v.uuidOrNull(body.category_id, 'catégorie')]);
  if (!r.rowCount) throw Object.assign(new Error('Contenu introuvable ou droits insuffisants.'), { status: 403 });
  return { ok: true };
}));
// Nouvelle version (brouillon) à partir de la version courante ; un seul brouillon à la fois.
route('POST', '/api/methodology/:id/versions', A(async (c, { params, body }) => {
  const id = v.uuid(params.id);
  const it = (await c.query(`select id, club_id, current_version_id from methodology_items where id = $1`, [id])).rows[0];
  if (!it) throw Object.assign(new Error('Contenu introuvable.'), { status: 404 });
  if ((await c.query(`select 1 from methodology_versions where item_id = $1 and status = 'draft'`, [id])).rowCount) throw Object.assign(new Error('Un brouillon est déjà en cours : modifiez-le ou publiez-le.'), { status: 409 });
  const content = body.content ? v.body(body.content) : ((await c.query(`select body from methodology_versions where id = $1`, [it.current_version_id])).rows[0]?.body ?? {});
  const ver = (await c.query(`insert into methodology_versions (club_id, item_id, body, change_note) values ($1,$2,$3::jsonb,$4) returning id, version_no`,
    [it.club_id, id, JSON.stringify(content), v.strOrNull(body.change_note, 300)])).rows[0];
  return { version_id: ver.id, version_no: ver.version_no };
}));
route('POST', '/api/methodology/versions/:vid/update', A(async (c, { params, body }) => {
  const r = await c.query(`update methodology_versions set body = $2::jsonb, change_note = $3 where id = $1 and status = 'draft'`, [v.uuid(params.vid), JSON.stringify(v.body(body.content)), v.strOrNull(body.change_note, 300)]);
  if (!r.rowCount) throw Object.assign(new Error('Brouillon introuvable, déjà publié ou droits insuffisants.'), { status: 409 });
  return { ok: true };
}));
route('POST', '/api/methodology/versions/:vid/publish', A(async (c, { params }) => { await c.query(`select public.publish_methodology_version($1)`, [v.uuid(params.vid)]); return { ok: true }; }));
route('POST', '/api/methodology/versions/:vid/discard', A(async (c, { params }) => {
  const ver = (await c.query(`select item_id from methodology_versions where id = $1 and status = 'draft'`, [v.uuid(params.vid)])).rows[0];
  if (!ver) throw Object.assign(new Error('Brouillon introuvable ou déjà publié.'), { status: 409 });
  await c.query(`delete from methodology_versions where id = $1 and status = 'draft'`, [params.vid]);
  const left = (await c.query(`select 1 from methodology_versions where item_id = $1`, [ver.item_id])).rowCount;
  if (!left) await c.query(`delete from methodology_items where id = $1`, [ver.item_id]);         // contenu jamais publié : on le retire
  return { ok: true };
}));
// Suivi de diffusion : « lu par » (alimente les besoins de formation de la direction technique).
route('POST', '/api/methodology/versions/:vid/read', A(async (c, { params }) => {
  await c.query(`insert into methodology_reads (club_id, version_id) select club_id, id from methodology_versions where id = $1 on conflict do nothing`, [v.uuid(params.vid)]);
  return { ok: true };
}));
route('POST', '/api/methodology/:id/copy', A(async (c, { params, body }) => (await c.query(`select public.copy_to_personal($1,$2) as id`, [v.uuid(params.id), v.uuidOrNull(body.team_id, 'équipe')])).rows[0]));
route('GET', '/api/personal-sessions', A(async (c) => (await c.query(
  `select s.id, s.title, s.body, s.created_at, t.name as team_name, ca.name as category
   from personal_sessions s left join teams t on t.id = s.team_id left join categories ca on ca.id = t.category_id
   where s.owner_id = auth.uid() order by s.created_at desc`)).rows));

// ---------- invitations ----------
route('GET', '/api/invitations', A(async (c) => (await c.query(
  `select i.id, i.email, i.role_key, i.expires_at, i.accepted_at, i.revoked_at, t.name as team_name, ca.name as category
   from invitations i left join teams t on t.id = i.team_id left join categories ca on ca.id = coalesce(i.category_id, t.category_id)
   order by i.created_at desc limit 200`)).rows));
route('POST', '/api/invitations', A(async (c, { body }) => (await c.query(`select public.create_invitation($1,$2,$3,$4,$5) as token`,
  [v.uuid(body.club_id, 'club'), v.str(body.email, 'e-mail', 200).toLowerCase(), v.enum(body.role_key, ['direction', 'directeur_technique', 'responsable_categorie', 'entraineur', 'adjoint'], 'rôle'),
   v.uuidOrNull(body.team_id, 'équipe'), v.uuidOrNull(body.category_id, 'catégorie')])).rows[0]));
route('POST', '/api/invitations/accept', A(async (c, { body }) => (await c.query(`select public.accept_invitation($1) as club_id`, [v.str(body.token, 'jeton', 100)])).rows[0]));

// ---------- serveur ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' };
const SEC = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'",
};
const send = (res, status, data, extra = {}) => {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': typeof data === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC, ...extra });
  res.end(body);
};
async function readBody(req) {
  const chunks = []; let n = 0;
  for await (const ch of req) { n += ch.length; if (n > 100_000) throw bad('corps trop volumineux'); chunks.push(ch); }
  if (!n) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw bad('JSON invalide'); }
}
async function serveStatic(req, res) {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(WEB, p);
  if (!file.startsWith(WEB) || !existsSync(file) || p === '/' || p.endsWith('/')) file = join(WEB, 'index.html');   // SPA
  if (!existsSync(file)) return send(res, 404, 'Interface non construite (npm run build dans web/).');
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', ...SEC });
  res.end(await readFile(file));
}

export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);
    const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
    if (!r) return send(res, 404, { error: 'Introuvable.' });
    let user = null;
    if (r.auth) {
      const h = req.headers.authorization || '';
      user = h.startsWith('Bearer ') ? verify(h.slice(7), SECRET) : null;
      if (!user) return send(res, 401, { error: 'Connexion requise.' });
    }
    const body = req.method === 'GET' ? {} : await readBody(req);
    const out = await r.handler({ user, body, query: Object.fromEntries(url.searchParams), params: url.pathname.match(r.re).groups || {} });
    send(res, 200, out);
  } catch (e) {
    const h = httpError(e);
    send(res, h.status, { error: h.message });
  }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  server.listen(port, () => console.log(`API AS Lieusaint sur http://localhost:${port}${DEV_AUTH ? '  (connexion de démonstration ACTIVE)' : ''}`));
}
