import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Ctx } from '../App';

type P = { id: string; first_name: string; last_name: string; birth_date: string | null; license_no: string | null };
export function Squad({ ctx }: { ctx: Ctx }) {
  const teams = ctx.teams.filter((t) => t.can_view_players);
  const initial = location.hash.split('/')[2];
  const [team, setTeam] = useState(teams.find((t) => t.id === initial)?.id || teams[0]?.id || '');
  const [players, setPlayers] = useState<P[] | null>(null);
  const [f, setF] = useState({ first_name: '', last_name: '', birth_date: '', license_no: '' });
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const t = teams.find((x) => x.id === team);
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
          <table><thead><tr><th>Nom</th><th>Prénom</th><th>Naissance</th><th>Licence</th></tr></thead>
            <tbody>{players.map((p) => <tr key={p.id}><td>{p.last_name}</td><td>{p.first_name}</td><td>{p.birth_date ? new Date(p.birth_date).toLocaleDateString('fr-FR') : '—'}</td><td>{p.license_no ?? '—'}</td></tr>)}</tbody></table>
        )}
        <p className="muted small">{players?.length ?? 0} joueur(s). Les données des joueurs mineurs sont protégées : seuls les éducateurs de l'équipe et la direction y accèdent, et chaque consultation sensible est journalisée.</p>
      </div>
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
