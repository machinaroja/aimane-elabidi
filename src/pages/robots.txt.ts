import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      'User-agent: *',
      'Disallow: /panier/',
      'Disallow: /compte/',
      'Disallow: /commande/',
      '',
      `Sitemap: ${new URL('sitemap-index.xml', site).href}`,
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
