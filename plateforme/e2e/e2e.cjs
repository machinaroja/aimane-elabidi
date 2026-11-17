// Test de bout en bout : vrai navigateur (Chromium) -> interface -> passerelle -> PostgreSQL (RLS).
const { chromium } = require('playwright');
const { execSync } = require('node:child_process');
const BASE = process.env.BASE || 'http://localhost:8787';
const DB = process.env.PGDATABASE || 'lieusaint_dev';
const sql = (q) => execSync(`psql -X -At -d ${DB} -c "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
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
