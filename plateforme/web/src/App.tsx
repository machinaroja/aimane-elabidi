import { useEffect, useState } from 'react';
import { api, getToken, setToken, Me, Team } from './api';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { CalendarPage } from './pages/Calendar';
import { EventSheet } from './pages/EventSheet';
import { Squad } from './pages/Squad';
import { Methodology } from './pages/Methodology';
import { Admin } from './pages/Admin';

export type Ctx = { me: Me; teams: Team[] };

function useHash() {
  const [h, setH] = useState(location.hash || '#/');
  useEffect(() => { const f = () => setH(location.hash || '#/'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [err, setErr] = useState('');
  const hash = useHash();

  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const invite = new URLSearchParams(location.search).get('invite');
        if (invite) { await api('POST', '/api/invitations/accept', { token: invite }).catch((e) => setErr(e.message)); history.replaceState(null, '', location.pathname + location.hash); }
        const [me, teams] = await Promise.all([api<Me>('GET', '/api/me'), api<Team[]>('GET', '/api/teams')]);
        setCtx({ me, teams });
      } catch (e: any) { setErr(e.message); }
    })();
  }, [authed]);

  if (!authed) return <Login onLogin={(t) => { setToken(t); setAuthed(true); }} />;
  if (!ctx) return <main>{err ? <div className="err">{err}</div> : <p className="muted">Chargement…</p>}</main>;

  const { me } = ctx;
  const clubCaps = Object.values(me.club_caps);
  const isAdmin = clubCaps.some((c) => c.categories_add || c.teams_add || c.invitations_add);
  const [, route = '', arg = ''] = hash.split('/');
  const nav: [string, string, boolean][] = [['', 'Accueil', true], ['calendar', 'Calendrier', true], ['squad', 'Effectif', true], ['methodology', 'Méthodologie', true], ['admin', 'Administration', isAdmin]];
  const logout = () => { setToken(null); location.hash = ''; location.reload(); };

  return (
    <>
      <header className="top">
        <div className="brand"><div className="mark" aria-hidden>ASL</div><span>AS Lieusaint</span></div>
        <nav aria-label="Navigation principale">
          {nav.filter((n) => n[2]).map(([k, label]) => <a key={k} href={`#/${k}`} className={route === k || (k === 'calendar' && route === 'event') ? 'on' : ''}>{label}</a>)}
        </nav>
        <div className="who"><span data-testid="who">{me.email}</span><br /><span className="small">{me.memberships[0]?.role_label ?? 'Aucun rôle'}</span><button className="ghost sm" onClick={logout}>Déconnexion</button></div>
      </header>
      <main>
        {err && <div className="err">{err}</div>}
        {route === '' && <Home ctx={ctx} />}
        {route === 'calendar' && <CalendarPage ctx={ctx} />}
        {route === 'event' && <EventSheet ctx={ctx} id={arg} />}
        {route === 'squad' && <Squad ctx={ctx} />}
        {route === 'methodology' && <Methodology ctx={ctx} />}
        {route === 'admin' && (isAdmin ? <Admin ctx={ctx} /> : <div className="err">Accès réservé à la direction.</div>)}
      </main>
    </>
  );
}
