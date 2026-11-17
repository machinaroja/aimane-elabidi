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
    ok('coach : voit son équipe U14 1 sur l\'accueil', await page.locator('.grid .card h3', { hasText: 'U14 1' }).count() === 1);
    ok('coach : ne voit aucune autre équipe', await page.locator('.grid .card h3').count() === 1);
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

    // méthodologie : les contenus publiés sont visibles, les brouillons non
    await page.goto(`${BASE}/#/methodology`); await page.reload(); await page.waitForSelector('h1'); await ready(page);
    ok('méthodologie : brouillons (orientations par âge) non visibles du coach', await page.locator('text=Orientations U14').count() === 0 && await page.locator('text=Brouillon').count() === 0);
    ok('méthodologie : contenu publié visible du coach', await page.locator('text=Position — Possession — Pression').count() > 0);
    await page.locator('[data-testid=meth-item]', { hasText: 'Séance de référence' }).locator('button:has-text("Lire")').click();
    await page.locator('[data-testid=meth-item]', { hasText: 'Séance de référence' }).locator('button:has-text("Copier dans mon espace")').click();
    await page.waitForSelector('text=Copiée dans votre espace');
    ok('méthodologie : copie personnelle créée (original intact)', sql(`select count(*) from personal_sessions`) === '2');
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
    await p2.waitForSelector('.grid .card h3');
    ok('invité : après acceptation, voit uniquement U12 1', (await p2.locator('.grid .card h3').allInnerTexts()).join() === 'U12 1');
    await p2.goto(link.replace(/^https?:\/\/[^/]+/, BASE)); await p2.waitForSelector('.grid .card h3');
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
    await dt.page.selectOption('#mk', 'principle'); await dt.page.fill('#mt', 'Jeu sans ballon : démarquage');
    await dt.page.fill('#sv-0', 'Se démarquer avant la réception.'); await dt.page.fill('#sv-1', 'Regarder avant de recevoir\nOffrir un angle de passe\nChanger de rythme');
    await dt.page.fill('#mn', 'Création'); await dt.page.click('button:has-text("Enregistrer le brouillon")');
    await dt.page.waitForSelector('text=Brouillon enregistré');
    ok('DT : le contenu apparaît dans les brouillons', await dt.page.locator('h2:has-text("Brouillons")').count() === 1 && await card(dt.page, 'Jeu sans ballon : démarquage').count() === 1);
    await shot(dt.page, '13-methodo-brouillon');
    await goMeth(co.page);
    ok('coach : ne voit PAS le brouillon', await card(co.page, 'Jeu sans ballon : démarquage').count() === 0);

    // publication
    await card(dt.page, 'Jeu sans ballon : démarquage').locator('button:has-text("Lire")').click();
    await dt.page.waitForSelector('button:has-text("Publier")');
    await dt.page.click('button:has-text("Publier") >> nth=0'); await dt.page.click('button:has-text("Oui, publier")');
    await dt.page.waitForSelector('text=publiée : visible de tous les éducateurs');
    await goMeth(co.page);
    ok('coach : voit le contenu publié avec le badge « Nouveau »', await card(co.page, 'Jeu sans ballon : démarquage').count() === 1 && await card(co.page, 'Jeu sans ballon : démarquage').locator('.badge.off').count() === 1);
    await card(co.page, 'Jeu sans ballon : démarquage').locator('button:has-text("Lire")').click();
    await co.page.waitForSelector('text=Se démarquer avant la réception');
    ok('coach : lit les consignes en liste', await co.page.locator('li', { hasText: 'Offrir un angle de passe' }).count() === 1);
    await shot(co.page, '14-methodo-coach-lit');

    // nouvelle version : l'ancienne reste dans l'historique
    await goMeth(dt.page);
    await card(dt.page, 'Jeu sans ballon : démarquage').locator('button:has-text("Lire")').click();
    await dt.page.click('button:has-text("Nouvelle version")');
    await dt.page.waitForSelector('#sv-0');
    ok('DT : la nouvelle version est préremplie avec la version publiée', (await dt.page.inputValue('#sv-0')).startsWith('Se démarquer avant la réception'));
    await dt.page.fill('#sv-0', 'Se démarquer avant la réception, dos au jeu interdit.'); await dt.page.fill('#mn', 'Précision : dos au jeu interdit');
    await dt.page.click('button:has-text("Publier pour tous les éducateurs")'); await dt.page.waitForSelector('text=Contenu publié');
    await dt.page.waitForSelector('[data-testid=meth-item] .badge:has-text("v2")', { timeout: 8000 }).catch(() => {});
    ok('DT : la version courante est v2', await card(dt.page, 'Jeu sans ballon : démarquage').locator('.badge', { hasText: 'v2' }).count() === 1);
    await card(dt.page, 'Jeu sans ballon : démarquage').locator('button:has-text("Historique des versions")').click();
    await dt.page.waitForSelector('table tbody tr');
    ok('DT : historique conservé (v1 et v2) avec la note de modification', await dt.page.locator('table tbody tr').count() === 2 && await dt.page.locator('td', { hasText: 'Précision : dos au jeu interdit' }).count() === 1);
    await shot(dt.page, '15-methodo-historique');
    await co.page.reload(); await ready(co.page); await goMeth(co.page);
    await card(co.page, 'Jeu sans ballon : démarquage').locator('button:has-text("Lire")').click();
    await co.page.waitForSelector('text=dos au jeu interdit');
    ok('coach : voit la v2 publiée', await co.page.locator('pre.body', { hasText: 'dos au jeu interdit' }).count() === 1);
    ok('suivi de diffusion : la lecture du coach est enregistrée', sql(`select count(*) from methodology_reads r join methodology_versions v on v.id=r.version_id join methodology_items i on i.id=v.item_id where i.title='Jeu sans ballon : démarquage'`) >= '1');
    const vid1 = sql(`select v.id from methodology_versions v join methodology_items i on i.id=v.item_id where i.title='Jeu sans ballon : démarquage' and v.version_no=1`);
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

  // ===== Tableau de bord de la direction technique =====
  {
    const tokOf = async (who) => (await (await fetch(`${BASE}/api/auth/dev-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${who}@demo.lieusaint.local` }) })).json()).token;
    const fmtPct = (n, d) => (d ? `${String(Math.round((1000 * n) / d) / 10).replace('.', ',')} %` : '—');
    const kpi = async (page, label) => (await page.locator('.kpi', { hasText: label }).first().locator('.n').innerText()).trim();

    // nom d'affichage : renseigné par l'éducateur lui-même
    const nv = await login(browser, 'nouveau');
    await nv.page.fill('#pn', 'Nouvel Éducateur Démo'); await nv.page.click('button:has-text("Enregistrer")');
    await nv.page.waitForSelector('h1:has-text("Nouvel Éducateur Démo")');
    ok('profil : l\'éducateur renseigne son nom, affiché dans l\'en-tête', (await nv.page.locator('[data-testid=who]').innerText()).includes('Nouvel Éducateur Démo'));
    ok('éducateur sans droit de rapport : pas d\'entrée « Tableau de bord »', await nv.page.locator('nav >> text=Tableau de bord').count() === 0);

    // coach : aucun accès, ni par le menu ni par l'API
    const co = await login(browser, 'coach-u14');
    ok('coach : pas d\'entrée « Tableau de bord »', await co.page.locator('nav >> text=Tableau de bord').count() === 0);
    await co.page.goto(`${BASE}/#/dashboard`); await co.page.reload();
    await co.page.waitForSelector('.err');
    ok('coach : accès direct à la page refusé', /réservé à la direction/.test(await co.page.locator('.err').innerText()));
    ok('API : le tableau de bord est refusé à un coach (403)', (await fetch(`${BASE}/api/dashboard?period=season`, { headers: { Authorization: `Bearer ${await tokOf('coach-u14')}` } })).status === 403);
    ok('API : refusé à un compte sans rôle (403)', (await fetch(`${BASE}/api/dashboard?period=season`, { headers: { Authorization: `Bearer ${await tokOf('inconnu')}` } })).status === 403);

    // direction technique
    const dt = await login(browser, 'dt');
    await dt.page.click('nav >> text=Tableau de bord'); await dt.page.waitForSelector('.kpis'); await ready(dt.page);
    await shot(dt.page, '18-dashboard');
    const sqlN = (q) => Number(sql(q));
    // contrôles croisés : chaque chiffre affiché est recalculé par une requête SQL indépendante
    ok('KPI équipes = 16', await kpi(dt.page, 'Équipes') === '16');
    ok('KPI joueurs = joueurs actuellement rattachés à une équipe', Number(await kpi(dt.page, 'Joueurs')) === sqlN(`select count(*) from player_team_history where ended_on is null`));
    ok('KPI éducateurs = rôles équipe/catégorie actifs', Number(await kpi(dt.page, 'Éducateurs')) === sqlN(`select count(*) from memberships m join club_roles r on r.club_id=m.club_id and r.key=m.role_key where m.status='active' and r.scope_level in ('team','category')`));
    const held = sqlN(`select count(*) from events where kind='training' and status='scheduled' and starts_at < now()`);
    ok('KPI entraînements tenus = entraînements passés non annulés', Number(await kpi(dt.page, 'Entraînements tenus')) === held, `${held}`);
    const pn = sqlN(`select count(*) from attendance_records a join events e on e.id=a.event_id where e.kind='training' and a.status in ('present','late')`), pd = sqlN(`select count(*) from attendance_records a join events e on e.id=a.event_id where e.kind='training'`);
    ok('KPI participation recalculée indépendamment', await kpi(dt.page, 'Participation') === fmtPct(pn, pd), `${await kpi(dt.page, 'Participation')} vs ${fmtPct(pn, pd)}`);
    const played = sqlN(`select count(*) from match_details d join events e on e.id=d.event_id where d.status='played' and e.status='scheduled'`);
    ok('KPI matchs joués = matchs avec score (officiels compris)', Number(await kpi(dt.page, 'Matchs joués')) === played, `${played}`);

    const row = (t) => dt.page.locator('[data-testid=team-row]', { hasText: t });
    const covU14 = sqlN(`select count(*) from events e where e.kind='training' and e.status='scheduled' and e.starts_at<now() and e.team_id=(select t.id from teams t join categories c on c.id=t.category_id where c.name='U14' and t.name='1') and exists (select 1 from attendance_records a where a.event_id=e.id)`);
    const heldU14 = sqlN(`select count(*) from events e where e.kind='training' and e.status='scheduled' and e.starts_at<now() and e.team_id=(select t.id from teams t join categories c on c.id=t.category_id where c.name='U14' and t.name='1')`);
    ok('ligne U14 1 : couverture des présences recalculée', (await row('U14 1').first().innerText()).includes(fmtPct(covU14, heldU14)), await row('U14 1').first().innerText());
    ok('ligne Seniors 1 : couverture 0 % (aucune présence saisie)', /0 %/.test(await row('Seniors 1').first().innerText()));
    ok('ligne U14 1 : éducateurs nommés (responsable, coach, adjoint)', /Coach U14 Démo/.test(await row('U14 1').first().innerText()) && /Adjoint U14 Démo/.test(await row('U14 1').first().innerText()));
    ok('équipes sans éducateur signalées « aucun attribué »', await dt.page.locator('[data-testid=team-row]', { hasText: 'Seniors 10' }).locator('text=aucun attribué').count() === 1);

    // points d'attention : règle affichée, formulation de piste à vérifier
    const flags = await dt.page.locator('[data-testid=flag]').allInnerTexts();
    ok('point d\'attention : présences peu saisies (Seniors 1) avec la règle affichée', flags.some((f) => /Seniors 1/.test(f) && /Règle :/.test(f) && /couverture des présences < 60 %/.test(f)));
    const nPub = sqlN(`select count(*) from methodology_items where status='published'`);
    ok('point d\'attention : méthodologie peu ouverte (Coach Seniors 1 Démo : 1 contenu sur ' + nPub + ')', flags.some((f) => /Coach Seniors 1 Démo/.test(f) && f.includes(`1 contenu(s) ouvert(s) sur ${nPub}`)));
    ok('le coach U14 (3/3 lus) n\'est PAS signalé', !flags.some((f) => /Coach U14 Démo/.test(f) && /ouvert/.test(f)));
    ok('formulation prudente affichée (pistes à vérifier, pas des constats)', await dt.page.locator('text=pistes à vérifier').count() === 1);
    ok('limites affichées : « Pas encore suivi » (objectifs, évaluations, thèmes, besoins de formation)', await dt.page.locator('h2:has-text("Pas encore suivi")').count() === 1 && await dt.page.locator('text=Évaluations collectives').count() === 1);
    ok('aucun jugement de valeur automatique (« mauvais », « insuffisant », « faute »)', !/mauvais|insuffisant|faute|incompétent/i.test(await dt.page.locator('main').innerText()));
    ok('éducateur nouvellement nommé visible avec son nom', await dt.page.locator('[data-testid=educ-row]', { hasText: 'Nouvel Éducateur Démo' }).count() === 1);

    // filtre de catégorie
    await dt.page.selectOption('#d-c', { label: 'U14' }); await count(dt.page, '[data-testid=team-row]', 3);
    ok('filtre U14 : 3 équipes uniquement', await dt.page.locator('[data-testid=team-row]').count() === 3 && await dt.page.locator('[data-testid=team-row]', { hasText: 'Seniors' }).count() === 0);
    ok('filtre U14 : seuls les éducateurs de U14 (le coach Seniors 1 disparaît)', await dt.page.locator('[data-testid=educ-row]', { hasText: 'Coach Seniors 1' }).count() === 0 && await dt.page.locator('[data-testid=educ-row]', { hasText: 'Coach U14' }).count() === 1);
    await dt.page.selectOption('#d-c', { label: 'Toutes' });

    // période : mois courant, recalculé indépendamment (heure de Paris)
    const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    await dt.page.click('button:has-text("Mois")'); await dt.page.waitForFunction((l) => document.body.innerText.toLowerCase().includes('période : ' + l), monthLabel); await dt.page.waitForSelector('.kpis');
    const heldM = sqlN(`select count(*) from events where kind='training' and status='scheduled' and starts_at < now() and starts_at >= date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' and starts_at < (date_trunc('month', now() at time zone 'Europe/Paris') + interval '1 month') at time zone 'Europe/Paris'`);
    ok('période « mois » : entraînements tenus recalculés', Number(await kpi(dt.page, 'Entraînements tenus')) === heldM, `${heldM}`);
    await dt.page.fill('#d-m', '2026-08'); await dt.page.waitForFunction(() => document.body.innerText.toLowerCase().includes('période : août 2026')); await dt.page.waitForSelector('.kpis');
    ok('période « août 2026 » : aucune donnée, aucun chiffre inventé', await kpi(dt.page, 'Entraînements tenus') === '0' && await kpi(dt.page, 'Participation') === '—');
    await dt.page.click('button:has-text("Trimestre")'); await dt.page.waitForSelector('#d-q'); await dt.page.waitForFunction(() => /période : \d(er|e) trimestre/i.test(document.body.innerText)); await dt.page.waitForSelector('.kpis');
    ok('période « trimestre » : sélection disponible', await dt.page.locator('#d-q option').count() === 12);
    await dt.page.click('button:has-text("Saison")'); await dt.page.waitForFunction(() => document.body.innerText.toLowerCase().includes('période : saison')); await dt.page.waitForSelector('.kpis');

    // rapport : CSV et impression journalisés ; anti-injection de formules
    sql(`update profiles set display_name = '=1+1 Coach piégé' where id = (select id from auth.users where email='coach-seniors1@demo.lieusaint.local')`);
    await dt.page.reload(); await dt.page.waitForSelector('.kpis');
    await dt.page.click('.seg button:has-text("Rapport")');
    ok('rapport : titre, période et date de génération', await dt.page.locator('text=Rapport de la direction technique').count() === 1 && await dt.page.locator('text=généré le').count() === 1);
    const before = sqlN(`select count(*) from audit_log where table_name='reports' and action='EXPORT'`);
    const [dl] = await Promise.all([dt.page.waitForEvent('download'), dt.page.click('button:has-text("Exporter en CSV")')]);
    const csv = require('node:fs').readFileSync(await dl.path(), 'utf8');
    ok('CSV : en-têtes et lignes équipes / éducateurs / points d\'attention', /ÉQUIPES/.test(csv) && /ÉDUCATEURS/.test(csv) && /POINTS D'ATTENTION/.test(csv) && /"U14";"1"/.test(csv));
    ok('CSV : séparateur « ; » et BOM (ouverture directe dans Excel en français)', csv.charCodeAt(0) === 0xfeff && csv.includes(';'));
    ok('CSV : une formule dans un nom est neutralisée (apostrophe)', csv.includes(`"'=1+1 Coach piégé"`) && !csv.includes(`"=1+1 Coach piégé"`));
    ok('CSV : aucun e-mail d\'éducateur ni aucun nom de joueur exporté', !/@demo\.lieusaint\.local/.test(csv) && !/Demo-[A-Z]/.test(csv));
    ok('export CSV journalisé dans l\'audit', sqlN(`select count(*) from audit_log where table_name='reports' and action='EXPORT'`) === before + 1);
    await dt.page.evaluate(() => { window.print = () => {}; });
    await dt.page.click('button:has-text("Imprimer")'); await dt.page.waitForSelector('text=Impression consignée');
    ok('impression journalisée dans l\'audit', sqlN(`select count(*) from audit_log where table_name='reports' and action='EXPORT'`) === before + 2);
    await shot(dt.page, '19-rapport');

    // responsable de catégorie : sa catégorie seulement, pas d'export
    const re = await login(browser, 'resp-u14');
    await re.page.click('nav >> text=Tableau de bord'); await re.page.waitForSelector('.kpis'); await ready(re.page);
    ok('responsable : bandeau « votre catégorie uniquement »', await re.page.locator('text=votre catégorie').first().count() > 0);
    const reTeams = await re.page.locator('[data-testid=team-row]').allInnerTexts();
    ok('responsable : uniquement les équipes U14', reTeams.length === 3 && reTeams.every((t) => /^U14/.test(t)), reTeams.map((t) => t.slice(0, 8)).join('|'));
    ok('responsable : statistiques de lecture de la méthodologie non visibles', await re.page.locator('text=non visible').count() > 0 && await re.page.locator('[data-testid=flag]', { hasText: 'ouvert' }).count() === 0);
    await re.page.click('.seg button:has-text("Rapport")');
    ok('responsable : le rapport s\'intitule « de catégorie » et n\'annonce pas « toutes catégories »', await re.page.locator('h2:has-text("Rapport de catégorie")').count() === 1 && await re.page.locator('text=toutes catégories').count() === 0 && await re.page.locator('text=catégorie(s) : U14').count() === 1);
    ok('responsable : pas de bouton d\'export', await re.page.locator('button:has-text("Exporter en CSV")').count() === 0);
    ok('API : le responsable ne peut pas journaliser/faire d\'export (403)', (await fetch(`${BASE}/api/reports/export-log`, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${await tokOf('resp-u14')}` }, body: JSON.stringify({ club_id: sql(`select id from clubs limit 1`), label: 'x' }) })).status === 403);
    await shot(re.page, '20-dashboard-responsable');
    ok('dashboard : aucune erreur JavaScript', dt.errors.length === 0 && re.errors.length === 0 && co.errors.length === 0, dt.errors.concat(re.errors).join(' | '));
  }

  // ===== Réponses périmées (changement rapide de filtre) =====
  {
    let okStale = true; try { execSync(`node ${__dirname}/stale.cjs`, { env: { ...process.env, NODE_PATH: process.env.NODE_PATH }, stdio: 'pipe' }); } catch { okStale = false; }
    ok('tableau de bord : une réponse arrivée en retard n\'écrase pas la période choisie', okStale);
  }

  // ===== Compte sans rôle =====
  {
    const { page } = await login(browser, 'inconnu');
    ok('compte sans rôle : message explicite, aucune donnée', await page.locator('text=pas encore de rôle').count() === 1 && await page.locator('.grid .card h3').count() === 0);
  }

  // ===== API : accès sans jeton / jeton falsifié =====
  const r1 = await fetch(`${BASE}/api/teams`); ok('API : refuse sans jeton (401)', r1.status === 401);
  const r2 = await fetch(`${BASE}/api/teams`, { headers: { Authorization: 'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.' } }); ok('API : refuse un jeton « alg none » (401)', r2.status === 401);

  await browser.close();
  console.log(`\nBilan e2e : ${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
