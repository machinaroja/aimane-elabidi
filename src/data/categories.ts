export type CategorySlug = 'psychologie' | 'developpement-personnel' | 'argent' | 'pouvoir-et-influence';

export interface Category {
  slug: CategorySlug;
  name: string;
  /** Une phrase qui dit ce que le rayon apporte au lecteur. */
  summary: string;
  /** Motif géométrique propre au rayon, utilisé sur les couvertures. */
  emblem: 'rings' | 'steps' | 'coin' | 'column';
}

export const categories: Category[] = [
  {
    slug: 'psychologie',
    name: 'Psychologie',
    summary: 'Comprendre ce qui se passe dans la tête — la vôtre et celle des autres.',
    emblem: 'rings',
  },
  {
    slug: 'developpement-personnel',
    name: 'Développement personnel',
    summary: 'Des méthodes concrètes pour changer une habitude, une routine, une trajectoire.',
    emblem: 'steps',
  },
  {
    slug: 'argent',
    name: 'Argent',
    summary: 'Gagner, épargner, investir : les mécanismes expliqués sans jargon.',
    emblem: 'coin',
  },
  {
    slug: 'pouvoir-et-influence',
    name: 'Pouvoir et influence',
    summary: 'Négocier, convaincre, décoder les rapports de force.',
    emblem: 'column',
  },
];

export const categoryBySlug = (slug: CategorySlug) => {
  const category = categories.find((c) => c.slug === slug);
  if (!category) throw new Error(`Catégorie inconnue : ${slug}`);
  return category;
};
