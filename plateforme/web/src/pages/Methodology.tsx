import { useEffect, useState } from 'react';
import { api, METH_KIND } from '../api';
import type { Ctx } from '../App';

type Item = { id: string; kind: string; title: string; status: string; category: string | null; version_no: number | null; published_at: string | null; body: any };
export function Methodology({ ctx }: { ctx: Ctx }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [team, setTeam] = useState(ctx.teams[0]?.id ?? '');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  useEffect(() => { api<Item[]>('GET', '/api/methodology').then(setItems).catch((e) => setErr(e.message)); }, []);
  const copy = async (id: string) => { setMsg(''); setErr(''); try { await api('POST', `/api/methodology/${id}/copy`, { team_id: team || null }); setMsg('Copiée dans votre espace personnel. L\'original reste intact : vous pouvez l\'adapter à votre équipe.'); } catch (e: any) { setErr(e.message); } };
  const canCopy = true;
  const published = items?.filter((i) => i.status === 'published') ?? [];
  const drafts = items?.filter((i) => i.status !== 'published') ?? [];
  const groups = Object.entries(METH_KIND).map(([k, label]) => [label, published.filter((i) => i.kind === k)] as const).filter(([, l]) => l.length);
  return (
    <>
      <h1>Méthodologie AS Lieusaint</h1>
      <p className="muted">Position — Possession — Pression. Référence commune à tous les éducateurs du club.</p>
      {err && <div className="err" role="alert">{err}</div>}{msg && <div className="okmsg" role="status">{msg}</div>}
      {items === null && <p className="muted">Chargement…</p>}
      {items && published.length === 0 && <div className="card"><p>Aucun contenu publié pour le moment. La direction technique publie la méthodologie du club ici.</p></div>}
      {groups.map(([label, list]) => (
        <section key={label}><h2>{label}</h2>
          {list.map((i) => (
            <div className="card" key={i.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}><div><strong>{i.title}</strong> <span className="badge">v{i.version_no}</span> {i.category && <span className="badge">{i.category}</span>}</div>
                <div><button className="ghost sm" onClick={() => setOpen(open === i.id ? null : i.id)}>{open === i.id ? 'Masquer' : 'Lire'}</button></div></div>
              {open === i.id && (<>
                <Body body={i.body} />
                {canCopy && ctx.teams.length > 0 && <div className="row"><div><label htmlFor={`ct-${i.id}`}>Copier pour</label><select id={`ct-${i.id}`} value={team} onChange={(e) => setTeam(e.target.value)}>{ctx.teams.map((t) => <option key={t.id} value={t.id}>{t.category} {t.name}</option>)}</select></div><div><button onClick={() => copy(i.id)}>Copier dans mon espace</button></div></div>}
              </>)}
            </div>
          ))}
        </section>
      ))}
      {drafts.length > 0 && <><h2>Brouillons (visibles par la direction technique)</h2>{drafts.map((i) => <div className="card" key={i.id}><strong>{i.title}</strong> <span className="badge warn">Brouillon — à valider</span></div>)}</>}
    </>
  );
}
function Body({ body }: { body: any }) {
  if (!body || typeof body !== 'object') return <pre className="body">{String(body ?? '')}</pre>;
  return <>{Object.entries(body).map(([k, v]) => <div key={k}><strong style={{ textTransform: 'capitalize' }}>{k}</strong>{Array.isArray(v) ? <ul>{v.map((x, n) => <li key={n}>{String(x)}</li>)}</ul> : <pre className="body">{typeof v === 'string' ? v : JSON.stringify(v, null, 1)}</pre>}</div>)}</>;
}
