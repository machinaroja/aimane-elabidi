import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Pages privées ou transactionnelles, exclues du sitemap (et marquées noindex).
const PRIVATE = ['/panier/', '/compte/', '/commande/'];

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://www.bibliodor.fr',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !PRIVATE.some((p) => new URL(page).pathname.startsWith(p)),
    }),
  ],
});
