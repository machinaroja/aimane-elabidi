const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const p = await c.newPage();
  await p.goto('http://localhost:8787'); await p.selectOption('#acc', 'coach-u14@demo.lieusaint.local'); await p.click('text=Entrer');
  await p.waitForSelector('header.top'); await p.click('nav >> text=Calendrier'); await p.waitForSelector('h1:has-text("Calendrier")');
  await p.waitForSelector('text=Chargement…', { state: 'detached' }); await p.locator('.ev').first().click();
  await p.waitForSelector('text=Joueurs ('); await p.waitForSelector('text=Chargement…', { state: 'detached' });
  await p.waitForSelector('tbody tr');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log('débordement horizontal (mobile):', overflow, ' largeur contenu', await p.evaluate(() => document.documentElement.scrollWidth), '/', await p.evaluate(() => innerWidth));
  await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: 'shots/10-mobile-fiche.png' });
  await b.close();
})();
