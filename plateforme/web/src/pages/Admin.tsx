import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Ctx } from '../App';

type Cat = { id: string; club_id: string; name: string; age_min: number | null; age_max: number | null };
type Inv = { id: string; email: string; role_key: string; expires_at: string; accepted_at: string | null; revoked_at: string | null; team_name: string | null; category: string | null };
const ROLES: [string, string, 'club' | 'category' | 'team'][] = [['direction', 'Direction du club', 'club'], ['directeur_technique', 'Direction technique', 'club'], ['responsable_categorie', 'Responsable de catégorie', 'category'], ['entraineur', 'Entraîneur principal', 'team'], ['adjoint', 'Entraîneur adjoint', 'team']];

export function Admin({ ctx }: { ctx: Ctx }) {
  const club = ctx.me.memberships[0].club_id;
  const caps = ctx.me.club_caps[club];
  const [cats, setCats] = useState<Cat[]>([]); const [seasons, setSeasons] = useState<{ id: string; label: string; is_current: boolean }[]>([]);
  const [invs, setInvs] = useState<Inv[]>([]);
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [link, setLink] = useState('');
  const [nc, setNc] = useState({ name: '', min: '', max: '' });
  const [nt, setNt] = useState({ category: '', name: '' });
  const [ni, setNi] = useState({ email: '', role: 'entraineur', team: '', category: '' });
  const load = useCallback(() => {
    api<Cat[]>('GET', '/api/categories').then(setCats); api('GET', '/api/seasons').then(setSeasons);
    api<Inv[]>('GET', '/api/invitations').then(setInvs).catch(() => {});
  }, []);
  useEffect(load, [load]);
  const run = async (fn: () => Promise<any>, msg: string) => { setErr(''); setOk(''); try { const r = await fn(); setOk(msg); return r; } catch (e: any) { setErr(e.message); } };
  const season = seasons.find((s) => s.is_current)?.id;
  const scope = ROLES.find((r) => r[0] === ni.role)![2];

  return (
    <>
      <h1>Administration du club</h1>
      {err && <div className="err" role="alert">{err}</div>}{ok && <div className="okmsg" role="status">{ok}</div>}

      <h2>Catégories ({cats.length})</h2>
      <div className="card"><div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>{cats.map((c) => <div key={c.id}><strong>{c.name}</strong></div>)}</div>
        {caps.categories_add && <div className="row" style={{ marginTop: '.8rem' }}>
          <div><label htmlFor="c-n">Nouvelle catégorie</label><input id="c-n" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="ex. U15" /></div>
          <div><label htmlFor="c-a">Âge min</label><input id="c-a" type="number" style={{ width: 80 }} value={nc.min} onChange={(e) => setNc({ ...nc, min: e.target.value })} /></div>
          <div><label htmlFor="c-b">Âge max</label><input id="c-b" type="number" style={{ width: 80 }} value={nc.max} onChange={(e) => setNc({ ...nc, max: e.target.value })} /></div>
          <div><button disabled={!nc.name} onClick={async () => { if (await run(() => api('POST', '/api/categories', { club_id: club, name: nc.name, age_min: nc.min || null, age_max: nc.max || null }), 'Catégorie créée.')) { setNc({ name: '', min: '', max: '' }); load(); } }}>Créer</button></div></div>}
      </div>

      {caps.teams_add && <><h2>Équipes</h2><div className="card"><p className="muted small">{ctx.teams.length} équipes cette saison. Une catégorie peut avoir plusieurs équipes (1, 2, 3 ou A, B, C…).</p>
        <div className="row">
          <div><label htmlFor="t-c">Catégorie</label><select id="t-c" value={nt.category} onChange={(e) => setNt({ ...nt, category: e.target.value })}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label htmlFor="t-n">Nom de l'équipe</label><input id="t-n" value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} placeholder="ex. B" /></div>
          <div><button disabled={!nt.category || !nt.name || !season} onClick={async () => { if (await run(() => api('POST', '/api/teams', { club_id: club, season_id: season, category_id: nt.category, name: nt.name }), 'Équipe créée.')) { setNt({ category: '', name: '' }); } }}>Créer</button></div></div></div></>}

      {caps.invitations_add && <><h2>Inviter un éducateur</h2><div className="card">
        <div className="row">
          <div style={{ flex: 1 }}><label htmlFor="i-e">Adresse e-mail</label><input id="i-e" type="email" style={{ width: '100%' }} value={ni.email} onChange={(e) => setNi({ ...ni, email: e.target.value })} /></div>
          <div><label htmlFor="i-r">Rôle</label><select id="i-r" value={ni.role} onChange={(e) => setNi({ ...ni, role: e.target.value })}>{ROLES.map((r) => <option key={r[0]} value={r[0]}>{r[1]}</option>)}</select></div>
          {scope === 'team' && <div><label htmlFor="i-t">Équipe</label><select id="i-t" value={ni.team} onChange={(e) => setNi({ ...ni, team: e.target.value })}><option value="">—</option>{ctx.teams.map((t) => <option key={t.id} value={t.id}>{t.category} {t.name}</option>)}</select></div>}
          {scope === 'category' && <div><label htmlFor="i-c">Catégorie</label><select id="i-c" value={ni.category} onChange={(e) => setNi({ ...ni, category: e.target.value })}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
          <div><button disabled={!ni.email} onClick={async () => { const r = await run(() => api<{ token: string }>('POST', '/api/invitations', { club_id: club, email: ni.email, role_key: ni.role, team_id: scope === 'team' ? ni.team || null : null, category_id: scope === 'category' ? ni.category || null : null }), 'Invitation créée.'); if (r) { setLink(`${location.origin}/?invite=${r.token}`); load(); } }}>Inviter</button></div>
        </div>
        {link && <div className="okmsg"><strong>Lien d'invitation (affiché une seule fois, valable 14 jours) :</strong><br /><code data-testid="invite-link" style={{ wordBreak: 'break-all' }}>{link}</code><br /><span className="small">À transmettre à la personne invitée ; elle doit se connecter avec l'adresse e-mail indiquée.</span></div>}
        <h3 style={{ marginTop: '1rem' }}>Invitations récentes</h3>
        <table><thead><tr><th>E-mail</th><th>Rôle</th><th>Périmètre</th><th>Statut</th></tr></thead><tbody>
          {invs.slice(0, 15).map((i) => <tr key={i.id}><td>{i.email}</td><td>{ROLES.find((r) => r[0] === i.role_key)?.[1] ?? i.role_key}</td><td>{i.team_name ? `${i.category} ${i.team_name}` : i.category ?? 'Club'}</td><td>{i.accepted_at ? <span className="badge ok">Acceptée</span> : i.revoked_at ? <span className="badge ko">Révoquée</span> : new Date(i.expires_at) < new Date() ? <span className="badge ko">Expirée</span> : <span className="badge warn">En attente</span>}</td></tr>)}
        </tbody></table></div></>}
    </>
  );
}
