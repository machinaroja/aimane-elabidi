import { useCallback, useEffect, useState } from 'react';
import { api, METH_KIND, fmtDate } from '../api';
import type { Ctx } from '../App';

type Item = { id: string; club_id: string; kind: string; title: string; status: string; category_id: string | null; category: string | null; version_id: string | null; version_no: number | null; published_at: string | null; body: any; has_draft: boolean };
type Ver = { id: string; version_no: number; status: string; change_note: string | null; body: any; created_at: string; published_at: string | null; reads: string };
type Section = { name: string; type: 'text' | 'list'; value: string };
type Cat = { id: string; name: string };

// ---- conversion contenu (jsonb) <-> sections éditables
const toSections = (body: any): Section[] => Object.entries(body ?? {}).map(([name, v]) => Array.isArray(v) ? { name, type: 'list' as const, value: v.join('\n') } : { name, type: 'text' as const, value: typeof v === 'string' ? v : JSON.stringify(v) });
const toBody = (secs: Section[]) => Object.fromEntries(secs.filter((s) => s.name.trim()).map((s) => [s.name.trim(), s.type === 'list' ? s.value.split('\n').map((x) => x.trim()).filter(Boolean) : s.value.trim()]));
const isNew = (d: string | null) => !!d && Date.now() - new Date(d).getTime() < 14 * 864e5;

export function Methodology({ ctx }: { ctx: Ctx }) {
  const club = ctx.me.memberships[0]?.club_id;
  const caps = ctx.me.club_caps[club];
  const canManage = !!caps?.methodology_edit;
  const [items, setItems] = useState<Item[] | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ item?: Item; version?: Ver } | 'new' | null>(null);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const load = useCallback(() => { api<Item[]>('GET', '/api/methodology').then(setItems).catch((e) => setErr(e.message)); api<Cat[]>('GET', '/api/categories').then(setCats).catch(() => {}); }, []);
  useEffect(load, [load]);
  const flash = (m: string) => { setMsg(m); setErr(''); load(); };

  const published = items?.filter((i) => i.status === 'published') ?? [];
  const drafts = items?.filter((i) => i.status !== 'published') ?? [];
  const groups = Object.entries(METH_KIND).map(([k, label]) => [label, published.filter((i) => i.kind === k)] as const).filter(([, l]) => l.length);

  if (editor) return <Editor key={editor === 'new' ? 'new' : editor.version?.id ?? editor.item?.id} ctx={ctx} cats={cats} init={editor} onCancel={() => setEditor(null)} onDone={(m) => { setEditor(null); flash(m); }} />;

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div><h1>Méthodologie AS Lieusaint</h1><p className="muted" style={{ margin: 0 }}>Position — Possession — Pression. Référence commune à tous les éducateurs du club.</p></div>
        {caps?.methodology_add && <button onClick={() => { setMsg(''); setEditor('new'); }}>+ Nouveau contenu</button>}
      </div>
      {err && <div className="err" role="alert">{err}</div>}{msg && <div className="okmsg" role="status">{msg}</div>}
      {items === null && <p className="muted">Chargement…</p>}
      {items && published.length === 0 && <div className="card"><p>Aucun contenu publié pour le moment.{canManage ? ' Créez le premier contenu avec « Nouveau contenu ».' : ' La direction technique publie la méthodologie du club ici.'}</p></div>}
      {groups.map(([label, list]) => (
        <section key={label}><h2>{label}</h2>
          {list.map((i) => <ItemCard key={i.id} item={i} ctx={ctx} canManage={canManage} open={open === i.id} onToggle={() => setOpen(open === i.id ? null : i.id)} onEdit={(version) => { setMsg(''); setEditor({ item: i, version }); }} onFlash={flash} onError={setErr} />)}
        </section>
      ))}
      {canManage && drafts.length > 0 && <section><h2>Brouillons — non visibles des éducateurs</h2>
        {drafts.map((i) => <ItemCard key={i.id} item={i} ctx={ctx} canManage open={open === i.id} onToggle={() => setOpen(open === i.id ? null : i.id)} onEdit={(version) => { setMsg(''); setEditor({ item: i, version }); }} onFlash={flash} onError={setErr} />)}</section>}
    </>
  );
}

function ItemCard({ item: i, ctx, canManage, open, onToggle, onEdit, onFlash, onError }: { item: Item; ctx: Ctx; canManage: boolean; open: boolean; onToggle: () => void; onEdit: (v?: Ver) => void; onFlash: (m: string) => void; onError: (m: string) => void }) {
  const [vers, setVers] = useState<Ver[] | null>(null);
  const [team, setTeam] = useState(ctx.teams[0]?.id ?? '');
  const [hist, setHist] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const loadVers = useCallback(() => api<Ver[]>('GET', `/api/methodology/${i.id}/versions`).then(setVers).catch((e) => onError(e.message)), [i.id, onError]);
  useEffect(() => { if (open) { loadVers(); if (i.version_id) api('POST', `/api/methodology/versions/${i.version_id}/read`, {}).catch(() => {}); } }, [open, i.version_id, loadVers]);
  const act = async (fn: () => Promise<any>, msg: string) => { try { await fn(); onFlash(msg); loadVers(); } catch (e: any) { onError(e.message); } };
  const draft = vers?.find((v) => v.status === 'draft');
  return (
    <div className="card" data-testid="meth-item">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><strong>{i.title}</strong> {i.version_no && <span className="badge">v{i.version_no}</span>} {i.category && <span className="badge">{i.category}</span>} {isNew(i.published_at) && <span className="badge off">Nouveau</span>}
          {i.status !== 'published' && <span className="badge warn">Brouillon — à valider</span>} {i.status === 'published' && i.has_draft && canManage && <span className="badge warn">Brouillon en cours</span>}</div>
        <div><button className="ghost sm" onClick={onToggle}>{open ? 'Masquer' : 'Lire'}</button></div>
      </div>
      {open && (<>
        {i.status === 'published' && <Body body={i.body} />}
        {i.status !== 'published' && draft && <Body body={draft.body} />}
        {i.status === 'published' && ctx.teams.length > 0 && <div className="row"><div><label htmlFor={`ct-${i.id}`}>Copier pour</label><select id={`ct-${i.id}`} value={team} onChange={(e) => setTeam(e.target.value)}>{ctx.teams.map((t) => <option key={t.id} value={t.id}>{t.category} {t.name}</option>)}</select></div>
          <div><button onClick={() => act(() => api('POST', `/api/methodology/${i.id}/copy`, { team_id: team || null }), 'Copiée dans votre espace personnel. L\'original reste intact : vous pouvez l\'adapter à votre équipe.')}>Copier dans mon espace</button></div></div>}
        {canManage && (
          <div className="row" style={{ marginTop: '.6rem' }}>
            {draft ? <>
              <button className="ghost" onClick={() => onEdit(draft)}>Modifier le brouillon</button>
              {confirm === draft.id ? <><span>Publier la version {draft.version_no} pour <strong>tous les éducateurs</strong> ?</span><button onClick={() => act(() => api('POST', `/api/methodology/versions/${draft.id}/publish`, {}), `Version ${draft.version_no} publiée : visible de tous les éducateurs.`)}>Oui, publier</button><button className="ghost" onClick={() => setConfirm(null)}>Annuler</button></>
                : <><button onClick={() => setConfirm(draft.id)}>Publier</button><button className="ghost" onClick={() => act(() => api('POST', `/api/methodology/versions/${draft.id}/discard`, {}), 'Brouillon supprimé.')}>Supprimer le brouillon</button></>}
            </> : <button className="ghost" onClick={() => act(async () => { const r = await api<{ version_id: string }>('POST', `/api/methodology/${i.id}/versions`, {}); onEdit({ id: r.version_id, version_no: 0, status: 'draft', change_note: null, body: i.body, created_at: '', published_at: null, reads: '0' }); }, 'Nouveau brouillon créé.')}>Nouvelle version</button>}
            <button className="ghost" onClick={() => setHist(!hist)}>{hist ? 'Masquer l\'historique' : 'Historique des versions'}</button>
          </div>
        )}
        {(hist || (!canManage && (vers?.length ?? 0) > 1)) && vers && (
          <table style={{ marginTop: '.6rem' }}><thead><tr><th>Version</th><th>Statut</th><th>Date</th><th>Modification</th>{canManage && <th>Lectures</th>}</tr></thead>
            <tbody>{vers.map((v) => <tr key={v.id}><td>v{v.version_no}</td><td>{v.status === 'published' ? <span className="badge ok">Publiée</span> : <span className="badge warn">Brouillon</span>}</td><td>{v.published_at ? fmtDate(v.published_at) : '—'}</td><td>{v.change_note ?? '—'}</td>{canManage && <td>{v.status === 'published' ? `${v.reads} lecteur(s)` : '—'}</td>}</tr>)}</tbody></table>
        )}
      </>)}
    </div>
  );
}

function Body({ body }: { body: any }) {
  if (!body || typeof body !== 'object') return <pre className="body">{String(body ?? '')}</pre>;
  return <>{Object.entries(body).map(([k, v]) => <div key={k}><strong>{k}</strong>{Array.isArray(v) ? <ul>{v.map((x, n) => <li key={n}>{String(x)}</li>)}</ul> : <pre className="body">{typeof v === 'string' ? v : JSON.stringify(v, null, 1)}</pre>}</div>)}</>;
}

function Editor({ ctx, cats, init, onCancel, onDone }: { ctx: Ctx; cats: Cat[]; init: 'new' | { item?: Item; version?: Ver }; onCancel: () => void; onDone: (m: string) => void }) {
  const club = ctx.me.memberships[0].club_id;
  const existing = init === 'new' ? undefined : init;
  const [kind, setKind] = useState(existing?.item?.kind ?? 'principle');
  const [title, setTitle] = useState(existing?.item?.title ?? '');
  const [category, setCategory] = useState(existing?.item?.category_id ?? '');
  const [secs, setSecs] = useState<Section[]>(existing?.version ? toSections(existing.version.body) : [{ name: 'Idée', type: 'text', value: '' }, { name: 'Consignes', type: 'list', value: '' }]);
  const [note, setNote] = useState(existing?.version?.change_note ?? '');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const setSec = (n: number, patch: Partial<Section>) => setSecs(secs.map((s, i) => (i === n ? { ...s, ...patch } : s)));

  const save = async (publish: boolean) => {
    setErr(''); setBusy(true);
    try {
      if (!title.trim()) throw new Error('Le titre est obligatoire.');
      const content = toBody(secs);
      if (Object.keys(content).length === 0) throw new Error('Ajoutez au moins une section avec un titre.');
      let versionId = existing?.version?.id; let itemId = existing?.item?.id;
      if (!existing?.item) { const r = await api<{ item_id: string; version_id: string }>('POST', '/api/methodology', { club_id: club, kind, title, category_id: category || null, content, change_note: note || null }); versionId = r.version_id; itemId = r.item_id; }
      else { await api('POST', `/api/methodology/versions/${versionId}/update`, { content, change_note: note || null }); await api('POST', `/api/methodology/${itemId}/meta`, { title, category_id: category || null }); }
      if (publish) { await api('POST', `/api/methodology/versions/${versionId}/publish`, {}); onDone('Contenu publié : visible de tous les éducateurs.'); } else onDone('Brouillon enregistré (non visible des éducateurs).');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <p><a href="#/methodology" onClick={(e) => { e.preventDefault(); onCancel(); }}>← Méthodologie</a></p>
      <h1>{existing?.item ? 'Modifier un contenu' : 'Nouveau contenu'}</h1>
      <div className="card">
        <div className="row">
          <div><label htmlFor="mk">Type</label><select id="mk" value={kind} onChange={(e) => setKind(e.target.value)} disabled={!!existing?.item}>{Object.entries(METH_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div style={{ flex: 1 }}><label htmlFor="mt">Titre</label><input id="mt" style={{ width: '100%' }} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><label htmlFor="mc">Catégorie</label><select id="mc" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Tout le club</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </div>
        <h3 style={{ marginTop: '1rem' }}>Contenu</h3>
        {secs.map((s, n) => (
          <div key={n} style={{ borderTop: '1px solid var(--line)', paddingTop: '.5rem' }}>
            <div className="row">
              <div style={{ flex: 1 }}><label htmlFor={`sn-${n}`}>Titre de la section</label><input id={`sn-${n}`} style={{ width: '100%' }} value={s.name} onChange={(e) => setSec(n, { name: e.target.value })} /></div>
              <div><label htmlFor={`st-${n}`}>Forme</label><select id={`st-${n}`} value={s.type} onChange={(e) => setSec(n, { type: e.target.value as 'text' | 'list' })}><option value="text">Texte</option><option value="list">Liste (une ligne par point)</option></select></div>
              <div><button className="ghost sm" onClick={() => setSecs(secs.filter((_, i) => i !== n))} aria-label={`Retirer la section ${s.name}`}>Retirer</button></div>
            </div>
            <label htmlFor={`sv-${n}`}>{s.type === 'list' ? 'Points (un par ligne)' : 'Texte'}</label>
            <textarea id={`sv-${n}`} rows={s.type === 'list' ? 4 : 3} style={{ width: '100%' }} value={s.value} onChange={(e) => setSec(n, { value: e.target.value })} />
          </div>
        ))}
        <p><button className="ghost" onClick={() => setSecs([...secs, { name: '', type: 'text', value: '' }])}>+ Ajouter une section</button></p>
        <label htmlFor="mn">Note de modification (conservée dans l'historique)</label>
        <input id="mn" style={{ width: '100%' }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. Ajout des consignes de pressing" />
        {err && <div className="err" role="alert">{err}</div>}
        <p style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <button onClick={() => save(false)} disabled={busy} className="ghost">Enregistrer le brouillon</button>
          <button onClick={() => save(true)} disabled={busy}>Publier pour tous les éducateurs</button>
          <button onClick={onCancel} className="ghost">Annuler</button>
        </p>
        <p className="muted small">Une version publiée ne peut plus être modifiée : pour la corriger, créez une nouvelle version. L'historique est conservé.</p>
      </div>
    </>
  );
}
