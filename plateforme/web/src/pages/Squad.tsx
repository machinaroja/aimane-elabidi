import { Fragment, useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Ctx } from '../App';

type P = { id: string; first_name: string; last_name: string; birth_date: string | null; license_no: string | null };
type H = { id: string; started_on: string; ended_on: string | null; team_name: string | null; category: string | null };
const d = (x: string) => new Date(x).toLocaleDateString('fr-FR');
export function Squad({ ctx }: { ctx: Ctx }) {
  const teams = ctx.teams.filter((t) => t.can_view_players);
  const initial = location.hash.split('/')[2];
  const [team, setTeam] = useState(teams.find((t) => t.id === initial)?.id || teams[0]?.id || '');
  const [players, setPlayers] = useState<P[] | null>(null);
  const [f, setF] = useState({ first_name: '', last_name: '', birth_date: '', license_no: '' });
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const t = teams.find((x) => x.id === team);
  const [moving, setMoving] = useState<P | null>(null);
  const [dest, setDest] = useState('');
  const [histFor, setHistFor] = useState<string | null>(null);
  const [hist, setHist] = useState<H[] | null>(null);
  const destinations = ctx.teams.filter((x) => x.can_transfer && x.id !== team);
  const showHistory = (p: P) => { if (histFor === p.id) { setHistFor(null); return; } setHistFor(p.id); setHist(null); api<H[]>('GET', `/api/players/${p.id}/history`).then(setHist).catch((e) => setErr(e.message)); };
  const transfer = async () => {
    if (!moving || !dest) return; setErr(''); setOk('');
    try { await api('POST', `/api/players/${moving.id}/transfer`, { to_team_id: dest }); const to = ctx.teams.find((x) => x.id === dest); setOk(`${moving.first_name} ${moving.last_name} est transféré vers ${to?.category} ${to?.name}. La fiche et l'historique sont conservés.`); setMoving(null); setDest(''); setHistFor(null); load(); }
    catch (e: any) { setErr(e.message); }
  };
  const load = useCallback(() => { if (team) api<P[]>('GET', `/api/teams/${team}/players`).then(setPlayers).catch((e) => setErr(e.message)); }, [team]);
  useEffect(load, [load]);
  const add = async () => {
    setErr(''); setOk('');
    try { await api('POST', `/api/teams/${team}/players`, { ...f, birth_date: f.birth_date || null, license_no: f.license_no || null }); setF({ first_name: '', last_name: '', birth_date: '', license_no: '' }); setOk('Joueur ajouté.'); load(); }
    catch (e: any) { setErr(e.message); }
  };
  if (teams.length === 0) return <><h1>Effectif</h1><p className="muted">Aucun effectif accessible avec votre rôle.</p></>;
  return (
    <>
      <h1>Effectif</h1>
      <div className="toolbar"><div><label htmlFor="sq-team">Équipe</label><select id="sq-team" value={team} onChange={(e) => setTeam(e.target.value)}>{teams.map((x) => <option key={x.id} value={x.id}>{x.category} {x.name}</option>)}</select></div></div>
      {err && <div className="err" role="alert">{err}</div>}{ok && <div className="okmsg" role="status">{ok}</div>}
      <div className="card">
        {players === null ? <p className="muted">Chargement…</p> : players.length === 0 ? <p className="muted">Aucun joueur dans cette équipe.</p> : (
          <table><thead><tr><th>Nom</th><th>Prénom</th><th>Naissance</th><th>Licence</th><th></th></tr></thead>
            <tbody>{players.map((p) => (
              <Fragment key={p.id}>
                <tr><td>{p.last_name}</td><td>{p.first_name}</td><td>{p.birth_date ? new Date(p.birth_date).toLocaleDateString('fr-FR') : '—'}</td><td>{p.license_no ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><button className="ghost sm" onClick={() => showHistory(p)} aria-label={`Historique de ${p.last_name} ${p.first_name}`}>Historique</button>{' '}
                    {t?.can_transfer && <button className="ghost sm" onClick={() => { setMoving(p); setDest(destinations[0]?.id ?? ''); setOk(''); setErr(''); }} aria-label={`Transférer ${p.last_name} ${p.first_name}`}>Transférer</button>}</td></tr>
                {histFor === p.id && <tr><td colSpan={5} style={{ background: '#f3f6fd' }}>
                  {hist === null ? 'Chargement…' : hist.map((h) => <div key={h.id} className="small">{h.category ?? ''} {h.team_name ?? 'autre équipe'} — depuis le {d(h.started_on)}{h.ended_on ? ` jusqu'au ${d(h.ended_on)}` : ' (équipe actuelle)'}</div>)}
                  <div className="small muted">Vous ne voyez que les équipes que votre rôle vous permet de consulter.</div></td></tr>}
              </Fragment>
            ))}</tbody></table>
        )}
        <p className="muted small">{players?.length ?? 0} joueur(s). Les données des joueurs mineurs sont protégées : seuls les éducateurs de l'équipe et la direction y accèdent, et chaque consultation sensible est journalisée.</p>
      </div>
      {moving && (
        <div className="card" role="dialog" aria-label="Transférer un joueur">
          <h3>Transférer {moving.first_name} {moving.last_name}</h3>
          {destinations.length === 0 ? <p className="muted">Votre rôle ne vous permet de transférer vers aucune autre équipe. Demandez à la direction technique.</p> : <>
            <label htmlFor="tr-dest">Nouvelle équipe</label>
            <select id="tr-dest" value={dest} onChange={(e) => setDest(e.target.value)}>{destinations.map((x) => <option key={x.id} value={x.id}>{x.category} {x.name}</option>)}</select>
            <ul className="small muted"><li>La fiche du joueur et tout son historique sont <strong>conservés</strong> (aucune nouvelle identité).</li>
              <li>Vous (et les éducateurs de l'équipe de départ) perdez l'accès à ce joueur ; les éducateurs de la nouvelle équipe y accèdent.</li>
              <li>Vos observations privées restent privées : elles ne sont jamais transmises automatiquement.</li></ul></>}
          <p style={{ display: 'flex', gap: '.6rem' }}><button onClick={transfer} disabled={!dest || destinations.length === 0}>Confirmer le transfert</button><button className="ghost" onClick={() => setMoving(null)}>Annuler</button></p>
        </div>
      )}
      {t?.can_player && (
        <div className="card"><h3>Ajouter un joueur</h3>
          <div className="row">
            <div><label htmlFor="p-fn">Prénom</label><input id="p-fn" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></div>
            <div><label htmlFor="p-ln">Nom</label><input id="p-ln" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></div>
            <div><label htmlFor="p-bd">Naissance</label><input id="p-bd" type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></div>
            <div><label htmlFor="p-lic">N° de licence</label><input id="p-lic" value={f.license_no} onChange={(e) => setF({ ...f, license_no: e.target.value })} /></div>
            <div><button onClick={add} disabled={!f.first_name || !f.last_name}>Ajouter</button></div>
          </div>
        </div>
      )}
    </>
  );
}
