import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate, fmtTime, KIND } from '../api';
import type { Ctx } from '../App';

type Player = { id: string; first_name: string; last_name: string; attendance: string | null; minutes_late: number | null; convocation: string | null };
type Sheet = { event: any; players: Player[]; match: any };
const ATT: [string, string][] = [['present', 'Présent'], ['late', 'Retard'], ['absent', 'Absent'], ['excused', 'Excusé']];
const CONV: Record<string, string> = { pending: 'En attente', accepted: 'Accepté', declined: 'Refusé', maybe: 'Peut-être' };

export function EventSheet({ id }: { ctx: Ctx; id: string }) {
  const [s, setS] = useState<Sheet | null>(null);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [lineup, setLineup] = useState<Set<string>>(new Set());
  const [m, setM] = useState({ opponent: '', home_away: 'home', our: '', their: '', notes: '' });
  const load = useCallback(() => {
    api<Sheet>('GET', `/api/events/${id}/sheet`).then((r) => {
      setS(r); setLineup(new Set(r.match?.lineup ?? []));
      setM({ opponent: r.match?.opponent ?? '', home_away: r.match?.home_away ?? 'home', our: r.match?.our_score ?? '', their: r.match?.their_score ?? '', notes: r.match?.notes ?? '' });
    }).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(load, [load]);
  const act = async (fn: () => Promise<any>, msg = 'Enregistré.') => { setErr(''); setOk(''); try { await fn(); setOk(msg); load(); } catch (e: any) { setErr(e.message); } };

  if (err && !s) return <div className="err">{err}</div>;
  if (!s) return <p className="muted">Chargement…</p>;
  const e = s.event;
  const isMatch = e.kind === 'match';
  return (
    <>
      <p><a href="#/calendar">← Calendrier</a></p>
      <h1>{e.title} {e.official && <span className="badge off">Officiel</span>} {e.status === 'cancelled' && <span className="badge ko">Annulé</span>}</h1>
      <p className="muted">{KIND[e.kind]}{e.team_name ? ` · ${e.category} ${e.team_name}` : ''}{e.competition ? ` · ${e.competition}` : ''}<br />
        {fmtDate(e.starts_at)} {e.time_known ? `à ${fmtTime(e.starts_at)}` : '(heure non communiquée par la compétition)'}</p>
      {e.official && <div className="okmsg small">Match officiel : la date, l'heure et l'adversaire sont fixés par la compétition et mis à jour automatiquement. Vous gérez la convocation, la composition et vos notes.</div>}
      {err && <div className="err" role="alert">{err}</div>}{ok && <div className="okmsg" role="status">{ok}</div>}

      {isMatch && (
        <div className="card"><h3>Match</h3>
          <div className="row">
            <div><label htmlFor="m-opp">Adversaire</label><input id="m-opp" value={m.opponent} onChange={(x) => setM({ ...m, opponent: x.target.value })} disabled={!e.can_match || e.official} /></div>
            <div><label htmlFor="m-ha">Lieu</label><select id="m-ha" value={m.home_away} onChange={(x) => setM({ ...m, home_away: x.target.value })} disabled={!e.can_match || e.official}><option value="home">Domicile</option><option value="away">Extérieur</option><option value="neutral">Terrain neutre</option></select></div>
            <div><label htmlFor="m-s1">Nous</label><input id="m-s1" type="number" min="0" max="99" style={{ width: 70 }} value={m.our} onChange={(x) => setM({ ...m, our: x.target.value })} disabled={!e.can_match || e.official} /></div>
            <div><label htmlFor="m-s2">Eux</label><input id="m-s2" type="number" min="0" max="99" style={{ width: 70 }} value={m.their} onChange={(x) => setM({ ...m, their: x.target.value })} disabled={!e.can_match || e.official} /></div>
          </div>
          <label htmlFor="m-n">Notes de l'entraîneur (privées à l'équipe)</label>
          <textarea id="m-n" rows={2} style={{ width: '100%' }} value={m.notes} onChange={(x) => setM({ ...m, notes: x.target.value })} disabled={!e.can_match} />
          {e.can_match && <p><button onClick={() => act(() => api('POST', `/api/events/${id}/match`, { opponent: m.opponent, home_away: m.home_away, competition: e.competition, our_score: m.our === '' ? null : Number(m.our), their_score: m.their === '' ? null : Number(m.their), lineup: [...lineup], notes: m.notes }), 'Match enregistré.')}>Enregistrer le match et la composition</button></p>}
        </div>
      )}

      {e.team_id && (
        <div className="card"><h3>Joueurs ({s.players.length})</h3>
          {s.players.length === 0 && <p className="muted">Aucun joueur n'est rattaché à cette équipe pour cette date.</p>}
          {s.players.length > 0 && (
            <table>
              <thead><tr><th>Joueur</th>{isMatch && <th>Titulaire</th>}<th>Convocation</th><th>Présence</th></tr></thead>
              <tbody>
                {s.players.map((p) => (
                  <tr key={p.id}>
                    <td>{p.last_name} {p.first_name}</td>
                    {isMatch && <td><input type="checkbox" aria-label={`Titulaire ${p.last_name}`} checked={lineup.has(p.id)} disabled={!e.can_match} onChange={() => { const n = new Set(lineup); n.has(p.id) ? n.delete(p.id) : n.add(p.id); setLineup(n); }} /></td>}
                    <td>
                      {p.convocation ? (
                        <select aria-label={`Réponse ${p.last_name}`} value={p.convocation} disabled={!e.can_convoke} onChange={(x) => act(() => api('POST', `/api/events/${id}/convocations/response`, { player_id: p.id, status: x.target.value }))}>
                          {Object.entries(CONV).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      ) : e.can_convoke ? <button className="sm ghost" onClick={() => act(() => api('POST', `/api/events/${id}/convocations`, { player_ids: [p.id] }), 'Joueur convoqué.')}>Convoquer</button> : <span className="muted">—</span>}
                    </td>
                    <td>{e.can_attendance ? ATT.map(([k, label]) => (
                      <button key={k} className={`sm ${p.attendance === k ? 'on' : 'ghost'}`} aria-pressed={p.attendance === k} aria-label={`${label} ${p.last_name}`} onClick={() => act(() => api('POST', `/api/events/${id}/attendance`, { player_id: p.id, status: k, minutes_late: k === 'late' ? 10 : null }), `${label} enregistré.`)}>{label}</button>
                    )) : <span className="muted">{ATT.find((a) => a[0] === p.attendance)?.[1] ?? '—'}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {e.can_convoke && s.players.some((p) => !p.convocation) && <p><button className="ghost" onClick={() => act(() => api('POST', `/api/events/${id}/convocations`, { player_ids: s.players.filter((p) => !p.convocation).map((p) => p.id) }), 'Tous les joueurs sont convoqués.')}>Convoquer tout l'effectif</button></p>}
        </div>
      )}
    </>
  );
}
