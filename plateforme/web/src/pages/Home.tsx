import { useEffect, useState } from 'react';
import { api, Ev, fmtDate, fmtTime, KIND } from '../api';
import { useState as useS } from 'react';
import type { Ctx } from '../App';

export function Home({ ctx }: { ctx: Ctx }) {
  const [events, setEvents] = useState<Ev[] | null>(null);
  useEffect(() => { api<Ev[]>('GET', `/api/events?from=${new Date().toISOString()}&to=${new Date(Date.now() + 30 * 864e5).toISOString()}`).then(setEvents); }, []);
  const m = ctx.me.memberships[0];
  const [name, setName] = useS(''); const [perr, setPerr] = useS('');
  const saveName = async () => { try { await api('POST', '/api/me/profile', { display_name: name }); location.reload(); } catch (e: any) { setPerr(e.message); } };
  return (
    <>
      <h1>Bonjour{ctx.me.display_name ? ` ${ctx.me.display_name}` : ''} 👋</h1>
      {!ctx.me.display_name && m && (
        <div className="card"><h3>Votre nom</h3><p className="small muted">Renseignez le nom qui s'affichera auprès de la direction du club (au lieu de votre adresse e-mail).</p>
          <div className="row"><div><label htmlFor="pn">Prénom et nom</label><input id="pn" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div><div><button onClick={saveName} disabled={!name.trim()}>Enregistrer</button></div></div>
          {perr && <div className="err" role="alert">{perr}</div>}</div>)}
      {m ? <p className="muted">{m.role_label} — {m.club_name}</p> : <div className="err">Votre compte n'a pas encore de rôle dans le club.</div>}
      <h2>{ctx.teams.length > 1 ? 'Mes équipes' : 'Mon équipe'}</h2>
      {ctx.teams.length === 0 && <p className="muted">Aucune équipe ne vous est attribuée.</p>}
      <div className="grid">
        {ctx.teams.slice(0, 24).map((t) => (
          <div className="card" key={t.id} style={{ marginBottom: 0 }}>
            <h3>{t.category} {t.name}</h3>
            <a href={`#/squad/${t.id}`}>Effectif</a> · <a href={`#/calendar/${t.id}`}>Calendrier</a>
          </div>
        ))}
      </div>
      {ctx.teams.length > 24 && <p className="muted small">… et {ctx.teams.length - 24} autres équipes (voir le calendrier).</p>}
      <h2>Prochains rendez-vous (30 jours)</h2>
      {events === null && <p className="muted">Chargement…</p>}
      {events?.length === 0 && <p className="muted">Aucun événement prévu.</p>}
      {events?.slice(0, 8).map((e) => (
        <a className="ev" key={e.id} href={`#/event/${e.id}`}>
          <div className="t">{e.time_known ? fmtTime(e.starts_at) : '—'}</div>
          <div className="b"><strong>{e.title}</strong><div className="small muted">{fmtDate(e.starts_at)} · {KIND[e.kind]}{e.team_name ? ` · ${e.category} ${e.team_name}` : ''}</div></div>
          {e.official && <span className="badge off">Officiel</span>}
        </a>
      ))}
    </>
  );
}
