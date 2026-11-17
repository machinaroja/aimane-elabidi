// Passerelle d'API de la plateforme AS Lieusaint.
// Aucune règle de droits ici : chaque requête s'exécute dans PostgreSQL au nom de l'utilisateur (RLS).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sign } from './auth.mjs';
import { pool, withUser, httpError } from './db.mjs';
import { loadConfig } from './config.mjs';
import { createVerifier } from './verifier.mjs';
import { createAuthClient } from './supabase.mjs';
import { createLimiter } from './ratelimit.mjs';

const log = (o) => console.log(JSON.stringify({ t: new Date().toISOString(), ...o }));       // journaux JSON, jamais d'e-mail ni de jeton
const { config: cfg, errors: cfgErrors } = loadConfig();
if (cfgErrors.length) { console.error('Configuration invalide :\n - ' + cfgErrors.join('\n - ')); process.exit(1); }
const PROD = cfg.prod, DEV_AUTH = cfg.devAuth;
const DEV_SECRET = 'dev-secret-ne-jamais-utiliser-en-production';
const verify = DEV_AUTH
  ? createVerifier({ hsSecret: DEV_SECRET })                                                 // démonstration : jetons HS256 locaux
  : createVerifier({ issuer: `${cfg.supabaseUrl}/auth/v1`, jwksUrl: `${cfg.supabaseUrl}/auth/v1/.well-known/jwks.json`, hsSecret: cfg.jwtSecret, onWarn: (m) => log({ level: 'warn', msg: m }) });
const authClient = !DEV_AUTH && cfg.supabaseUrl ? createAuthClient({ url: cfg.supabaseUrl, anonKey: cfg.anonKey, serviceKey: cfg.serviceKey }) : null;
const limit = createLimiter();
const clientIp = (req) => (cfg.trustProxy ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || 'inconnue';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
route('GET', '/api/config', async () => ({ mode: DEV_AUTH ? 'dev' : 'supabase' }), { auth: false });

// Lien de connexion : UNIQUEMENT pour une adresse invitée ou déjà membre. Réponse identique dans tous les cas
// (pas d'énumération des adresses) et durée minimale constante.
route('POST', '/api/auth/request-link', async ({ body, ip }) => {
  const t0 = Date.now();
  const generic = { ok: true, message: 'Si cette adresse est connue du club, un lien de connexion vient d\'être envoyé.' };
  if (!authClient) throw Object.assign(new Error('introuvable'), { status: 404 });
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email) || email.length > 254) throw bad('adresse e-mail invalide');
  const byIp = limit(`link-ip:${ip}`, 15, 600_000);
  if (!byIp.allowed) throw Object.assign(new Error('Trop de demandes. Réessayez dans quelques minutes.'), { status: 429 });
  const byMail = limit(`link-mail:${email}`, 3, 600_000);
  try {
    if (byMail.allowed) {
      const allowed = (await pool.query(`select app.auth_email_allowed($1) as ok`, [email])).rows[0].ok;
      if (allowed) { await authClient.ensureUser(email); await authClient.sendLink(email, `${cfg.siteUrl}/`); }
    }
  } catch (e) { log({ level: 'error', msg: 'envoi du lien de connexion', err: e.message }); }   // l'utilisateur ne voit pas la cause
  await sleep(Math.max(0, 700 - (Date.now() - t0)));
  return generic;
}, { auth: false });
route('POST', '/api/auth/refresh', async ({ body, ip }) => {
  if (!authClient) throw Object.assign(new Error('introuvable'), { status: 404 });
  if (!limit(`refresh-ip:${ip}`, 60, 600_000).allowed) throw Object.assign(new Error('Trop de demandes.'), { status: 429 });
  const rt = typeof body.refresh_token === 'string' && body.refresh_token.length < 600 ? body.refresh_token : '';
  const out = rt ? await authClient.refresh(rt).catch(() => null) : null;
  if (!out) throw Object.assign(new Error('Session expirée : reconnectez-vous.'), { status: 401 });
  return out;
}, { auth: false });

route('GET', '/api/dev/accounts', async () => {
  if (!DEV_AUTH) throw Object.assign(new Error('introuvable'), { status: 404 });
  const r = await pool.query(`select email from auth.users where email like '%@demo.lieusaint.local' order by email`);
  return r.rows.map((x) => x.email);
}, { auth: false });
route('POST', '/api/auth/dev-login', async ({ body }) => {
  if (!DEV_AUTH) throw Object.assign(new Error('introuvable'), { status: 404 });
  const r = await pool.query(`select id, email from auth.users where email = $1 and email like '%@demo.lieusaint.local'`, [String(body.email)]);
  if (!r.rowCount) throw Object.assign(new Error('compte inconnu'), { status: 401 });
  return { token: sign({ sub: r.rows[0].id, email: r.rows[0].email, role: 'authenticated', aud: 'authenticated' }, DEV_SECRET) };
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
      app.has_perm($1,null,'invitations','add') as invitations_add, app.has_perm($1,null,'methodology','add') as methodology_add, app.has_perm($1,null,'methodology','edit') as methodology_edit, app.has_perm($1,null,'criteria','edit') as criteria_edit,
      app.has_perm($1,null,'calendar','add') as club_events_add, app.has_perm($1,null,'calendar','administer') as calendar_admin,
      app.has_perm($1,null,'players','view') as players_view_all`, [id]);
    caps[id] = k.rows[0];
  }
  const prof = (await c.query(`select display_name from profiles where id = auth.uid()`)).rows[0];
  const rep = (await c.query(`select exists (select 1 from teams t where app.has_perm(t.club_id, t.id, 'reports', 'view')) or bool_or(app.has_perm(m.club_id, null, 'reports', 'view')) as ok from memberships m where m.user_id = auth.uid() and m.status = 'active'`)).rows[0];
  return { email: user.email, display_name: prof?.display_name ?? null, can_reports: !!rep?.ok, memberships: m.rows, club_caps: caps };
}));

route('POST', '/api/me/profile', A(async (c, { body }) => {
  await c.query(`update profiles set display_name = $1 where id = auth.uid()`, [v.str(body.display_name, 'nom', 80)]);
  return { ok: true };
}));

route('GET', '/api/teams', A(async (c) => (await c.query(
  `select t.id, t.club_id, t.name, t.category_id, ca.name as category, ca.sort_order,
          app.has_perm(t.club_id, t.id, 'calendar', 'add')      as can_event,
          app.has_perm(t.club_id, t.id, 'players', 'add')       as can_player,
          app.has_perm(t.club_id, t.id, 'attendance', 'add')    as can_attendance,
          app.has_perm(t.club_id, t.id, 'convocations', 'add')  as can_convoke,
          app.has_perm(t.club_id, t.id, 'matches', 'edit')      as can_match,
          app.has_perm(t.club_id, t.id, 'players', 'view')      as can_view_players,
          app.has_perm(t.club_id, t.id, 'players', 'edit')      as can_transfer,
          app.has_perm(t.club_id, t.id, 'objectives', 'add')    as can_objective,
          app.has_perm(t.club_id, t.id, 'evaluations', 'add')   as can_evaluate
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



// ---------- grille d'évaluation, objectifs, évaluations collectives ----------
const anchors4 = (a) => {
  if (!a || typeof a !== 'object') throw bad('niveaux invalides');
  const o = {}; for (const k of ['1', '2', '3', '4']) o[k] = v.str(a[k], `niveau ${k}`, 400, 10);
  return o;
};
const PILLARS = ['position', 'possession', 'pression', 'transversal'];
route('GET', '/api/criteria', A(async (c) => (await c.query(
  `select c.id, c.club_id, c.title, c.description, c.pillar, c.anchors, c.category_id, ca.name as category, c.active, c.sort_order,
          exists (select 1 from evaluation_scores s where s.criterion_id = c.id) as used
   from criteria c left join categories ca on ca.id = c.category_id order by c.active desc, c.sort_order, c.title`)).rows));
route('POST', '/api/criteria', A(async (c, { body }) => (await c.query(
  `insert into criteria (club_id, title, description, pillar, anchors, category_id, sort_order, active) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) returning id`,
  [v.uuid(body.club_id, 'club'), v.str(body.title, 'titre', 120, 3), v.strOrNull(body.description, 500), v.enum(body.pillar ?? 'transversal', PILLARS, 'pilier'), JSON.stringify(anchors4(body.anchors)),
   v.uuidOrNull(body.category_id, 'catégorie'), v.intOrNull(body.sort_order, 'ordre', 0, 999) ?? 0, body.active !== false])).rows[0]));
route('POST', '/api/criteria/seed-proposals', A(async (c, { body }) => (await c.query(`select public.seed_criteria_proposals($1) as n`, [v.uuid(body.club_id, 'club')])).rows[0]));
route('POST', '/api/criteria/:id', A(async (c, { params, body }) => {
  const id = v.uuid(params.id);
  if (body.anchors !== undefined || body.title !== undefined || body.pillar !== undefined || body.description !== undefined || body.category_id !== undefined) {
    await c.query(`update criteria set title = coalesce($2, title), description = coalesce($3, description), pillar = coalesce($4, pillar), anchors = coalesce($5::jsonb, anchors), category_id = case when $6::boolean then $7 else category_id end where id = $1`,
      [id, body.title === undefined ? null : v.str(body.title, 'titre', 120, 3), body.description === undefined ? null : v.strOrNull(body.description, 500), body.pillar === undefined ? null : v.enum(body.pillar, PILLARS, 'pilier'),
       body.anchors === undefined ? null : JSON.stringify(anchors4(body.anchors)), body.category_id !== undefined, v.uuidOrNull(body.category_id, 'catégorie')]);
  }
  if (body.active !== undefined || body.sort_order !== undefined) {
    const r = await c.query(`update criteria set active = coalesce($2, active), sort_order = coalesce($3, sort_order) where id = $1`, [id, typeof body.active === 'boolean' ? body.active : null, v.intOrNull(body.sort_order, 'ordre', 0, 999)]);
    if (!r.rowCount) throw Object.assign(new Error('Critère introuvable ou droits insuffisants.'), { status: 403 });
  }
  return { ok: true };
}));

route('GET', '/api/teams/:id/objectives', A(async (c, { params }) => (await c.query(
  `select o.id, o.title, o.description, o.status, o.due_on, o.created_at, o.updated_at, o.criterion_id, cr.title as criterion, o.methodology_item_id, mi.title as methodology,
          coalesce(nullif(p.display_name,''), p.email) as author, o.created_by = auth.uid() as mine,
          app.has_perm(o.club_id, o.team_id, 'objectives', 'edit') as can_edit, app.has_perm(o.club_id, o.team_id, 'objectives', 'delete') as can_delete,
          (select count(*) from objective_notes n where n.objective_id = o.id)::int as notes
   from team_objectives o left join criteria cr on cr.id = o.criterion_id left join methodology_items mi on mi.id = o.methodology_item_id left join profiles p on p.id = o.created_by
   where o.team_id = $1 order by (o.status in ('planned','in_progress')) desc, o.due_on nulls last, o.created_at desc`, [v.uuid(params.id, 'équipe')])).rows));
const OBJ_STATUS = ['planned', 'in_progress', 'achieved', 'not_achieved', 'abandoned'];
route('POST', '/api/teams/:id/objectives', A(async (c, { params, body }) => {
  const team = v.uuid(params.id, 'équipe');
  const club = (await c.query(`select club_id from teams where id = $1`, [team])).rows[0]?.club_id;
  if (!club) throw Object.assign(new Error('Équipe introuvable.'), { status: 404 });
  return (await c.query(`insert into team_objectives (club_id, team_id, title, description, criterion_id, methodology_item_id, status, due_on) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [club, team, v.str(body.title, 'titre', 160, 3), v.strOrNull(body.description, 2000), v.uuidOrNull(body.criterion_id, 'critère'), v.uuidOrNull(body.methodology_item_id, 'contenu'),
     v.enum(body.status ?? 'planned', OBJ_STATUS, 'statut'), body.due_on ? v.ts(body.due_on, 'échéance').slice(0, 10) : null])).rows[0];
}));
route('POST', '/api/objectives/:id', A(async (c, { params, body }) => {
  const r = await c.query(`update team_objectives set status = coalesce($2, status), title = coalesce($3, title), description = coalesce($4, description), due_on = case when $5::boolean then $6 else due_on end where id = $1`,
    [v.uuid(params.id), body.status === undefined ? null : v.enum(body.status, OBJ_STATUS, 'statut'), body.title === undefined ? null : v.str(body.title, 'titre', 160, 3),
     body.description === undefined ? null : v.strOrNull(body.description, 2000), body.due_on !== undefined, body.due_on ? v.ts(body.due_on, 'échéance').slice(0, 10) : null]);
  if (!r.rowCount) throw Object.assign(new Error('Objectif introuvable ou droits insuffisants.'), { status: 403 });
  return { ok: true };
}));
route('GET', '/api/objectives/:id/notes', A(async (c, { params }) => (await c.query(
  `select n.id, n.note, n.created_at, coalesce(nullif(p.display_name,''), p.email, 'Éducateur') as author from objective_notes n left join profiles p on p.id = n.author_id where n.objective_id = $1 order by n.created_at desc`, [v.uuid(params.id)])).rows));
route('POST', '/api/objectives/:id/notes', A(async (c, { params, body }) => (await c.query(
  `insert into objective_notes (club_id, objective_id, note) select club_id, id, $2 from team_objectives where id = $1 returning id`, [v.uuid(params.id), v.str(body.note, 'note', 2000, 3)])).rows[0] ?? (() => { throw Object.assign(new Error('Objectif introuvable.'), { status: 404 }); })()));

route('GET', '/api/teams/:id/evaluations', A(async (c, { params }) => (await c.query(
  `select e.id, e.evaluated_on, e.evaluator_role, e.summary, e.status, e.finalized_at, (e.evaluator_id = auth.uid()) as mine,
          coalesce(nullif(p.display_name,''), p.email) as author, (select count(*) from evaluation_scores s where s.evaluation_id = e.id)::int as observed
   from team_evaluations e left join profiles p on p.id = e.evaluator_id where e.team_id = $1 order by e.evaluated_on desc, e.created_at desc`, [v.uuid(params.id, 'équipe')])).rows));
route('POST', '/api/teams/:id/evaluations', A(async (c, { params, body }) => (await c.query(`select public.create_evaluation($1,$2::date,$3) as id`,
  [v.uuid(params.id, 'équipe'), v.ts(body.evaluated_on, 'date').slice(0, 10), v.strOrNull(body.summary, 1000)])).rows[0]));
route('GET', '/api/evaluations/:id', A(async (c, { params }) => {
  const id = v.uuid(params.id);
  const e = (await c.query(
    `select e.id, e.team_id, e.club_id, e.evaluated_on, e.evaluator_role, e.summary, e.status, e.finalized_at, (e.evaluator_id = auth.uid()) as mine,
            coalesce(nullif(p.display_name,''), p.email) as author, t.name as team_name, ca.name as category, t.category_id
     from team_evaluations e join teams t on t.id = e.team_id join categories ca on ca.id = t.category_id left join profiles p on p.id = e.evaluator_id where e.id = $1`, [id])).rows[0];
  if (!e) throw Object.assign(new Error('Évaluation introuvable.'), { status: 404 });
  const scores = (await c.query(`select s.criterion_id, cr.title, cr.pillar, cr.anchors, cr.sort_order, s.level, s.evidence from evaluation_scores s join criteria cr on cr.id = s.criterion_id where s.evaluation_id = $1 order by cr.sort_order, cr.title`, [id])).rows;
  const grid = e.status === 'draft' && e.mine
    ? (await c.query(`select id as criterion_id, title, pillar, anchors, sort_order from criteria where club_id = $1 and active and (category_id is null or category_id = $2) order by sort_order, title`, [e.club_id, e.category_id])).rows : [];
  return { evaluation: e, scores, grid };
}));
route('POST', '/api/evaluations/:id/scores', A(async (c, { params, body }) => {
  await c.query(`select public.save_evaluation_score($1,$2,$3,$4)`, [v.uuid(params.id), v.uuid(body.criterion_id, 'critère'), v.intOrNull(body.level, 'niveau', 1, 4), v.strOrNull(body.evidence, 2000)]);
  return { ok: true };
}));
route('POST', '/api/evaluations/:id/finalize', A(async (c, { params }) => { await c.query(`select public.finalize_evaluation($1)`, [v.uuid(params.id)]); return { ok: true }; }));
route('POST', '/api/evaluations/:id/discard', A(async (c, { params }) => {
  const r = await c.query(`delete from team_evaluations where id = $1 and status = 'draft' and evaluator_id = auth.uid()`, [v.uuid(params.id)]);
  if (!r.rowCount) throw Object.assign(new Error('Brouillon introuvable.'), { status: 404 });
  return { ok: true };
}));
// Évolution par critère : uniquement des niveaux observés, ordonnés dans le temps. AUCUNE moyenne, AUCUN score global.
route('GET', '/api/teams/:id/evaluation-trend', A(async (c, { params }) => {
  const rows = (await c.query(
    `select cr.id as criterion_id, cr.title, cr.pillar, cr.sort_order, e.id as evaluation_id, e.evaluated_on, e.evaluator_role, s.level
     from evaluation_scores s join team_evaluations e on e.id = s.evaluation_id join criteria cr on cr.id = s.criterion_id
     where e.team_id = $1 and e.status = 'final' order by cr.sort_order, cr.title, e.evaluated_on, e.created_at`, [v.uuid(params.id, 'équipe')])).rows;
  const out = new Map();
  for (const r of rows) { if (!out.has(r.criterion_id)) out.set(r.criterion_id, { criterion_id: r.criterion_id, title: r.title, pillar: r.pillar, points: [] }); out.get(r.criterion_id).points.push({ evaluation_id: r.evaluation_id, evaluated_on: r.evaluated_on, evaluator_role: r.evaluator_role, level: r.level }); }
  return [...out.values()];
}));

// ---------- tableau de bord de la direction technique ----------
// Tout est calculé AU NOM de l'utilisateur : un responsable de catégorie ne voit que sa catégorie (RLS).
// Aucune conclusion automatique : des indicateurs définis + des « points d'attention » dont la règle est affichée.
const DEFINITIONS = {
  participation: "Taux de participation = (présents + en retard) / toutes les présences saisies (présent, en retard, absent, excusé) aux entraînements de la période.",
  couverture: "Couverture des présences = entraînements passés pour lesquels au moins une présence a été saisie / entraînements passés (hors annulés). Mesure la fiabilité du taux de participation.",
  matchs: "Matchs joués = matchs avec un score enregistré dans la période (compétitions officielles comprises). V/N/D du point de vue du club.",
  lecture: "Part de la méthodologie lue = versions courantes publiées ouvertes par l'éducateur / versions courantes publiées. Une ouverture n'est pas une preuve de compréhension ni d'application.",
  objectifs: "Objectifs = objectifs pédagogiques saisis par équipe (en cours, atteints, non atteints, abandonnés). Le statut est celui que l'éducateur ou la direction a renseigné : il n'est pas déduit des résultats.",
  evaluations: "Évaluations = observations collectives finalisées sur la grille définie par la direction technique : un niveau (1 à 4) par critère, étayé par une observation écrite. Aucun score global n'est calculé ; une absence d'évaluation n'est pas un constat sur l'équipe.",
  copies: "Séances reprises du commun = séances personnelles rattachées à une équipe, créées dans la période par copie d'une séance de la méthodologie du club.",
};
const NOT_TRACKED = [
  'Thèmes réellement travaillés en séance (les séances planifiées ne portent pas encore de thème)',
  'Difficultés récurrentes et besoins de formation des éducateurs : à renseigner par la direction technique à partir d\'observations',
];
function periodRange(period, ref, season) {
  const pad = (n) => String(n).padStart(2, '0');
  if (period === 'month') {
    const m = /^(\d{4})-(\d{2})$/.exec(ref || ''); if (!m) throw bad('mois invalide');
    const y = +m[1], mo = +m[2]; if (mo < 1 || mo > 12) throw bad('mois invalide');
    const ny = mo === 12 ? y + 1 : y, nm = mo === 12 ? 1 : mo + 1;
    return { from: `${y}-${pad(mo)}-01`, to: `${ny}-${pad(nm)}-01`, label: new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
  }
  if (period === 'quarter') {
    const m = /^(\d{4})-Q([1-4])$/.exec(ref || ''); if (!m) throw bad('trimestre invalide');
    const y = +m[1], q = +m[2], sm = (q - 1) * 3 + 1, em = sm + 3;
    return { from: `${y}-${pad(sm)}-01`, to: em > 12 ? `${y + 1}-01-01` : `${y}-${pad(em)}-01`, label: `${q}${q === 1 ? 'er' : 'e'} trimestre ${y}` };
  }
  if (period === 'season') {
    if (!season) throw bad('saison introuvable');
    return { from: season.starts_on, to: season.ends_on, label: `Saison ${season.label}`, inclusiveEnd: true };
  }
  throw bad('période invalide');
}
const pct = (a, b) => (b > 0 ? Math.round((1000 * a) / b) / 10 : null);

route('GET', '/api/dashboard', A(async (c, { query }) => {
  const mem = (await c.query(`select club_id from memberships where user_id = auth.uid() and status = 'active' limit 1`)).rows[0];
  if (!mem) throw Object.assign(new Error('Aucun club.'), { status: 403 });
  const club = mem.club_id;
  const g = (await c.query(`select app.has_perm($1,null,'reports','view') as club_scope, exists (select 1 from teams t where app.has_perm(t.club_id,t.id,'reports','view')) as any_scope`, [club])).rows[0];
  if (!g.club_scope && !g.any_scope) throw Object.assign(new Error('Le tableau de bord est réservé à la direction.'), { status: 403 });
  const seasons = (await c.query(`select id, label, to_char(starts_on,'YYYY-MM-DD') as starts_on, to_char(ends_on,'YYYY-MM-DD') as ends_on, is_current from seasons where club_id = $1 order by starts_on desc`, [club])).rows;
  const season = seasons.find((x) => x.is_current) ?? seasons[0];
  const period = query.period || 'season';
  const ref = query.ref || (period === 'month' ? new Date().toISOString().slice(0, 7) : period === 'quarter' ? `${new Date().getUTCFullYear()}-Q${Math.floor(new Date().getUTCMonth() / 3) + 1}` : '');
  const range = periodRange(period, ref, season);
  const category = v.uuidOrNull(query.category, 'catégorie');
  const toExpr = range.inclusiveEnd ? `(($3::date + 1)::timestamp at time zone 'Europe/Paris')` : `($3::date::timestamp at time zone 'Europe/Paris')`;
  const FROM = `($2::date::timestamp at time zone 'Europe/Paris')`;

  const cats = (await c.query(`select id, name from categories where club_id = $1 order by sort_order, name`, [club])).rows;
  const teams = (await c.query(
    `select t.id, t.name, ca.id as category_id, ca.name as category,
            (select count(*) from player_team_history h where h.team_id = t.id and h.ended_on is null)::int as players
     from teams t join categories ca on ca.id = t.category_id
     where t.club_id = $1 and t.season_id = $2 and ($3::uuid is null or t.category_id = $3)
     order by ca.sort_order, ca.name, t.name`, [club, (seasons.find((x) => x.is_current) ?? season).id, category])).rows;
  const ev = Object.fromEntries((await c.query(
    `select e.team_id,
       count(*) filter (where e.kind = 'training' and e.status = 'scheduled')::int as trainings_planned,
       count(*) filter (where e.kind = 'training' and e.status = 'scheduled' and e.starts_at < now())::int as trainings_held,
       count(*) filter (where e.kind = 'training' and e.status = 'scheduled' and e.starts_at < now() and exists (select 1 from attendance_records a where a.event_id = e.id))::int as trainings_with_attendance,
       count(*) filter (where e.kind = 'match' and e.status = 'scheduled' and e.starts_at >= now())::int as matches_upcoming
     from events e where e.club_id = $1 and e.team_id is not null and e.starts_at >= ${FROM} and e.starts_at < ${toExpr} group by e.team_id`, [club, range.from, range.to])).rows.map((r) => [r.team_id, r]));
  const att = Object.fromEntries((await c.query(
    `select e.team_id, count(*) filter (where a.status = 'present')::int as present, count(*) filter (where a.status = 'late')::int as late,
            count(*) filter (where a.status = 'absent')::int as absent, count(*) filter (where a.status = 'excused')::int as excused
     from attendance_records a join events e on e.id = a.event_id
     where e.club_id = $1 and e.kind = 'training' and e.status = 'scheduled' and e.starts_at >= ${FROM} and e.starts_at < ${toExpr} group by e.team_id`, [club, range.from, range.to])).rows.map((r) => [r.team_id, r]));
  const mt = Object.fromEntries((await c.query(
    `select e.team_id, count(*)::int as played, count(*) filter (where d.our_score > d.their_score)::int as wins, count(*) filter (where d.our_score = d.their_score)::int as draws,
            count(*) filter (where d.our_score < d.their_score)::int as losses, coalesce(sum(d.our_score),0)::int as gf, coalesce(sum(d.their_score),0)::int as ga
     from match_details d join events e on e.id = d.event_id
     where e.club_id = $1 and e.status = 'scheduled' and d.status = 'played' and d.our_score is not null and d.their_score is not null
       and e.starts_at >= ${FROM} and e.starts_at < ${toExpr} group by e.team_id`, [club, range.from, range.to])).rows.map((r) => [r.team_id, r]));

  const ob = Object.fromEntries((await c.query(
    `select o.team_id, count(*)::int as total, count(*) filter (where o.status = 'planned')::int as planned, count(*) filter (where o.status = 'in_progress')::int as in_progress,
            count(*) filter (where o.status = 'achieved')::int as achieved, count(*) filter (where o.status = 'not_achieved')::int as not_achieved, count(*) filter (where o.status = 'abandoned')::int as abandoned
     from team_objectives o where o.club_id = $1 group by o.team_id`, [club])).rows.map((r) => [r.team_id, r]));
  const evs = Object.fromEntries((await c.query(
    `select e.team_id, count(*) filter (where e.evaluated_on >= $2::date and e.evaluated_on < ${range.inclusiveEnd ? "($3::date + 1)" : '$3::date'})::int as in_period,
            max(e.evaluated_on)::text as last_on, count(*)::int as total
     from team_evaluations e where e.club_id = $1 and e.status = 'final' group by e.team_id`, [club, range.from, range.to])).rows.map((r) => [r.team_id, r]));

  // éducateurs : rôles à portée équipe / catégorie
  const assigns = (await c.query(`select membership_id, team_id, category_id from assignments where club_id = $1`, [club])).rows;
  const educRows = (await c.query(
    `select m.id as membership_id, m.user_id, coalesce(nullif(p.display_name,''), p.email, 'Éducateur (nom non renseigné)') as name, r.label as role_label, r.scope_level
     from memberships m join club_roles r on r.club_id = m.club_id and r.key = m.role_key left join profiles p on p.id = m.user_id
     where m.club_id = $1 and m.status = 'active' and r.scope_level in ('team','category') order by r.rank desc, name`, [club])).rows;
  const sess = Object.fromEntries((await c.query(
    `select owner_id, count(*)::int as sessions, count(source_version_id)::int as copied from personal_sessions
     where club_id = $1 and team_id is not null and created_at >= ${FROM} and created_at < ${toExpr} group by owner_id`, [club, range.from, range.to])).rows.map((r) => [r.owner_id, r]));
  const cur = (await c.query(`select i.id, i.title, vv.id as version_id, vv.version_no from methodology_items i join methodology_versions vv on vv.id = i.current_version_id where i.club_id = $1 and i.status = 'published' order by i.title`, [club])).rows;
  const readsBy = {};
  if (g.club_scope) for (const r of (await c.query(`select user_id, version_id from methodology_reads where club_id = $1`, [club])).rows) (readsBy[r.user_id] ||= new Set()).add(r.version_id);
  const curIds = new Set(cur.map((x) => x.version_id));

  const teamName = Object.fromEntries(teams.map((t) => [t.id, `${t.category} ${t.name}`]));
  const educators = educRows.map((e) => {
    const mine = assigns.filter((a) => a.membership_id === e.membership_id);
    const tids = new Set(mine.flatMap((a) => (a.team_id ? [a.team_id] : teams.filter((t) => t.category_id === a.category_id).map((t) => t.id))));
    const inScope = [...tids].filter((t) => teamName[t]);
    const read = g.club_scope ? [...(readsBy[e.user_id] ?? [])].filter((x) => curIds.has(x)).length : null;
    return { ...e, teams: inScope.map((t) => teamName[t]), team_ids: inScope, sessions: sess[e.user_id]?.sessions ?? 0, copied: sess[e.user_id]?.copied ?? 0,
             read, read_pct: read == null || cur.length === 0 ? null : pct(read, cur.length) };
  }).filter((e) => category == null ? (g.club_scope || e.team_ids.length) : e.team_ids.length);

  const rows = teams.map((t) => {
    const e = ev[t.id] ?? {}, a = att[t.id] ?? {}, m = mt[t.id] ?? {};
    const recs = (a.present ?? 0) + (a.late ?? 0) + (a.absent ?? 0) + (a.excused ?? 0);
    return { ...t, educators: educators.filter((x) => x.team_ids.includes(t.id)).map((x) => x.name),
      head_educators: educators.filter((x) => x.scope_level === 'team' && x.team_ids.includes(t.id)).length,
      trainings_planned: e.trainings_planned ?? 0, trainings_held: e.trainings_held ?? 0, trainings_with_attendance: e.trainings_with_attendance ?? 0,
      coverage_pct: pct(e.trainings_with_attendance ?? 0, e.trainings_held ?? 0),
      records: recs, present: a.present ?? 0, late: a.late ?? 0, absent: a.absent ?? 0, excused: a.excused ?? 0, participation_pct: pct((a.present ?? 0) + (a.late ?? 0), recs),
      objectives: ob[t.id] ?? { total: 0, planned: 0, in_progress: 0, achieved: 0, not_achieved: 0, abandoned: 0 }, evaluations_in_period: evs[t.id]?.in_period ?? 0, last_evaluation_on: evs[t.id]?.last_on ?? null,
      matches_played: m.played ?? 0, wins: m.wins ?? 0, draws: m.draws ?? 0, losses: m.losses ?? 0, gf: m.gf ?? 0, ga: m.ga ?? 0, matches_upcoming: e.matches_upcoming ?? 0 };
  });
  const sum = (k) => rows.reduce((x, r) => x + r[k], 0);
  const kpis = { teams: rows.length, educators: educators.length, players: sum('players'),
    trainings_held: sum('trainings_held'), coverage_pct: pct(sum('trainings_with_attendance'), sum('trainings_held')),
    participation_pct: pct(sum('present') + sum('late'), sum('records')), absences: sum('absent') + sum('excused'), late: sum('late'),
    matches_played: sum('matches_played'), wins: sum('wins'), draws: sum('draws'), losses: sum('losses'), gf: sum('gf'), ga: sum('ga'),
    methodology_published: cur.length, objectives_total: rows.reduce((x, r) => x + r.objectives.total, 0), objectives_achieved: rows.reduce((x, r) => x + r.objectives.achieved, 0), evaluations_in_period: rows.reduce((x, r) => x + r.evaluations_in_period, 0) };

  // Points d'attention : règles simples, seuils et valeurs affichés ; à vérifier par la direction, jamais une conclusion.
  const flags = [];
  for (const r of rows) {
    if (r.trainings_held >= 3 && r.coverage_pct != null && r.coverage_pct < 60) flags.push({ code: 'attendance_coverage', subject: `${r.category} ${r.name}`, rule: 'Au moins 3 entraînements passés et couverture des présences < 60 %', value: `${r.trainings_with_attendance} entraînement(s) sur ${r.trainings_held} avec présences saisies (${r.coverage_pct} %)`, hint: 'Le taux de participation de cette équipe n\'est pas fiable tant que les présences ne sont pas saisies.' });
    if (r.records >= 10 && r.participation_pct != null && r.participation_pct < 60) flags.push({ code: 'participation_low', subject: `${r.category} ${r.name}`, rule: 'Au moins 10 présences saisies et participation < 60 %', value: `${r.participation_pct} % sur ${r.records} présences saisies`, hint: 'À examiner avec l\'éducateur : causes possibles multiples (calendrier, météo, blessures…).' });
    if (r.players > 0 && r.trainings_planned === 0) flags.push({ code: 'no_training', subject: `${r.category} ${r.name}`, rule: 'Équipe avec joueurs et aucun entraînement planifié dans la période', value: `${r.players} joueur(s), 0 entraînement`, hint: 'Les entraînements ont peut-être lieu mais ne sont pas saisis dans la plateforme.' });
  }
  for (const r of rows) {
    if (r.head_educators > 0 && r.objectives.total - r.objectives.abandoned === 0) flags.push({ code: 'no_objective', subject: `${r.category} ${r.name}`, rule: 'Équipe avec un entraîneur attribué et aucun objectif pédagogique défini (hors abandonnés)', value: '0 objectif défini', hint: 'À aborder avec l\'éducateur : l\'équipe a peut-être des objectifs non saisis dans la plateforme.' });
    if (period !== 'month' && r.players > 0 && r.evaluations_in_period === 0) flags.push({ code: 'no_evaluation', subject: `${r.category} ${r.name}`, rule: 'Équipe avec joueurs et aucune évaluation collective finalisée dans la période', value: r.last_evaluation_on ? `dernière évaluation finalisée : ${r.last_evaluation_on}` : 'aucune évaluation finalisée', hint: 'L\'absence d\'évaluation ne dit rien de la qualité du travail de l\'équipe.' });
  }
  if (g.club_scope) {
    const none = rows.filter((r) => r.educators.length === 0);
    if (none.length) flags.push({ code: 'no_educator', subject: `${none.length} équipe(s)`, rule: 'Équipe sans éducateur attribué dans la plateforme', value: none.map((r) => `${r.category} ${r.name}`).join(', '), hint: 'À attribuer par invitation, ou l\'éducateur n\'a pas encore été invité.' });
    if (cur.length >= 3) for (const e of educators) if (e.read_pct != null && e.read_pct < 50) flags.push({ code: 'methodology_unread', subject: e.name, rule: 'Au moins 3 contenus publiés et moins de 50 % ouverts par l\'éducateur', value: `${e.read} contenu(s) ouvert(s) sur ${cur.length} (${e.read_pct} %)`, hint: 'Diffusion à vérifier (invitation non lue, contenu peu visible…). Ouvrir un contenu ne prouve pas sa compréhension.' });
  }
  return { club, scope: g.club_scope ? 'club' : 'category', period: { type: period, ref, label: range.label, from: range.from, to: range.to }, seasons, categories: cats, category,
    kpis, teams: rows, educators, methodology: cur, flags, definitions: DEFINITIONS, not_tracked: NOT_TRACKED, generated_at: new Date().toISOString() };
}));
route('POST', '/api/reports/export-log', A(async (c, { body }) => { await c.query(`select public.log_report_export($1,$2)`, [v.uuid(body.club_id, 'club'), v.str(body.label, 'libellé', 120)]); return { ok: true }; }));

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
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  ...(PROD ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
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
  const t0 = Date.now(); let status = 500; const url0 = (req.url || '').split('?')[0];
  res.on('finish', () => { if (url0 !== '/healthz') log({ m: req.method, p: url0.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id'), s: res.statusCode, ms: Date.now() - t0 }); });
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });                       // vivacité : ne touche pas la base
    if (url.pathname === '/readyz') {                                                            // disponibilité : la base répond
      try { await pool.query('select 1'); return send(res, 200, { ok: true }); } catch { return send(res, 503, { ok: false }); }
    }
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);
    const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
    if (!r) return send(res, 404, { error: 'Introuvable.' });
    let user = null;
    if (r.auth) {
      const h = req.headers.authorization || '';
      user = h.startsWith('Bearer ') ? await verify(h.slice(7)) : null;
      if (!user) return send(res, 401, { error: 'Connexion requise.' });
    }
    const body = req.method === 'GET' ? {} : await readBody(req);
    const out = await r.handler({ user, body, ip: clientIp(req), query: Object.fromEntries(url.searchParams), params: url.pathname.match(r.re).groups || {} });
    send(res, 200, out);
  } catch (e) {
    const h = httpError(e);
    send(res, h.status, { error: h.message }, h.status === 429 ? { 'Retry-After': '300' } : {});
  }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.requestTimeout = 30_000; server.headersTimeout = 15_000; server.keepAliveTimeout = 65_000;
  server.listen(cfg.port, () => log({ msg: 'démarré', port: cfg.port, mode: DEV_AUTH ? 'démonstration (connexion de test ACTIVE)' : 'production' }));
  const stop = (sig) => { log({ msg: `arrêt (${sig})` }); server.close(() => pool.end().finally(() => process.exit(0))); setTimeout(() => process.exit(1), 10_000).unref(); };
  process.on('SIGTERM', () => stop('SIGTERM')); process.on('SIGINT', () => stop('SIGINT'));
}
