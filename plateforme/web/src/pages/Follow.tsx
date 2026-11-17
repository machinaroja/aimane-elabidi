import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { api, EVAL_ROLE, OBJ_STATUS, PILLAR, fmtShort } from '../api';
import type { Ctx } from '../App';

type Crit = { id: string; club_id: string; title: string; description: string | null; pillar: string; anchors: Record<string, string>; category: string | null; category_id: string | null; active: boolean; sort_order: number; used: boolean };
type Obj = { id: string; title: string; description: string | null; status: string; due_on: string | null; criterion: string | null; criterion_id: string | null; methodology: string | null; author: string | null; can_edit: boolean; notes: number };
type Ev = { id: string; evaluated_on: string; evaluator_role: string; summary: string | null; status: string; mine: boolean; author: string | null; observed: number };
type Score = { criterion_id: string; title: string; pillar: string; anchors: Record<string, string>; level: number; evidence: string };
type Trend = { criterion_id: string; title: string; pillar: string; points: { evaluation_id: string; evaluated_on: string; evaluator_role: string; level: number }[] };
type EvDetail = { evaluation: { id: string; evaluated_on: string; evaluator_role: string; summary: string | null; status: string; mine: boolean; author: string | null; team_name: string; category: string }; scores: Score[]; grid: { criterion_id: string; title: string; pillar: string; anchors: Record<string, string> }[] };

export function Follow({ ctx }: { ctx: Ctx }) {
  const [tab, setTab] = useState<'objectives' | 'evaluations' | 'grid'>('objectives');
  const [team, setTeam] = useState(ctx.teams[0]?.id ?? '');
  const t = ctx.teams.find((x) => x.id === team);
  return (
    <>
      <h1>Objectifs et évaluations</h1>
      <p className="muted">Suivi pédagogique des équipes. Les évaluations reposent sur une grille définie par la direction technique et sur des observations écrites : <strong>aucun score global n'est calculé</strong>.</p>
      <div className="toolbar">
        <div className="seg" role="tablist" aria-label="Sections">{([['objectives', 'Objectifs'], ['evaluations', 'Évaluations'], ['grid', 'Grille d\'évaluation']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : 'ghost'} onClick={() => setTab(k)}>{l}</button>)}</div>
        {tab !== 'grid' && <div><label htmlFor="f-team">Équipe</label><select id="f-team" value={team} onChange={(e) => setTeam(e.target.value)}>{ctx.teams.map((x) => <option key={x.id} value={x.id}>{x.category} {x.name}</option>)}</select></div>}
      </div>
      {tab === 'objectives' && (t ? <Objectives key={team} ctx={ctx} team={t} /> : <p className="muted">Aucune équipe accessible.</p>)}
      {tab === 'evaluations' && (t ? <Evaluations key={team} ctx={ctx} team={t} /> : <p className="muted">Aucune équipe accessible.</p>)}
      {tab === 'grid' && <Grid ctx={ctx} />}
    </>
  );
}

// ================= Objectifs =================
function Objectives({ ctx, team }: { ctx: Ctx; team: Ctx['teams'][number] }) {
  const [objs, setObjs] = useState<Obj[] | null>(null);
  const [crit, setCrit] = useState<Crit[]>([]); const [meth, setMeth] = useState<{ id: string; title: string; status: string }[]>([]);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [f, setF] = useState({ title: '', description: '', criterion_id: '', methodology_item_id: '', due_on: '', status: 'planned' });
  const [open, setOpen] = useState<string | null>(null); const [notes, setNotes] = useState<{ id: string; note: string; author: string; created_at: string }[]>([]); const [note, setNote] = useState('');
  const seq = useRef(0);
  const load = useCallback(() => { const m = ++seq.current; api<Obj[]>('GET', `/api/teams/${team.id}/objectives`).then((r) => { if (m === seq.current) setObjs(r); }).catch((e) => setErr(e.message)); }, [team.id]);
  useEffect(() => { load(); api<Crit[]>('GET', '/api/criteria').then((r) => setCrit(r.filter((c) => c.active))).catch(() => {}); api<any[]>('GET', '/api/methodology').then((r) => setMeth(r.filter((x) => x.status === 'published'))).catch(() => {}); }, [load]);
  const act = async (fn: () => Promise<any>, msg: string) => { setErr(''); setOk(''); try { await fn(); setOk(msg); load(); } catch (e: any) { setErr(e.message); } };
  const toggle = async (o: Obj) => { if (open === o.id) { setOpen(null); return; } setOpen(o.id); setNotes([]); api<typeof notes>('GET', `/api/objectives/${o.id}/notes`).then(setNotes).catch((e) => setErr(e.message)); };
  return (
    <>
      {err && <div className="err" role="alert">{err}</div>}{ok && <div className="okmsg" role="status">{ok}</div>}
      <div className="card">
        <h3>Objectifs pédagogiques — {team.category} {team.name}</h3>
        {objs === null ? <p className="muted">Chargement…</p> : objs.length === 0 ? <p className="muted">Aucun objectif défini pour cette équipe.</p> : (
          <table><thead><tr><th>Objectif</th><th>Statut</th><th>Échéance</th><th></th></tr></thead><tbody>
            {objs.map((o) => (
              <Fragment key={o.id}>
                <tr data-testid="objective">
                  <td><strong>{o.title}</strong>{o.description && <div className="small muted">{o.description}</div>}
                    <div className="small">{o.criterion && <span className="badge">Critère : {o.criterion}</span>} {o.methodology && <span className="badge">Méthodologie : {o.methodology}</span>}</div></td>
                  <td>{o.can_edit ? <select aria-label={`Statut de ${o.title}`} value={o.status} onChange={(e) => act(() => api('POST', `/api/objectives/${o.id}`, { status: e.target.value }), 'Statut mis à jour.')}>{Object.entries(OBJ_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select> : <span className="badge">{OBJ_STATUS[o.status]}</span>}</td>
                  <td>{o.due_on ? fmtShort(o.due_on) : '—'}</td>
                  <td><button className="ghost sm" onClick={() => toggle(o)}>Suivi ({o.notes})</button></td>
                </tr>
                {open === o.id && <tr><td colSpan={4} style={{ background: '#f3f6fd' }}>
                  {notes.length === 0 ? <p className="small muted">Aucune note de suivi.</p> : notes.map((n) => <div key={n.id} className="small" style={{ marginBottom: '.4rem' }}><strong>{fmtShort(n.created_at)}</strong> — {n.author} : {n.note}</div>)}
                  {o.can_edit && <div className="row"><div style={{ flex: 1 }}><label htmlFor={`nn-${o.id}`}>Ajouter une note de suivi (fait observé, date, séance…)</label><textarea id={`nn-${o.id}`} rows={2} style={{ width: '100%' }} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                    <div><button disabled={note.trim().length < 3} onClick={() => act(async () => { await api('POST', `/api/objectives/${o.id}/notes`, { note }); setNote(''); setNotes(await api('GET', `/api/objectives/${o.id}/notes`)); }, 'Note ajoutée.')}>Ajouter</button></div></div>}
                </td></tr>}
              </Fragment>
            ))}
          </tbody></table>
        )}
        <p className="small muted">Le statut est celui que vous renseignez : il n'est jamais déduit des résultats sportifs.</p>
      </div>
      {team.can_objective && (
        <div className="card"><h3>Nouvel objectif</h3>
          <div className="row"><div style={{ flex: 1 }}><label htmlFor="ob-t">Objectif</label><input id="ob-t" style={{ width: '100%' }} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="ex. Occuper la largeur en phase de possession" /></div>
            <div><label htmlFor="ob-d">Échéance</label><input id="ob-d" type="date" value={f.due_on} onChange={(e) => setF({ ...f, due_on: e.target.value })} /></div></div>
          <label htmlFor="ob-x">Description (facultatif)</label><textarea id="ob-x" rows={2} style={{ width: '100%' }} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <div className="row">
            <div><label htmlFor="ob-c">Critère de la grille visé</label><select id="ob-c" value={f.criterion_id} onChange={(e) => setF({ ...f, criterion_id: e.target.value })}><option value="">—</option>{crit.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
            <div><label htmlFor="ob-m">Contenu de la méthodologie</label><select id="ob-m" value={f.methodology_item_id} onChange={(e) => setF({ ...f, methodology_item_id: e.target.value })}><option value="">—</option>{meth.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></div>
            <div><label htmlFor="ob-s">Statut</label><select id="ob-s" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(OBJ_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><button disabled={f.title.trim().length < 3} onClick={() => act(async () => { await api('POST', `/api/teams/${team.id}/objectives`, { ...f, criterion_id: f.criterion_id || null, methodology_item_id: f.methodology_item_id || null, due_on: f.due_on || null, description: f.description || null }); setF({ title: '', description: '', criterion_id: '', methodology_item_id: '', due_on: '', status: 'planned' }); }, 'Objectif créé.')}>Créer l'objectif</button></div></div>
        </div>
      )}
    </>
  );
}

// ================= Évaluations =================
function Evaluations({ ctx, team }: { ctx: Ctx; team: Ctx['teams'][number] }) {
  const [list, setList] = useState<Ev[] | null>(null); const [trend, setTrend] = useState<Trend[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [summary, setSummary] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(() => { api<Ev[]>('GET', `/api/teams/${team.id}/evaluations`).then(setList).catch((e) => setErr(e.message)); api<Trend[]>('GET', `/api/teams/${team.id}/evaluation-trend`).then(setTrend).catch(() => {}); }, [team.id]);
  useEffect(load, [load]);
  if (sel) return <EvalView id={sel} onBack={() => { setSel(null); load(); }} />;
  return (
    <>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="card"><h3>Observations collectives — {team.category} {team.name}</h3>
        {list === null ? <p className="muted">Chargement…</p> : list.length === 0 ? <p className="muted">Aucune évaluation finalisée.</p> : (
          <table><thead><tr><th>Date</th><th>Regard</th><th>Auteur</th><th className="num">Critères observés</th><th></th></tr></thead><tbody>
            {list.map((e) => <tr key={e.id} data-testid="evaluation"><td>{fmtShort(e.evaluated_on)}{e.summary && <div className="small muted">{e.summary}</div>}</td><td className="small">{EVAL_ROLE[e.evaluator_role] ?? e.evaluator_role}</td><td className="small">{e.author ?? '—'}</td>
              <td className="num">{e.observed}</td><td>{e.status === 'draft' ? <><span className="badge warn">Brouillon</span>{' '}</> : null}<button className="ghost sm" onClick={() => setSel(e.id)}>{e.status === 'draft' ? 'Continuer' : 'Voir'}</button></td></tr>)}
          </tbody></table>)}
      </div>
      {trend.length > 0 && (
        <div className="card"><h3>Évolution par critère</h3>
          <p className="small muted">Niveaux observés (1 à 4), du plus ancien au plus récent. Ce sont des relevés, <strong>sans moyenne ni score global</strong> : chaque niveau renvoie à son observation écrite.</p>
          <table><thead><tr><th>Critère</th><th>Niveaux observés</th></tr></thead><tbody>
            {trend.map((r) => <tr key={r.criterion_id} data-testid="trend-row"><td><strong>{r.title}</strong> <span className="badge">{PILLAR[r.pillar]}</span></td>
              <td>{r.points.map((p, i) => <span key={p.evaluation_id} title={EVAL_ROLE[p.evaluator_role]}>{i > 0 && ' → '}<span className="small muted">{fmtShort(p.evaluated_on)} :</span> <strong>{p.level}</strong></span>)}</td></tr>)}
          </tbody></table></div>)}
      {team.can_evaluate && (
        <div className="card"><h3>Nouvelle observation</h3>
          <div className="row"><div><label htmlFor="ev-d">Date d'observation</label><input id="ev-d" type="date" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label htmlFor="ev-s">Contexte (match, séance…)</label><input id="ev-s" style={{ width: '100%' }} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
            <div><button onClick={async () => { setErr(''); try { const r = await api<{ id: string }>('POST', `/api/teams/${team.id}/evaluations`, { evaluated_on: date, summary: summary || null }); setSel(r.id); } catch (e: any) { setErr(e.message); } }}>Commencer</button></div></div>
          <p className="small muted">Votre rôle ({ctx.me.memberships[0]?.role_label}) est enregistré avec l'observation : une auto-évaluation et un regard extérieur ne sont jamais mélangés.</p>
        </div>)}
    </>
  );
}

function EvalView({ id, onBack }: { id: string; onBack: () => void }) {
  const [d, setD] = useState<EvDetail | null>(null);
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [confirm, setConfirm] = useState(false);
  const [lv, setLv] = useState<Record<string, string>>({}); const [ev, setEv] = useState<Record<string, string>>({}); const [saved, setSaved] = useState<Record<string, boolean>>({});
  const load = useCallback(() => api<EvDetail>('GET', `/api/evaluations/${id}`).then((r) => {
    setD(r); const l: Record<string, string> = {}, e: Record<string, string> = {}, sv: Record<string, boolean> = {};
    r.scores.forEach((s) => { l[s.criterion_id] = String(s.level); e[s.criterion_id] = s.evidence; sv[s.criterion_id] = true; }); setLv(l); setEv(e); setSaved(sv);
  }).catch((x) => setErr(x.message)), [id]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <>{err ? <div className="err">{err}</div> : <p className="muted">Chargement…</p>}</>;
  const e = d.evaluation; const draft = e.status === 'draft' && e.mine;
  const saveOne = async (cid: string) => { setErr(''); setOk('');
    try { await api('POST', `/api/evaluations/${id}/scores`, { criterion_id: cid, level: lv[cid] ? Number(lv[cid]) : null, evidence: ev[cid] || null }); setSaved({ ...saved, [cid]: !!lv[cid] }); setOk(lv[cid] ? 'Niveau enregistré.' : 'Critère marqué « non observé ».'); } catch (x: any) { setErr(x.message); } };
  const observed = Object.values(saved).filter(Boolean).length;
  return (
    <>
      <p><a href="#/follow" onClick={(x) => { x.preventDefault(); onBack(); }}>← Évaluations</a></p>
      <h1>Observation du {fmtShort(e.evaluated_on)} — {e.category} {e.team_name} {e.status === 'draft' ? <span className="badge warn">Brouillon</span> : <span className="badge ok">Finalisée</span>}</h1>
      <p className="muted">{EVAL_ROLE[e.evaluator_role] ?? e.evaluator_role}{e.author ? ` · ${e.author}` : ''}{e.summary ? ` · ${e.summary}` : ''}</p>
      {err && <div className="err" role="alert">{err}</div>}{ok && <div className="okmsg" role="status">{ok}</div>}
      {!draft && (
        <div className="card"><table><thead><tr><th>Critère</th><th>Niveau</th><th>Observation</th></tr></thead><tbody>
          {d.scores.map((s) => <tr key={s.criterion_id} data-testid="score-row"><td><strong>{s.title}</strong> <span className="badge">{PILLAR[s.pillar]}</span></td>
            <td><strong>{s.level}</strong> <span className="small muted">— {s.anchors[String(s.level)]}</span></td><td className="small">{s.evidence}</td></tr>)}
        </tbody></table><p className="small muted">Évaluation finalisée : elle ne peut plus être modifiée. Pour la corriger, faites une nouvelle observation. Les critères non listés n'ont pas été observés.</p></div>
      )}
      {draft && (<>
        <div className="okmsg small">Pour chaque critère, choisissez le niveau dont la description correspond à ce que vous avez <strong>observé</strong>, puis écrivez l'observation qui l'étaye. Laissez « Non observé » si vous n'avez rien vu : aucun niveau n'est attribué par défaut.</div>
        {d.grid.map((c) => (
          <div className="card" key={c.criterion_id} data-testid="criterion-card">
            <h3>{c.title} <span className="badge">{PILLAR[c.pillar]}</span> {saved[c.criterion_id] && <span className="badge ok">Enregistré</span>}</h3>
            <div role="radiogroup" aria-label={`Niveau — ${c.title}`}>
              <label style={{ fontWeight: 400 }}><input type="radio" name={`l-${c.criterion_id}`} checked={!lv[c.criterion_id]} onChange={() => { setLv({ ...lv, [c.criterion_id]: '' }); setSaved({ ...saved, [c.criterion_id]: false }); }} /> Non observé</label>
              {['1', '2', '3', '4'].map((n) => <label key={n} style={{ fontWeight: 400 }}><input type="radio" name={`l-${c.criterion_id}`} aria-label={`${c.title} niveau ${n}`} checked={lv[c.criterion_id] === n} onChange={() => { setLv({ ...lv, [c.criterion_id]: n }); setSaved({ ...saved, [c.criterion_id]: false }); }} /> <strong>Niveau {n}</strong> — {c.anchors[n]}</label>)}
            </div>
            {lv[c.criterion_id] && <><label htmlFor={`e-${c.criterion_id}`}>Observation factuelle (ce que vous avez vu, 10 caractères minimum)</label>
              <textarea id={`e-${c.criterion_id}`} rows={2} style={{ width: '100%' }} value={ev[c.criterion_id] ?? ''} onChange={(x) => { setEv({ ...ev, [c.criterion_id]: x.target.value }); setSaved({ ...saved, [c.criterion_id]: false }); }} /></>}
            <p><button className="ghost sm" onClick={() => saveOne(c.criterion_id)} aria-label={`Enregistrer ${c.title}`}>Enregistrer ce critère</button></p>
          </div>
        ))}
        {d.grid.length === 0 && <div className="err">Aucun critère actif dans la grille : la direction technique doit d'abord en valider.</div>}
        <div className="card">
          <p><strong>{observed}</strong> critère(s) observé(s) et enregistré(s).</p>
          {confirm ? <p>Finaliser définitivement cette observation ? <strong>Elle ne pourra plus être modifiée.</strong> <button onClick={async () => { setErr(''); try { await api('POST', `/api/evaluations/${id}/finalize`, {}); onBack(); } catch (x: any) { setErr(x.message); setConfirm(false); } }}>Oui, finaliser</button> <button className="ghost" onClick={() => setConfirm(false)}>Annuler</button></p>
            : <p style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}><button onClick={() => setConfirm(true)} disabled={observed === 0}>Finaliser l'observation</button><button className="ghost" onClick={async () => { await api('POST', `/api/evaluations/${id}/discard`, {}).catch((x) => setErr(x.message)); onBack(); }}>Supprimer le brouillon</button></p>}
          <p className="small muted">Le brouillon n'est visible que de vous. Une fois finalisée, l'observation est visible des éducateurs de l'équipe, du responsable de catégorie et de la direction technique.</p>
        </div>
      </>)}
    </>
  );
}

// ================= Grille d'évaluation =================
function Grid({ ctx }: { ctx: Ctx }) {
  const club = ctx.me.memberships[0]?.club_id; const caps = ctx.me.club_caps[club];
  const [list, setList] = useState<Crit[] | null>(null); const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [form, setForm] = useState(false);
  const empty = { title: '', description: '', pillar: 'transversal', category_id: '', a1: '', a2: '', a3: '', a4: '' };
  const [f, setF] = useState(empty);
  const load = useCallback(() => { api<Crit[]>('GET', '/api/criteria').then(setList).catch((e) => setErr(e.message)); api<any[]>('GET', '/api/categories').then(setCats).catch(() => {}); }, []);
  useEffect(load, [load]);
  const act = async (fn: () => Promise<any>, msg: string) => { setErr(''); setOk(''); try { await fn(); setOk(msg); load(); } catch (e: any) { setErr(e.message); } };
  const active = list?.filter((c) => c.active) ?? []; const inactive = list?.filter((c) => !c.active) ?? [];
  const Card = ({ c }: { c: Crit }) => (
    <div className="card" data-testid="criterion">
      <div className="row" style={{ justifyContent: 'space-between' }}><div><strong>{c.title}</strong> <span className="badge">{PILLAR[c.pillar]}</span> {c.category && <span className="badge">{c.category}</span>} {c.used && <span className="badge ok">Déjà utilisé</span>} {!c.active && <span className="badge warn">Inactif — à valider</span>}</div>
        {caps?.criteria_edit && <div>{c.active ? <button className="ghost sm" onClick={() => act(() => api('POST', `/api/criteria/${c.id}`, { active: false }), 'Critère retiré de la grille (les évaluations passées restent lisibles).')}>Retirer</button> : <button className="sm" onClick={() => act(() => api('POST', `/api/criteria/${c.id}`, { active: true }), 'Critère activé : il est proposé aux éducateurs.')}>Valider et activer</button>}</div>}</div>
      {c.description && !c.description.startsWith('Proposition') && <p className="small muted">{c.description}</p>}
      <table><tbody>{['1', '2', '3', '4'].map((n) => <tr key={n}><td style={{ width: 70 }}><strong>Niveau {n}</strong></td><td className="small">{c.anchors[n]}</td></tr>)}</tbody></table>
    </div>
  );
  return (
    <>
      {err && <div className="err" role="alert">{err}</div>}{ok && <div className="okmsg" role="status">{ok}</div>}
      <p className="muted">La grille est définie par la direction technique. Chaque critère décrit, pour 4 niveaux, un <strong>comportement observable</strong>. Un critère déjà utilisé ne peut plus être modifié : on en crée un nouveau et on retire l'ancien, pour que les évaluations passées restent interprétables.</p>
      {caps?.criteria_edit && <div className="toolbar"><button onClick={() => setForm(!form)}>{form ? 'Fermer' : '+ Nouveau critère'}</button>{(list?.length ?? 0) === 0 && <button className="ghost" onClick={() => act(() => api('POST', '/api/criteria/seed-proposals', { club_id: club }), 'Propositions créées (inactives) : relisez-les puis activez-les.')}>Générer des propositions à valider</button>}</div>}
      {form && (
        <div className="card"><h3>Nouveau critère</h3>
          <div className="row"><div style={{ flex: 1 }}><label htmlFor="g-t">Titre</label><input id="g-t" style={{ width: '100%' }} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><label htmlFor="g-p">Pilier</label><select id="g-p" value={f.pillar} onChange={(e) => setF({ ...f, pillar: e.target.value })}>{Object.entries(PILLAR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label htmlFor="g-c">Catégorie</label><select id="g-c" value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}><option value="">Toutes</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>
          {(['a1', 'a2', 'a3', 'a4'] as const).map((k, i) => <div key={k}><label htmlFor={`g-${k}`}>Niveau {i + 1} — comportement observable (10 caractères minimum)</label><textarea id={`g-${k}`} rows={2} style={{ width: '100%' }} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>)}
          <p><button onClick={() => act(async () => { await api('POST', '/api/criteria', { club_id: club, title: f.title, pillar: f.pillar, category_id: f.category_id || null, anchors: { 1: f.a1, 2: f.a2, 3: f.a3, 4: f.a4 }, active: true }); setF(empty); setForm(false); }, 'Critère créé et activé.')}>Créer et activer</button></p></div>)}
      {list === null && <p className="muted">Chargement…</p>}
      {list && active.length === 0 && <div className="card"><p style={{ margin: 0 }}>Aucun critère actif : les éducateurs ne peuvent pas encore réaliser d'évaluation.</p></div>}
      <h2>Critères actifs ({active.length})</h2>{active.map((c) => <Card key={c.id} c={c} />)}
      {inactive.length > 0 && <><h2>Critères inactifs ({inactive.length})</h2>{inactive.map((c) => <Card key={c.id} c={c} />)}</>}
    </>
  );
}
