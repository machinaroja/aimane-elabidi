// Test de bout en bout : vrai navigateur (Chromium) -> interface -> passerelle -> PostgreSQL (RLS).
const { chromium } = require('playwright');
const { execSync } = require('node:child_process');
const BASE = process.env.BASE || 'http://localhost:8787';
const DB = process.env.PGDATABASE || 'lieusaint_dev';
const sql = (q) => execSync(`psql -X -At -d ${DB} -c "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
// Le test crée des données (joueur, événement, invitation) : on repart TOUJOURS d'une base de démonstration neuve.
execSync(`${__dirname}/../dev.sh`, { stdio: 'ignore' });
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? '✔' : '❌'} ${name}${cond ? '' : ' ' + extra}`); };

async function login(browser, who) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && !/401|403|404|409|400/.test(m.text()) && errors.push(m.text()));
  await page.goto(BASE);
  await page.selectOption('#acc', `${who}@demo.lieusaint.local`);
  await page.click('text=Entrer');
  await page.waitForSelector('header.top');
  return { page, ctx, errors };
}
// attend la fin des chargements (plus de « Chargement… ») puis le sélecteur voulu
const ready = async (page, sel) => { await page.waitForSelector('text=Chargement…', { state: 'detached' }); if (sel) await page.waitForSelector(sel); };
const count = async (page, sel, n) => { await page.waitForFunction(([s, k]) => document.querySelectorAll(s).length === k, [sel, n], { timeout: 8000 }).catch(() => {}); return page.locator(sel).count(); };
const shot = (page, n) => page.screenshot({ path: `shots/${n}.png`, fullPage: false });

(async () => {
  const browser = await chromium.launch();

  // ===== Entraîneur U14 =====
  {
    const { page, errors } = await login(browser, 'coach-u14');
    ok('coach : pas d\'entrée « Administration »', (await page.locator('nav >> text=Administration').count()) === 0);
    ok('coach : voit son équipe U14 1 sur l\'accueil', await page.locator('.card h3', { hasText: 'U14 1' }).count() === 1);
    ok('coach : ne voit aucune autre équipe', await page.locator('.card h3').count() === 1);
    await shot(page, '01-accueil-coach-u14');

    await page.click('nav >> text=Calendrier');
    await page.waitForSelector('h1:has-text("Calendrier")'); await ready(page, '.ev');
    const titles = await page.locator('.ev strong').allInnerTexts();
    ok('calendrier : matchs de U14 1 uniquement (aucun match Seniors/autre équipe)', titles.length > 0 && titles.every((t) => /Lieusaint Foot AS 1 /.test(t) || / Lieusaint Foot AS 1$/.test(t)) , titles.slice(0, 3).join(' | '));
    ok('calendrier : badge « Officiel » affiché', await page.locator('.badge.off').count() > 0);
    await shot(page, '02-calendrier-coach');
    await page.click('button:has-text("Passés")');
    await ready(page, '.ev .score');
    ok('calendrier « Passés » : scores affichés', await page.locator('.score').count() > 0);
    const away = page.locator('.ev', { hasText: 'Pontault Com. Ums 2 – Lieusaint Foot AS 1' }).first();
    ok('score lisible dans l\'ordre du titre : Pontault 2–3 Lieusaint = victoire (V)', (await away.locator('[data-testid=score]').innerText()).replace(/\s+/g, ' ').trim() === '2–3 V');
    const home = page.locator('.ev', { hasText: 'Lieusaint Foot AS 1 – Mormant FC 1' }).first();
    ok('match à domicile : Lieusaint 6–0 Mormant = victoire (V)', (await home.locator('[data-testid=score]').innerText()).replace(/\s+/g, ' ').trim() === '6–0 V');
    ok('calendrier « Passés » : heure non communiquée signalée (pas inventée)', (await page.locator('.ev .t', { hasText: '—' }).count()) > 0);
    await shot(page, '03-calendrier-passes');
    await page.click('button:has-text("À venir")'); await ready(page, '.ev');

    // fiche du prochain match
    await page.locator('.ev').first().click();
    await page.waitForSelector('text=Joueurs ('); await ready(page, 'tbody tr');
    ok('fiche match : 12 joueurs de l\'effectif', await count(page, 'tbody tr', 12) === 12);
    ok('fiche match : adversaire non modifiable (match officiel)', await page.locator('#m-opp').isDisabled());
    await page.click('button:has-text("Convoquer tout l\'effectif")');
    await page.waitForSelector('text=Tous les joueurs sont convoqués');
    await page.click('button[aria-label^="Présent"] >> nth=0');
    await page.waitForSelector('text=Présent enregistré');
    await page.click('button[aria-label^="Retard"] >> nth=1');
    await page.waitForSelector('text=Retard enregistré');
    await page.check('input[aria-label^="Titulaire"] >> nth=0');
    await page.fill('#m-n', 'Bloc médian, sortie courte');
    await page.click('button:has-text("Enregistrer le match")');
    await page.waitForSelector('text=Match enregistré');
    await shot(page, '04-fiche-match');
    await page.reload(); await ready(page, 'tbody tr');
    ok('persistance : présence « Présent » conservée après rechargement', await page.locator('button[aria-pressed="true"]', { hasText: 'Présent' }).count() === 1);
    ok('persistance : retard conservé', await page.locator('button[aria-pressed="true"]', { hasText: 'Retard' }).count() === 1);
    ok('persistance : composition et notes conservées', (await page.inputValue('#m-n')) === 'Bloc médian, sortie courte' && await page.locator('input[aria-label^="Titulaire"]:checked').count() === 1);
    const evUrl = page.url();
    const evId = evUrl.split('/').pop();

    // effectif : ajout d'un joueur
    await page.click('nav >> text=Effectif'); await page.waitForSelector('h1:has-text("Effectif")'); await ready(page, 'table');
    await page.fill('#p-fn', 'Camille'); await page.fill('#p-ln', 'Demo-Z'); await page.click('button:has-text("Ajouter")');
    await page.waitForSelector('text=Joueur ajouté');
    ok('effectif : joueur ajouté (13 joueurs)', await count(page, 'tbody tr', 13) === 13);
    await shot(page, '05-effectif');

    // nouvel entraînement puis conflit (même équipe, créneau chevauchant)
    await page.click('nav >> text=Calendrier'); await page.waitForSelector('h1:has-text("Calendrier")'); await ready(page, '.ev');
    await page.click('text=+ Nouvel événement');
    const d = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
    await page.fill('#ne-title', 'Entraînement U14'); await page.fill('#ne-date', d); await page.click('button:has-text("Créer")');
    await page.waitForSelector('.ev:has-text("Entraînement U14")');
    ok('calendrier : entraînement créé', true);
    await page.click('text=+ Nouvel événement');
    await page.fill('#ne-title', 'Doublon'); await page.fill('#ne-date', d); await page.fill('#ne-s', '18:30'); await page.fill('#ne-e', '19:00'); await page.click('button:has-text("Créer")');
    await page.waitForSelector('[role=alert]');
    ok('calendrier : conflit d\'équipe refusé avec message clair', /conflit/i.test(await page.locator('[role=alert]').innerText()));
    await shot(page, '06-conflit');

    // un autre club/équipe : fiche d'un match des Seniors inaccessible
    const other = sql(`select e.id from events e join teams t on t.id=e.team_id join categories c on c.id=t.category_id where c.name='Seniors' and t.name='1' limit 1`);
    await page.goto(`${BASE}/#/event/${other}`); await page.reload();
    await page.waitForSelector('.err');
    ok('coach U14 : la fiche d\'un match Seniors est introuvable', /introuvable/i.test(await page.locator('.err').innerText()));

    // méthodologie : brouillons invisibles puis publication par la direction technique
    await page.goto(`${BASE}/#/methodology`); await page.reload(); await page.waitForSelector('h1');
    ok('méthodologie : brouillons non visibles du coach', await page.locator('text=Aucun contenu publié').count() === 1);
    sql(`select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='dt@demo.lieusaint.local'),'email','dt@demo.lieusaint.local')::text, false); set role authenticated; select public.publish_methodology_version(id) from methodology_versions where item_id in (select id from methodology_items where title like 'Philosophie%')`);
    await page.reload(); await page.waitForSelector('section');
    ok('méthodologie : contenu publié visible du coach', await page.locator('text=Position — Possession — Pression').count() > 0);
    await page.click('button:has-text("Lire")');
    await page.click('button:has-text("Copier dans mon espace")');
    await page.waitForSelector('text=Copiée dans votre espace');
    ok('méthodologie : copie personnelle créée (original intact)', sql(`select count(*) from personal_sessions`) === '1');
    await shot(page, '07-methodologie');
    ok('coach : aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
  }

  // ===== Entraîneur Seniors 1 =====
  {
    const { page } = await login(browser, 'coach-seniors1');
    await page.click('nav >> text=Calendrier'); await page.waitForSelector('h1:has-text("Calendrier")'); await ready(page, '.ev');
    const t = await page.locator('.ev strong').allInnerTexts();
    ok('coach Seniors 1 : 29 matchs à venir, tous de son équipe', t.length === 29 && t.every((x) => /Lieusaint Foot AS 1( |$)/.test(x)), `${t.length}`);
    await page.click('nav >> text=Effectif'); await page.waitForSelector('h1:has-text("Effectif")'); await ready(page);
    ok('coach Seniors 1 : ne voit pas les joueurs de U14', await page.locator('text=Demo-A').count() === 0);
  }

  // ===== Direction technique =====
  {
    const { page } = await login(browser, 'dt');
    ok('direction technique : entrée « Administration »', await page.locator('nav >> text=Administration').count() === 1);
    await page.click('nav >> text=Calendrier'); await page.waitForSelector('h1:has-text("Calendrier")'); await ready(page, '.ev');
    await page.selectOption('#team', { label: 'Seniors 1' }); await page.waitForTimeout(400);
    ok('direction technique : voit toutes les équipes (16 dans le sélecteur)', (await page.locator('#team option').count()) === 17);
    await page.click('nav >> text=Administration'); await page.waitForSelector('h1');
    await shot(page, '08-admin-dt');
    // invitation d'un nouvel éducateur U12
    sql(`insert into auth.users (email) values ('nouveau@demo.lieusaint.local') on conflict do nothing`);
    await page.fill('#i-e', 'nouveau@demo.lieusaint.local');
    await page.selectOption('#i-t', { label: 'U12 1' });
    await page.click('button:has-text("Inviter")');
    await page.waitForSelector('[data-testid=invite-link]');
    const link = await page.locator('[data-testid=invite-link]').innerText();
    ok('invitation : lien généré', link.includes('?invite='));
    ok('invitation : jeton non stocké en clair en base', sql(`select count(*) from invitations where encode(token_hash,'hex') = '${link.split('invite=')[1]}'`) === '0');
    await page.click('text=Déconnexion'); await page.waitForSelector('#acc');

    // le nouvel éducateur ouvre le lien
    const ctx2 = await browser.newContext({ locale: 'fr-FR' }); const p2 = await ctx2.newPage();
    await p2.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
    await p2.selectOption('#acc', 'nouveau@demo.lieusaint.local'); await p2.click('text=Entrer');
    await p2.waitForSelector('.card h3');
    ok('invité : après acceptation, voit uniquement U12 1', (await p2.locator('.card h3').allInnerTexts()).join() === 'U12 1');
    await p2.goto(link.replace(/^https?:\/\/[^/]+/, BASE)); await p2.waitForSelector('.card h3');
    ok('invitation à usage unique (rejeu sans effet)', sql(`select count(*) from memberships where user_id=(select id from auth.users where email='nouveau@demo.lieusaint.local')`) === '1');
    await shot(p2, '09-invite-accepte');
  }

  // ===== Méthodologie : direction technique -> éducateurs (versions, publication, diffusion) =====
  {
    const dt = await login(browser, 'dt'); const co = await login(browser, 'coach-u14');
    const card = (page, title) => page.locator('[data-testid=meth-item]', { hasText: title });
    const goMeth = async (page) => { await page.goto(`${BASE}/#/methodology`); await page.reload(); await page.waitForSelector('h1:has-text("Méthodologie")'); await ready(page); };   // rechargement : données fraîches
    await goMeth(dt.page); await goMeth(co.page);
    ok('coach : pas de bouton « Nouveau contenu »', await co.page.locator('text=+ Nouveau contenu').count() === 0);
    await dt.page.click('text=+ Nouveau contenu');
    await dt.page.selectOption('#mk', 'principle'); await dt.page.fill('#mt', 'Pressing après perte');
    await dt.page.fill('#sv-0', 'Presser dans les 5 secondes après la perte.'); await dt.page.fill('#sv-1', 'Fermer l\'axe\nPresser à deux\nRepli si dépassé');
    await dt.page.fill('#mn', 'Création'); await dt.page.click('button:has-text("Enregistrer le brouillon")');
    await dt.page.waitForSelector('text=Brouillon enregistré');
    ok('DT : le contenu apparaît dans les brouillons', await dt.page.locator('h2:has-text("Brouillons")').count() === 1 && await card(dt.page, 'Pressing après perte').count() === 1);
    await shot(dt.page, '13-methodo-brouillon');
    await goMeth(co.page);
    ok('coach : ne voit PAS le brouillon', await card(co.page, 'Pressing après perte').count() === 0);

    // publication
    await card(dt.page, 'Pressing après perte').locator('button:has-text("Lire")').click();
    await dt.page.waitForSelector('button:has-text("Publier")');
    await dt.page.click('button:has-text("Publier") >> nth=0'); await dt.page.click('button:has-text("Oui, publier")');
    await dt.page.waitForSelector('text=publiée : visible de tous les éducateurs');
    await goMeth(co.page);
    ok('coach : voit le contenu publié avec le badge « Nouveau »', await card(co.page, 'Pressing après perte').count() === 1 && await card(co.page, 'Pressing après perte').locator('.badge.off').count() === 1);
    await card(co.page, 'Pressing après perte').locator('button:has-text("Lire")').click();
    await co.page.waitForSelector('text=Presser dans les 5 secondes');
    ok('coach : lit les consignes en liste', await co.page.locator('li', { hasText: 'Fermer l\'axe' }).count() === 1);
    await shot(co.page, '14-methodo-coach-lit');

    // nouvelle version : l'ancienne reste dans l'historique
    await goMeth(dt.page);
    await card(dt.page, 'Pressing après perte').locator('button:has-text("Lire")').click();
    await dt.page.click('button:has-text("Nouvelle version")');
    await dt.page.waitForSelector('#sv-0');
    ok('DT : la nouvelle version est préremplie avec la version publiée', (await dt.page.inputValue('#sv-0')).startsWith('Presser dans les 5 secondes'));
    await dt.page.fill('#sv-0', 'Presser dans les 4 secondes après la perte.'); await dt.page.fill('#mn', 'Délai ramené à 4 s');
    await dt.page.click('button:has-text("Publier pour tous les éducateurs")'); await dt.page.waitForSelector('text=Contenu publié');
    await dt.page.waitForSelector('[data-testid=meth-item] .badge:has-text("v2")', { timeout: 8000 }).catch(() => {});
    ok('DT : la version courante est v2', await card(dt.page, 'Pressing après perte').locator('.badge', { hasText: 'v2' }).count() === 1);
    await card(dt.page, 'Pressing après perte').locator('button:has-text("Historique des versions")').click();
    await dt.page.waitForSelector('table tbody tr');
    ok('DT : historique conservé (v1 et v2) avec la note de modification', await dt.page.locator('table tbody tr').count() === 2 && await dt.page.locator('td', { hasText: 'Délai ramené à 4 s' }).count() === 1);
    await shot(dt.page, '15-methodo-historique');
    await co.page.reload(); await ready(co.page); await goMeth(co.page);
    await card(co.page, 'Pressing après perte').locator('button:has-text("Lire")').click();
    await co.page.waitForSelector('text=4 secondes');
    ok('coach : voit la v2 publiée', await co.page.locator('text=Presser dans les 4 secondes').count() === 1);
    ok('suivi de diffusion : la lecture du coach est enregistrée', sql(`select count(*) from methodology_reads r join methodology_versions v on v.id=r.version_id join methodology_items i on i.id=v.item_id where i.title='Pressing après perte'`) >= '1');
    const vid1 = sql(`select v.id from methodology_versions v join methodology_items i on i.id=v.item_id where i.title='Pressing après perte' and v.version_no=1`);
    const tokCoach = (await (await fetch(`${BASE}/api/auth/dev-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'coach-u14@demo.lieusaint.local' }) })).json()).token;
    const tokDt = (await (await fetch(`${BASE}/api/auth/dev-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'dt@demo.lieusaint.local' }) })).json()).token;
    const post = (path, tok, body) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) });
    ok('API : version publiée non modifiable, même par la direction technique (409)', (await post(`/api/methodology/versions/${vid1}/update`, tokDt, { content: { x: 'y' } })).status === 409);
    ok('API : un coach ne peut pas modifier la méthodologie (409/403)', [403, 409].includes((await post(`/api/methodology/versions/${vid1}/update`, tokCoach, { content: { x: 'y' } })).status));
    ok('API : contenu mal formé refusé (400)', (await post(`/api/methodology/versions/${vid1}/update`, tokDt, { content: [1, 2] })).status === 400);
    ok('coach : aucune erreur JavaScript', co.errors.length === 0 && dt.errors.length === 0, co.errors.concat(dt.errors).join(' | '));
  }

  // ===== Transfert d'un joueur de catégorie =====
  {
    const idOf = (last) => sql(`select id from players where last_name='${last}'`);
    const asUser = (email, q) => sql(`select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='${email}'),'email','${email}')::text, false); set role authenticated; ${q}`).split('\n').pop();
    const demoA = idOf('Demo-A'), demoC = idOf('Demo-C');
    // une observation PRIVÉE du coach U14 sur Demo-A, avant le transfert
    sql(`select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='coach-u14@demo.lieusaint.local'),'email','coach-u14@demo.lieusaint.local')::text, false); set role authenticated; insert into player_observations (club_id, player_id, team_id, author_id, visibility, body) select p.club_id, p.id, h.team_id, auth.uid(), 'private', 'note privée du coach' from players p join player_team_history h on h.player_id=p.id and h.ended_on is null where p.id='${demoA}'`);

    // -- coach principal : seule sa propre équipe -> aucune destination
    const co = await login(browser, 'coach-u14');
    await co.page.click('nav >> text=Effectif'); await ready(co.page, 'tbody tr');
    await co.page.click('button[aria-label^="Transférer Demo-C"]');
    ok('coach principal : aucune destination possible (message explicite, bouton désactivé)', await co.page.locator('text=ne vous permet de transférer vers aucune autre équipe').count() === 1 && await co.page.locator('button:has-text("Confirmer le transfert")').isDisabled());

    // -- responsable de catégorie U14 : uniquement les équipes de SA catégorie
    const re = await login(browser, 'resp-u14');
    await re.page.click('nav >> text=Effectif'); await ready(re.page, 'tbody tr');
    await re.page.click('button[aria-label^="Transférer Demo-C"]');
    const opts = await re.page.locator('#tr-dest option').allInnerTexts();
    ok('responsable U14 : destinations limitées à la catégorie U14', opts.length > 0 && opts.every((o) => o.startsWith('U14')), opts.join(','));
    await re.page.selectOption('#tr-dest', { label: 'U14 2' });
    await re.page.click('button:has-text("Confirmer le transfert")');
    await re.page.waitForSelector('text=est transféré vers U14 2');
    const left = await count(re.page, 'tbody tr', 12);       // 13 joueurs (12 + celui ajouté plus haut) - 1 transféré
    ok('responsable : Demo-C quitte U14 1 (13 -> 12 joueurs)', left === 12, `obtenu ${left}`);
    ok('Demo-C n\'apparaît plus dans l\'effectif de départ', await re.page.locator('td', { hasText: 'Demo-C' }).count() === 0);
    await shot(re.page, '16-transfert');
    const tokRe = (await (await fetch(`${BASE}/api/auth/dev-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'resp-u14@demo.lieusaint.local' }) })).json()).token;
    const u12 = sql(`select t.id from teams t join categories c on c.id=t.category_id where c.name='U12' and t.name='1'`);
    const rr = await fetch(`${BASE}/api/players/${demoA}/transfer`, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${tokRe}` }, body: JSON.stringify({ to_team_id: u12 }) });
    ok('API : le responsable U14 ne peut pas transférer vers U12 (403)', rr.status === 403);
    ok('le joueur est toujours en U14 1 après la tentative refusée', sql(`select count(*) from player_team_history where player_id='${demoA}' and ended_on is null`) === '1');

    // -- direction technique : U14 1 -> U12 1 (changement de catégorie)
    const dt = await login(browser, 'dt');
    await dt.page.click('nav >> text=Effectif'); await dt.page.waitForSelector('#sq-team'); await ready(dt.page);
    await dt.page.selectOption('#sq-team', { label: 'U14 1' }); await ready(dt.page, 'tbody tr');
    await dt.page.click('button[aria-label^="Transférer Demo-A"]');
    await dt.page.selectOption('#tr-dest', { label: 'U12 1' });
    ok('transfert : le texte explique la conservation de l\'historique et des observations privées', await dt.page.locator('text=conservés').count() === 1 && await dt.page.locator('text=restent privées').count() === 1);
    await dt.page.click('button:has-text("Confirmer le transfert")'); await dt.page.waitForSelector('text=est transféré vers U12 1');
    ok('même fiche joueur (1 seule identité) et 2 lignes d\'historique', sql(`select count(*) from players where last_name='Demo-A'`) === '1' && sql(`select count(*) from player_team_history where player_id='${demoA}'`) === '2');
    await dt.page.selectOption('#sq-team', { label: 'U12 1' }); await ready(dt.page, 'tbody tr');
    await dt.page.click('button[aria-label^="Historique de Demo-A"]');
    await dt.page.waitForSelector('text=équipe actuelle');
    ok('historique visible par la direction : U14 1 puis U12 1', await dt.page.locator('text=U14 1 — depuis le').count() === 1 && await dt.page.locator('text=U12 1 — depuis le').count() === 1);
    await shot(dt.page, '17-historique-joueur');

    // -- droits qui suivent le joueur
    ok('ancien coach (U14 1) ne voit plus Demo-A', asUser('coach-u14@demo.lieusaint.local', `select count(*) from players where id='${demoA}'`) === '0');
    ok('nouvel éducateur (U12 1) voit Demo-A', asUser('nouveau@demo.lieusaint.local', `select count(*) from players where id='${demoA}'`) === '1');
    ok('observation PRIVÉE de l\'ancien coach : invisible du nouvel éducateur', asUser('nouveau@demo.lieusaint.local', `select count(*) from player_observations`) === '0');
    ok('observation privée : toujours lisible par son auteur', asUser('coach-u14@demo.lieusaint.local', `select count(*) from player_observations`) === '1');
    ok('observation privée : invisible même de la direction technique', asUser('dt@demo.lieusaint.local', `select count(*) from player_observations`) === '0');
    ok('le transfert est tracé dans le journal d\'audit', Number(sql(`select count(*) from audit_log where table_name='player_team_history' and action='UPDATE'`)) >= 2);
  }

  // ===== Compte sans rôle =====
  {
    const { page } = await login(browser, 'inconnu');
    ok('compte sans rôle : message explicite, aucune donnée', await page.locator('text=pas encore de rôle').count() === 1 && await page.locator('.card h3').count() === 0);
  }

  // ===== API : accès sans jeton / jeton falsifié =====
  const r1 = await fetch(`${BASE}/api/teams`); ok('API : refuse sans jeton (401)', r1.status === 401);
  const r2 = await fetch(`${BASE}/api/teams`, { headers: { Authorization: 'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.' } }); ok('API : refuse un jeton « alg none » (401)', r2.status === 401);

  await browser.close();
  console.log(`\nBilan e2e : ${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
