import { chromium } from '@playwright/test';
const out = process.argv[2];
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport: vp, reducedMotion: 'reduce' });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${out}/${name}-fold.png` });
  await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(name, 'overflow:', overflow, 'errors:', errors);
  await page.close();
}
await browser.close();
