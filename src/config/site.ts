export const SITE = {
  name: 'BIBLIODOR',
  /** URL de production, à définir via la variable PUBLIC_SITE_URL. */
  url: import.meta.env.PUBLIC_SITE_URL ?? 'https://www.bibliodor.fr',
  locale: 'fr_FR',
  description:
    'BIBLIODOR, maison d’édition numérique : des ebooks en français sur la psychologie, le développement personnel, l’argent, le pouvoir et l’influence.',
  /** Affiche un bandeau tant que le catalogue contient des titres d'exemple. */
  demoCatalog: true,
};

export const NAV = [
  { href: '/catalogue/', label: 'Catalogue' },
  { href: '/categories/', label: 'Catégories' },
  { href: '/a-propos/', label: 'La maison' },
  { href: '/faq/', label: 'Questions' },
];
