// Test rapide : ajout au panier depuis l'accueil et mise à jour du compteur.
import { chromium } from '@playwright/test';
const base = process.env.BASE_URL ?? 'http://localhost:4321';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
await page.goto(base + '/');
const btn = page.locator('[data-add-to-cart]').first();
await btn.click();
const count = await page.locator('.cart-count').first().textContent();
const label = await btn.textContent();
const status = await page.locator('#cart-status').textContent();
await page.reload();
const after = await page.locator('.cart-count').first().textContent();
await btn.click();
const url = page.url();
console.log({ count, label: label.trim(), status, afterReload: after, navigatedTo: url });
const ok = count === '1' && after === '1' && url.endsWith('/panier/');
await browser.close();
process.exit(ok ? 0 : 1);
