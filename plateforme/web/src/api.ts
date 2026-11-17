const KEY = 'lieusaint.token', RKEY = 'lieusaint.refresh', IKEY = 'lieusaint.invite', EKEY = 'lieusaint.authError';
export const getToken = () => sessionStorage.getItem(KEY);
export const setToken = (t: string | null) => (t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY));
export const clearSession = () => { [KEY, RKEY, IKEY].forEach((k) => sessionStorage.removeItem(k)); };

// Retour du lien de connexion envoyé par e-mail : « …/#access_token=…&refresh_token=… ». Les jetons sont lus puis RETIRÉS de l'adresse.
export function consumeAuthHash() {
  const h = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  if (!h.includes('access_token=') && !h.includes('error=')) return;
  const p = new URLSearchParams(h);
  if (p.get('access_token')) { setToken(p.get('access_token')); if (p.get('refresh_token')) sessionStorage.setItem(RKEY, p.get('refresh_token')!); }
  else if (p.get('error')) sessionStorage.setItem(EKEY, p.get('error_code') === 'otp_expired' ? 'Ce lien de connexion a expiré ou a déjà été utilisé. Demandez-en un nouveau.' : 'Connexion impossible avec ce lien. Demandez-en un nouveau.');
  history.replaceState(null, '', location.pathname + location.search);
}
// Lien d'invitation « …/?invite=JETON » : conservé pendant la connexion, puis retiré de l'adresse.
export function captureInvite() {
  const q = new URLSearchParams(location.search); const t = q.get('invite');
  if (t) { sessionStorage.setItem(IKEY, t); q.delete('invite'); history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : '') + location.hash); }
}
export const takeInvite = () => { const t = sessionStorage.getItem(IKEY); sessionStorage.removeItem(IKEY); return t; };
export const hasInvite = () => !!sessionStorage.getItem(IKEY);
export const takeAuthError = () => { const e = sessionStorage.getItem(EKEY); sessionStorage.removeItem(EKEY); return e; };

let refreshing: Promise<boolean> | null = null;
export function refreshSession(): Promise<boolean> {
  const rt = sessionStorage.getItem(RKEY); if (!rt) return Promise.resolve(false);
  if (!refreshing) refreshing = (async () => {
    try {
      const r = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: rt }) });
      if (!r.ok) return false; const d = await r.json();
      setToken(d.access_token); if (d.refresh_token) sessionStorage.setItem(RKEY, d.refresh_token); return true;
    } catch { return false; } finally { refreshing = null; }
  })();
  return refreshing;
}

export async function api<T = any>(method: 'GET' | 'POST', path: string, body?: unknown, retried = false): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && getToken()) {
    if (!retried && (await refreshSession())) return api<T>(method, path, body, true);          // session prolongée sans déconnecter l'utilisateur
    clearSession(); location.reload();
  }
  if (!r.ok) throw new Error(data.error || `Erreur ${r.status}`);
  return data as T;
}

export type Cap = { categories_add: boolean; teams_add: boolean; invitations_add: boolean; methodology_add: boolean; methodology_edit: boolean; criteria_edit: boolean; club_events_add: boolean; calendar_admin: boolean; players_view_all: boolean };
export type Me = { email: string; display_name: string | null; can_reports: boolean; memberships: { id: string; club_id: string; club_name: string; role_key: string; role_label: string; scope_level: string }[]; club_caps: Record<string, Cap> };
export type Team = { id: string; club_id: string; name: string; category_id: string; category: string; can_event: boolean; can_player: boolean; can_attendance: boolean; can_convoke: boolean; can_match: boolean; can_view_players: boolean; can_transfer: boolean; can_objective: boolean; can_evaluate: boolean };
export type Ev = { id: string; team_id: string | null; team_name: string | null; category: string | null; kind: string; title: string; starts_at: string; ends_at: string; status: string; official: boolean; time_known: boolean; competition: string | null; facility: string | null; opponent: string | null; home_away: string | null; our_score: number | null; their_score: number | null; match_status: string | null };

export const KIND: Record<string, string> = { training: 'Entraînement', match: 'Match', tournament: 'Tournoi', event: 'Événement', meeting: 'Réunion' };
export const METH_KIND: Record<string, string> = { philosophy: 'Philosophie de jeu', principle: 'Principes de jeu', document: 'Documents de formation', reference_session: 'Séances de référence', exercise: 'Exercices', scheme: 'Schémas tactiques', objective: 'Objectifs pédagogiques', behavior: 'Comportements attendus', coaching_cue: 'Consignes de coaching', correction: 'Corrections', progression: 'Progressions par catégorie' };
const TZ = 'Europe/Paris';
export const fmtDate = (s: string) => new Date(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
export const fmtTime = (s: string) => new Date(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
export const dayKey = (s: string) => new Date(s).toLocaleDateString('sv-SE', { timeZone: TZ });
export const monthKey = (s: string) => new Date(s).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: TZ });
// « 2026-11-22 » + « 09:30 » (heure de Paris, été/hiver gérés) -> ISO UTC
export function parisToIso(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number), [hh, mm] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const offset = (t: number) => { const f = fmt.formatToParts(new Date(t)); const g = (k: string) => Number(f.find((p) => p.type === k)!.value); return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - t; };
  let t = wall - offset(wall); t = wall - offset(t);
  return new Date(t).toISOString();
}

export const OBJ_STATUS: Record<string, string> = { planned: 'Prévu', in_progress: 'En cours', achieved: 'Atteint', not_achieved: 'Non atteint', abandoned: 'Abandonné' };
export const PILLAR: Record<string, string> = { position: 'Position', possession: 'Possession', pression: 'Pression', transversal: 'Transversal' };
export const EVAL_ROLE: Record<string, string> = { entraineur: 'Auto-évaluation (entraîneur)', adjoint: 'Observation de l\'adjoint', responsable_categorie: 'Regard extérieur — responsable de catégorie', directeur_technique: 'Regard extérieur — direction technique', direction: 'Regard extérieur — direction', club_admin: 'Regard extérieur — administration' };
export const fmtShort = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' });
