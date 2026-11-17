import { useCallback, useEffect, useState } from 'react';
import { api, Ev, fmtDate, fmtTime, KIND, monthKey, dayKey, parisToIso } from '../api';
import type { Ctx } from '../App';

export function CalendarPage({ ctx }: { ctx: Ctx }) {
  const initial = location.hash.split('/')[2] || '';
  const [team, setTeam] = useState(ctx.teams.some((t) => t.id === initial) ? initial : '');
  const [mode, setMode] = useState<'upcoming' | 'past'>('upcoming');
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [form, setForm] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setEvents(null);
    const now = Date.now();
    const [from, to] = mode === 'upcoming' ? [now - 12 * 36e5, now + 400 * 864e5] : [now - 400 * 864e5, now - 12 * 36e5];
    api<Ev[]>('GET', `/api/events?from=${new Date(from).toISOString()}&to=${new Date(to).toISOString()}${team ? `&team=${team}` : ''}`)
      .then((r) => setEvents(mode === 'past' ? r.reverse() : r)).catch((e) => setErr(e.message));
  }, [team, mode]);
  useEffect(load, [load]);

  const canCreate = ctx.teams.some((t) => t.can_event) || Object.values(ctx.me.club_caps).some((c) => c.club_events_add);
  let lastMonth = '', lastDay = '';
  return (
    <>
      <h1>Calendrier</h1>
      <div className="toolbar">
        <div><label htmlFor="team">Équipe</label>
          <select id="team" value={team} onChange={(e) => { setTeam(e.target.value); history.replaceState(null, '', `#/calendar/${e.target.value}`); }}>
            <option value="">Toutes mes équipes</option>
            {ctx.teams.map((t) => <option key={t.id} value={t.id}>{t.category} {t.name}</option>)}
          </select></div>
        <div className="seg"><button className={mode === 'upcoming' ? 'on' : 'ghost'} onClick={() => setMode('upcoming')}>À venir</button><button className={mode === 'past' ? 'on' : 'ghost'} onClick={() => setMode('past')}>Passés</button></div>
        {canCreate && <button onClick={() => setForm(!form)}>{form ? 'Fermer' : '+ Nouvel événement'}</button>}
      </div>
      {err && <div className="err">{err}</div>}
      {form && <NewEvent ctx={ctx} defaultTeam={team} onDone={() => { setForm(false); load(); }} />}
      {events === null && <p className="muted">Chargement…</p>}
      {events?.length === 0 && <p className="muted">Aucun événement.</p>}
      {events?.slice(0, 400).map((e) => {
        const mk = monthKey(e.starts_at), dk = dayKey(e.starts_at);
        const head = (mk !== lastMonth ? <div className="month" key={'m' + e.id}>{mk}</div> : null);
        const dh = (dk !== lastDay ? <div className="day" key={'d' + e.id}>{fmtDate(e.starts_at)}</div> : null);
        lastMonth = mk; lastDay = dk;
        const played = e.match_status === 'played' && e.our_score != null && e.their_score != null;
        return (
          <div key={e.id}>
            {head}{dh}
            <a className={`ev ${e.status === 'cancelled' ? 'cancel' : ''}`} href={`#/event/${e.id}`}>
              <div className="t">{e.time_known ? fmtTime(e.starts_at) : '—'}</div>
              <div className="b">
                <strong>{e.title}</strong>
                <div className="small muted">{KIND[e.kind]}{e.team_name ? ` · ${e.category} ${e.team_name}` : ' · club'}{e.competition ? ` · ${e.competition}` : ''}{e.facility ? ` · ${e.facility}` : ''}{!e.time_known && e.official ? ' · heure non communiquée' : ''}</div>
              </div>
              {played && <Score e={e} />}
              {e.match_status === 'forfeit' && <span className="badge warn">Forfait</span>}
              {e.status === 'cancelled' && <span className="badge ko">Annulé</span>}
              {e.official && <span className="badge off">Officiel</span>}
            </a>
          </div>
        );
      })}
      {events && events.length > 400 && <p className="muted small">Affichage limité à 400 événements : filtrez par équipe.</p>}
    </>
  );
}

function NewEvent({ ctx, defaultTeam, onDone }: { ctx: Ctx; defaultTeam: string; onDone: () => void }) {
  const teams = ctx.teams.filter((t) => t.can_event);
  const clubId = ctx.me.memberships[0]?.club_id;
  const clubEvents = ctx.me.club_caps[clubId]?.club_events_add;
  const [f, setF] = useState({ team: teams.find((t) => t.id === defaultTeam)?.id || teams[0]?.id || '', kind: 'training', title: '', date: '', start: '18:00', end: '19:30', facility: '', force: false });
  const [fac, setFac] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api('GET', '/api/facilities').then(setFac).catch(() => {}); }, []);
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      if (!f.title || !f.date) throw new Error('Titre et date obligatoires.');
      const team = teams.find((t) => t.id === f.team);
      await api('POST', '/api/events', { club_id: team?.club_id ?? clubId, team_id: f.team || null, kind: f.kind, title: f.title, starts_at: parisToIso(f.date, f.start), ends_at: parisToIso(f.date, f.end), facility_id: f.facility || null, force: f.force });
      onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="card" aria-label="Nouvel événement">
      <div className="row">
        <div><label htmlFor="ne-team">Équipe</label><select id="ne-team" value={f.team} onChange={(e) => set('team', e.target.value)}>{clubEvents && <option value="">Événement de club</option>}{teams.map((t) => <option key={t.id} value={t.id}>{t.category} {t.name}</option>)}</select></div>
        <div><label htmlFor="ne-kind">Type</label><select id="ne-kind" value={f.kind} onChange={(e) => set('kind', e.target.value)}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div style={{ flex: 1 }}><label htmlFor="ne-title">Titre</label><input id="ne-title" value={f.title} onChange={(e) => set('title', e.target.value)} style={{ width: '100%' }} /></div>
      </div>
      <div className="row">
        <div><label htmlFor="ne-date">Date</label><input id="ne-date" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div><label htmlFor="ne-s">Début</label><input id="ne-s" type="time" value={f.start} onChange={(e) => set('start', e.target.value)} /></div>
        <div><label htmlFor="ne-e">Fin</label><input id="ne-e" type="time" value={f.end} onChange={(e) => set('end', e.target.value)} /></div>
        <div><label htmlFor="ne-f">Installation</label><select id="ne-f" value={f.facility} onChange={(e) => set('facility', e.target.value)}><option value="">—</option>{fac.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        {Object.values(ctx.me.club_caps).some((c) => c.calendar_admin) && <div><label><input type="checkbox" checked={f.force} onChange={(e) => set('force', e.target.checked)} /> Forcer un conflit de terrain</label></div>}
        <div><button onClick={submit} disabled={busy}>Créer</button></div>
      </div>
      {err && <div className="err" role="alert">{err}</div>}
    </div>
  );
}

// Score affiché dans le même ordre que le titre (domicile – extérieur) ; résultat aussi en lettre (pas seulement en couleur).
function Score({ e }: { e: Ev }) {
  const our = e.our_score!, their = e.their_score!;
  const [h, a] = e.home_away === 'away' ? [their, our] : [our, their];
  const res = our > their ? ['win', 'V', 'Victoire'] : our < their ? ['loss', 'D', 'Défaite'] : ['', 'N', 'Match nul'];
  return <span className={`score ${res[0]}`} title={res[2]} aria-label={`${res[2]} ${h} à ${a}`} data-testid="score">{h}–{a} <small>{res[1]}</small></span>;
}
