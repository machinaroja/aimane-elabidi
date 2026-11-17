import { useEffect, useState } from 'react';
import { api } from '../api';

// Connexion de démonstration (développement). En production : Supabase Auth (lien magique e-mail) fournit le jeton.
export function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [accounts, setAccounts] = useState<string[] | null>(null);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { api<string[]>('GET', '/api/dev/accounts').then((a) => { setAccounts(a); setEmail(a[0] || ''); }).catch(() => setAccounts([])); }, []);
  const go = async () => { try { const r = await api<{ token: string }>('POST', '/api/auth/dev-login', { email }); onLogin(r.token); } catch (e: any) { setErr(e.message); } };
  return (
    <div className="login card">
      <div className="brand" style={{ color: 'var(--blue)' }}><img className="logo big" src="/logo.png" alt="Logo AS Lieusaint" width="72" height="72" /><h1>AS Lieusaint — Gestion sportive</h1></div>
      {accounts === null && <p className="muted">Chargement…</p>}
      {accounts && accounts.length > 0 && (
        <>
          <div className="okmsg small">Mode démonstration : comptes fictifs, données non réelles. La connexion par e-mail sera branchée sur Supabase Auth.</div>
          <label htmlFor="acc">Se connecter en tant que</label>
          <select id="acc" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }}>{accounts.map((a) => <option key={a}>{a}</option>)}</select>
          <p><button onClick={go}>Entrer</button></p>
        </>
      )}
      {accounts && accounts.length === 0 && <p>La connexion se fait via le lien reçu par e-mail (invitation du club).</p>}
      {err && <div className="err">{err}</div>}
    </div>
  );
}
