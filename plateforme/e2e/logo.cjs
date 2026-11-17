const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1100, height: 520 }, locale: 'fr-FR' }); const p = await c.newPage();
  await p.goto('http://localhost:8787'); await p.waitForSelector('#acc');
  console.log('logo connexion chargé:', await p.evaluate(() => { const i = document.querySelector('img.logo'); return i.complete && i.naturalWidth > 0; }));
  await p.screenshot({ path: 'shots/11-connexion.png' });
  await p.selectOption('#acc', 'dt@demo.lieusaint.local'); await p.click('text=Entrer'); await p.waitForSelector('header.top');
  console.log('logo en-tête chargé:', await p.evaluate(() => { const i = document.querySelector('header img.logo'); return i.complete && i.naturalWidth > 0; }));
  await p.screenshot({ path: 'shots/12-accueil-dt.png' }); await b.close();
})();
