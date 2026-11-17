// Réponses périmées : la 1re requête (saison) est retardée ; on passe à « Mois » entre-temps.
// L'écran doit finir sur le MOIS, jamais sur la saison arrivée en retard.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8787';
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ locale: 'fr-FR', viewport: { width: 1100, height: 900 } }); const p = await c.newPage();
  await p.goto(BASE); await p.selectOption('#acc', 'dt@demo.lieusaint.local'); await p.click('text=Entrer'); await p.waitForSelector('header.top');
  let first = true;
  await p.route('**/api/dashboard*', async (route) => { if (first && route.request().url().includes('period=season')) { first = false; await new Promise((r) => setTimeout(r, 1500)); } await route.continue(); });
  await p.click('nav >> text=Tableau de bord');           // lance la requête « saison » (retardée)
  await p.waitForSelector('text=Chargement…');
  await p.click('button:has-text("Mois")');                 // lance la requête « mois » (rapide)
  await p.waitForFunction(() => /période : \p{L}+ \d{4}/u.test(document.body.innerText.toLowerCase()) && !document.body.innerText.toLowerCase().includes('période : saison'));
  await p.waitForTimeout(2200);                             // la réponse « saison » arrive maintenant, en retard
  const label = (await p.locator('text=/Période :/').first().innerText()).toLowerCase();
  const ok = !label.includes('saison');
  console.log(ok ? '✔ réponse périmée ignorée : l\'écran reste sur le mois choisi' : `❌ l'écran affiche « ${label} » alors que « Mois » est sélectionné`);
  await b.close(); process.exit(ok ? 0 : 1);
})();
