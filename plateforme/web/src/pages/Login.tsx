import { useEffect, useState } from 'react';
import { api, hasInvite, setToken, takeAuthError } from '../api';

// Deux modes, annoncés par le serveur :
//  * « dev »      : comptes fictifs de démonstration (jamais en production) ;
//  * « supabase » : lien de connexion envoyé par e-mail, réservé aux adresses invitées ou déjà membres du club.
export function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [mode, setMode] = useState<'dev' | 'supabase' | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState(takeAuthError() ?? ''); const [sent, setSent] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ mode: 'dev' | 'supabase' }>('GET', '/api/config').then(async (c) => {
      setMode(c.mode);
      if (c.mode === 'dev') { const a = await api<string[]>('GET', '/api/dev/accounts').catch(() => []); setAccounts(a); setEmail(a[0] || ''); }
    }).catch(() => setMode('supabase'));
  }, []);
  // Lien reçu par e-mail : « …/?token_hash=… ». Rien n'est consommé tant que la personne n'a pas cliqué sur le bouton.
  const [linkHash] = useState(() => new URLSearchParams(location.search).get('token_hash') || '');
  const confirmLink = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await api<{ access_token: string; refresh_token?: string }>('POST', '/api/auth/verify', { token_hash: linkHash });
      setToken(r.access_token); if (r.refresh_token) sessionStorage.setItem('lieusaint.refresh', r.refresh_token);
      history.replaceState(null, '', location.pathname); location.reload();
    } catch (e: any) { setErr(e.message); history.replaceState(null, '', location.pathname); } finally { setBusy(false); }
  };
  const devLogin = async () => { try { const r = await api<{ token: string }>('POST', '/api/auth/dev-login', { email }); onLogin(r.token); } catch (e: any) { setErr(e.message); } };
  const sendLink = async () => {
    setErr(''); setSent(''); setBusy(true);
    try { const r = await api<{ message: string }>('POST', '/api/auth/request-link', { email }); setSent(r.message); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="login card">
      <div className="brand" style={{ color: 'var(--blue)' }}><img className="logo big" src="/logo.png" alt="Logo AS Lieusaint" width="72" height="72" /><h1>AS Lieusaint — Gestion sportive</h1></div>
      {mode === null && <p className="muted">Chargement…</p>}
      {mode === 'dev' && accounts.length > 0 && (
        <>
          <div className="okmsg small">Mode démonstration : comptes fictifs, données non réelles.</div>
          <label htmlFor="acc">Se connecter en tant que</label>
          <select id="acc" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }}>{accounts.map((a) => <option key={a}>{a}</option>)}</select>
          <p><button onClick={devLogin}>Entrer</button></p>
        </>
      )}
      {mode === 'supabase' && linkHash && !err && (
        <>
          <p>Votre lien de connexion est prêt.</p>
          <p><button onClick={confirmLink} disabled={busy}>Me connecter</button></p>
        </>
      )}
      {mode === 'supabase' && !(linkHash && !err) && (
        <>
          {hasInvite() && <div className="okmsg">Vous avez reçu une invitation. Saisissez <strong>l'adresse e-mail à laquelle elle a été envoyée</strong> pour recevoir votre lien de connexion.</div>}
          <label htmlFor="mail">Votre adresse e-mail</label>
          <input id="mail" type="email" autoComplete="email" style={{ width: '100%' }} value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email && !busy && sendLink()} />
          <p><button onClick={sendLink} disabled={!email || busy}>Recevoir mon lien de connexion</button></p>
          <p className="small muted">Un lien à usage unique vous est envoyé par e-mail : pas de mot de passe à retenir. L'accès est réservé aux personnes invitées par le club.</p>
        </>
      )}
      {sent && <div className="okmsg" role="status">{sent}</div>}
      {err && <div className="err" role="alert">{err}</div>}
    </div>
  );
}
