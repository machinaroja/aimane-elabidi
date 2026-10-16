// Analyse le thème Shopify avec les règles officielles (Theme Check).
import { themeCheckRun } from '@shopify/theme-check-node';
import path from 'node:path';

const root = path.resolve('shopify-theme');
const { offenses } = await themeCheckRun(root, undefined, () => {});
const sev = ['erreur', 'avertissement', 'info'];
for (const o of offenses) {
  const file = o.uri.replace(`file://${root}/`, '');
  console.log(`[${sev[o.severity] ?? o.severity}] ${o.check} ${file}:${o.start.line + 1} ${o.message}`);
}
console.log(`${offenses.length} remarque(s)`);
process.exit(offenses.some((o) => o.severity === 0) ? 1 : 0);
