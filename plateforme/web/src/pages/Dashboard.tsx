import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Ctx } from '../App';

type TeamRow = { id: string; name: string; category: string; category_id: string; players: number; educators: string[]; trainings_planned: number; trainings_held: number; trainings_with_attendance: number; coverage_pct: number | null; records: number; present: number; late: number; absent: number; excused: number; participation_pct: number | null; matches_played: number; wins: number; draws: number; losses: number; gf: number; ga: number; matches_upcoming: number };
type Educ = { membership_id: string; name: string; role_label: string; teams: string[]; sessions: number; copied: number; read: number | null; read_pct: number | null };
type Flag = { code: string; subject: string; rule: string; value: string; hint: string };
type Dash = { club: string; scope: 'club' | 'category'; period: { type: string; ref: string; label: string; from: string; to: string }; seasons: { id: string; label: string; is_current: boolean }[]; categories: { id: string; name: string }[]; category: string | null;
  kpis: Record<string, number | null>; teams: TeamRow[]; educators: Educ[]; methodology: { id: string; title: string; version_no: number }[]; flags: Flag[]; definitions: Record<string, string>; not_tracked: string[]; generated_at: string };

const fmt = (x: number | null, suffix = ' %') => (x == null ? '—' : `${String(x).replace('.', ',')}${suffix}`);
const csvCell = (x: unknown) => { let s = x == null ? '' : String(x); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };   // anti-injection de formules (tableur)
const nowMonth = () => new Date().toISOString().slice(0, 7);
const nowQuarter = () => `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`;

function Bar({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="muted">—</span>;
  return <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}><div className={`bar ${pct < 60 ? 'low' : ''}`} style={{ flex: 1 }} aria-hidden><i style={{ width: `${pct}%` }} /></div><span style={{ minWidth: 48 }}>{fmt(pct)}</span></div>;
}

export function Dashboard({ ctx }: { ctx: Ctx }) {
  const [type, setType] = useState<'month' | 'quarter' | 'season'>('season');
  const [month, setMonth] = useState(nowMonth());
  const [quarter, setQuarter] = useState(nowQuarter());
  const [category, setCategory] = useState('');
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState(''); const [info, setInfo] = useState('');
  const [report, setReport] = useState(false);

  // Réponses périmées ignorées : si l'utilisateur change de filtre, seule la DERNIÈRE requête peut mettre l'écran à jour.
  useEffect(() => {
    let stale = false;
    setD(null); setErr('');
    const ref = type === 'month' ? month : type === 'quarter' ? quarter : '';
    api<Dash>('GET', `/api/dashboard?period=${type}${ref ? `&ref=${ref}` : ''}${category ? `&category=${category}` : ''}`)
      .then((r) => { if (!stale) setD(r); }).catch((e) => { if (!stale) setErr(e.message); });
    return () => { stale = true; };
  }, [type, month, quarter, category]);

  const club = d?.club ?? ctx.me.memberships[0]?.club_id;
  const canExport = !!ctx.me.club_caps[club]?.calendar_admin || ctx.me.memberships.some((m) => ['club_admin', 'direction', 'directeur_technique'].includes(m.role_key));
  const logExport = async (label: string) => { try { await api('POST', '/api/reports/export-log', { club_id: club, label }); return true; } catch (e: any) { setErr(e.message); return false; } };

  const exportCsv = async () => {
    if (!d || !(await logExport(`CSV ${d.period.label}`))) return;
    const L: string[][] = [[`Rapport AS Lieusaint — ${d.period.label}`, `Généré le ${new Date(d.generated_at).toLocaleString('fr-FR')}`], [],
      ['ÉQUIPES'], ['Catégorie', 'Équipe', 'Éducateurs', 'Joueurs', 'Entraînements tenus', 'Avec présences saisies', 'Couverture %', 'Présences saisies', 'Présents', 'En retard', 'Absents', 'Excusés', 'Participation %', 'Matchs joués', 'V', 'N', 'D', 'BP', 'BC']];
    d.teams.forEach((t) => L.push([t.category, t.name, t.educators.join(' / '), t.players, t.trainings_held, t.trainings_with_attendance, t.coverage_pct, t.records, t.present, t.late, t.absent, t.excused, t.participation_pct, t.matches_played, t.wins, t.draws, t.losses, t.gf, t.ga].map((x) => (x ?? '') as string)));
    L.push([], ['ÉDUCATEURS'], ['Nom', 'Rôle', 'Équipes', 'Séances rattachées à une équipe', 'dont reprises du commun', 'Contenus lus', 'Part lue %']);
    d.educators.forEach((e) => L.push([e.name, e.role_label, e.teams.join(' / '), e.sessions, e.copied, e.read ?? '', e.read_pct ?? ''].map((x) => x as string)));
    L.push([], ['POINTS D\'ATTENTION (indicateurs à vérifier)'], ['Sujet', 'Règle', 'Valeur']); d.flags.forEach((f) => L.push([f.subject, f.rule, f.value]));
    const blob = new Blob(['﻿' + L.map((r) => r.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `rapport-as-lieusaint-${d.period.ref || d.period.type}.csv`; a.click(); URL.revokeObjectURL(a.href);
    setInfo('Export CSV téléchargé (consigné dans le journal d\'audit).');
  };
  const printReport = async () => { if (d && (await logExport(`Impression ${d.period.label}`))) { setInfo('Impression consignée dans le journal d\'audit.'); setTimeout(() => window.print(), 50); } };

  const yearOpts = useMemo(() => { const y = new Date().getFullYear(); return [y - 1, y, y + 1].flatMap((yy) => [1, 2, 3, 4].map((q) => `${yy}-Q${q}`)); }, []);

  return (
    <>
      <div className="toolbar noprint" style={{ justifyContent: 'space-between' }}>
        <div><h1>Tableau de bord{d ? ` — ${d.scope === 'club' ? 'club' : 'ma catégorie'}` : ''}</h1><p className="muted" style={{ margin: 0 }}>Indicateurs issus des données saisies dans la plateforme. Aucune conclusion automatique.</p></div>
      </div>
      <div className="toolbar noprint">
        <div className="seg" role="group" aria-label="Période">{([['month', 'Mois'], ['quarter', 'Trimestre'], ['season', 'Saison']] as const).map(([k, l]) => <button key={k} className={type === k ? 'on' : 'ghost'} onClick={() => setType(k)}>{l}</button>)}</div>
        {type === 'month' && <div><label htmlFor="d-m">Mois</label><input id="d-m" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></div>}
        {type === 'quarter' && <div><label htmlFor="d-q">Trimestre</label><select id="d-q" value={quarter} onChange={(e) => setQuarter(e.target.value)}>{yearOpts.map((q) => <option key={q} value={q}>{q.replace('-Q', ' — T')}</option>)}</select></div>}
        <div><label htmlFor="d-c">Catégorie</label><select id="d-c" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">{d?.scope === 'category' ? 'Toutes mes catégories' : 'Toutes'}</option>{d?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="seg"><button className={!report ? 'on' : 'ghost'} onClick={() => setReport(false)}>Tableau de bord</button><button className={report ? 'on' : 'ghost'} onClick={() => setReport(true)}>Rapport</button></div>
        {report && canExport && <><button onClick={exportCsv} disabled={!d}>Exporter en CSV</button><button className="ghost" onClick={printReport} disabled={!d}>Imprimer / PDF</button></>}
      </div>
      {err && <div className="err" role="alert">{err}</div>}{info && <div className="okmsg noprint" role="status">{info}</div>}
      {!d && !err && <p className="muted">Chargement…</p>}
      {d && (<>
        {report && <div className="card"><h2 style={{ marginTop: 0 }}>{d.scope === 'club' ? 'Rapport de la direction technique' : 'Rapport de catégorie'} — AS Lieusaint</h2><p style={{ margin: 0 }}><strong style={{ textTransform: 'capitalize' }}>{d.period.label}</strong>{' · '}{d.category ? `catégorie ${d.categories.find((c) => c.id === d.category)?.name}` : d.scope === 'club' ? 'toutes catégories' : `catégorie(s) : ${[...new Set(d.teams.map((t) => t.category))].join(', ') || '—'}`} · généré le {new Date(d.generated_at).toLocaleString('fr-FR')}</p></div>}
        {!report && <p className="small muted" style={{ textTransform: 'capitalize' }}>Période : {d.period.label}</p>}
        {d.scope === 'category' && <div className="okmsg small">Vous consultez le tableau de bord de <strong>votre catégorie</strong> uniquement. Les statistiques de lecture de la méthodologie ne sont visibles que de la direction.</div>}

        <div className="kpis" aria-label="Indicateurs clés">
          <div className="kpi"><div className="n">{d.kpis.teams}</div><div className="l">Équipes</div></div>
          <div className="kpi"><div className="n">{d.kpis.educators}</div><div className="l">Éducateurs</div></div>
          <div className="kpi"><div className="n">{d.kpis.players}</div><div className="l">Joueurs</div></div>
          <div className="kpi"><div className="n">{d.kpis.trainings_held}</div><div className="l">Entraînements tenus</div><div className="s">couverture des présences : {fmt(d.kpis.coverage_pct as number | null)}</div></div>
          <div className="kpi"><div className="n" data-testid="kpi-participation">{fmt(d.kpis.participation_pct as number | null)}</div><div className="l">Participation aux entraînements</div><div className="s">{d.kpis.absences} absence(s) · {d.kpis.late} retard(s)</div></div>
          <div className="kpi"><div className="n">{d.kpis.matches_played}</div><div className="l">Matchs joués</div><div className="s">{d.kpis.wins} V · {d.kpis.draws} N · {d.kpis.losses} D · {d.kpis.gf}–{d.kpis.ga}</div></div>
        </div>

        <h2>Points d'attention</h2>
        <p className="small muted">Indicateurs signalés par des règles simples (affichées ci-dessous). Ce sont des <strong>pistes à vérifier</strong> avec les éducateurs, pas des constats ni des évaluations.</p>
        {d.flags.length === 0 && <div className="card"><p style={{ margin: 0 }}>Aucun point d'attention selon les règles actuelles.</p></div>}
        {d.flags.map((f, i) => <div className="flag" key={i} data-testid="flag"><strong>{f.subject}</strong> — {f.value}<div className="r">Règle : {f.rule}. {f.hint}</div></div>)}

        <h2>Par équipe</h2>
        <div className="card tablewrap"><table>
          <thead><tr><th>Équipe</th><th>Éducateurs</th><th className="num">Joueurs</th><th className="num">Entraîn. tenus</th><th>Couverture présences</th><th>Participation</th><th className="num">Matchs (V-N-D)</th><th className="num">Buts</th></tr></thead>
          <tbody>{d.teams.map((t) => (
            <tr key={t.id} data-testid="team-row"><td><strong>{t.category} {t.name}</strong></td><td className="small">{t.educators.length ? t.educators.join(', ') : <span className="muted">aucun attribué</span>}</td>
              <td className="num">{t.players}</td><td className="num">{t.trainings_held}<span className="muted small"> / {t.trainings_planned} prévus</span></td>
              <td style={{ minWidth: 130 }}><Bar pct={t.coverage_pct} /></td><td style={{ minWidth: 130 }}><Bar pct={t.participation_pct} /></td>
              <td className="num">{t.matches_played ? `${t.matches_played} (${t.wins}-${t.draws}-${t.losses})` : '—'}</td><td className="num">{t.matches_played ? `${t.gf}–${t.ga}` : '—'}</td></tr>))}
          </tbody></table></div>

        <h2>Éducateurs et méthodologie du club</h2>
        <div className="card tablewrap"><table>
          <thead><tr><th>Éducateur</th><th>Rôle</th><th>Équipes</th><th className="num">Séances (équipe)</th><th className="num">Reprises du commun</th><th>Méthodologie lue ({d.kpis.methodology_published} contenus)</th></tr></thead>
          <tbody>{d.educators.map((e) => (
            <tr key={e.membership_id} data-testid="educ-row"><td><strong>{e.name}</strong></td><td className="small">{e.role_label}</td><td className="small">{e.teams.length > 3 ? `${e.teams.slice(0, 3).join(', ')}…` : e.teams.join(', ')}</td>
              <td className="num">{e.sessions}</td><td className="num">{e.copied}</td><td style={{ minWidth: 130 }}>{e.read_pct == null ? <span className="muted small">non visible</span> : <Bar pct={e.read_pct} />}</td></tr>))}
          </tbody></table>
          {d.educators.length === 0 && <p className="muted">Aucun éducateur attribué.</p>}</div>

        <h2>Pas encore suivi dans la plateforme</h2>
        <div className="card"><ul style={{ margin: 0 }}>{d.not_tracked.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="small muted" style={{ marginBottom: 0 }}>Ces éléments ne sont pas déduits automatiquement : ils nécessitent des observations et des indicateurs définis par la direction technique.</p></div>

        <details className="card"><summary><strong>Définitions des indicateurs</strong></summary>
          <ul>{Object.values(d.definitions).map((x) => <li key={x} className="small">{x}</li>)}</ul></details>
      </>)}
    </>
  );
}
