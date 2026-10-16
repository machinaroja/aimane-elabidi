/*
  CATALOGUE D'EXEMPLE.
  Ces titres servent à concevoir et tester le site. Ils doivent être remplacés
  par le vrai catalogue BIBLIODOR (titres, auteurs, prix, sommaires) avant
  toute mise en ligne. Tant que SITE.demoCatalog vaut true, un bandeau
  l'indique aux visiteurs.
*/
import type { CategorySlug } from './categories';

export type CoverTone = 'forest' | 'cream' | 'gold';

export interface Book {
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  category: CategorySlug;
  /** Prix TTC en centimes d'euro. */
  priceCents: number;
  pages: number;
  formats: ('EPUB' | 'PDF')[];
  /** Date de parution, AAAA-MM-JJ. */
  publishedAt: string;
  /** Accroche courte, utilisée sur les cartes et en meta description. */
  pitch: string;
  /** Ce que le lecteur saura faire ou comprendre après lecture. */
  takeaways: string[];
  contents: string[];
  coverTone: CoverTone;
  featured?: boolean;
}

export const books: Book[] = [
  {
    slug: 'les-biais-qui-decident-pour-nous',
    title: 'Les biais qui décident pour nous',
    subtitle: 'Repérer les raccourcis de la pensée avant qu’ils ne coûtent cher',
    author: 'Rédaction BIBLIODOR',
    category: 'psychologie',
    priceCents: 1490,
    pages: 168,
    formats: ['EPUB', 'PDF'],
    publishedAt: '2026-09-22',
    pitch: 'Vingt biais cognitifs expliqués par des situations du quotidien, et la façon de les contourner.',
    takeaways: [
      'Reconnaître les vingt biais qui pèsent le plus sur vos décisions d’argent, de travail et de couple.',
      'Appliquer une routine de vérification en trois questions avant un choix important.',
      'Distinguer une intuition fiable d’une impression trompeuse.',
    ],
    contents: [
      'Pourquoi le cerveau prend des raccourcis',
      'Les biais de confirmation et d’ancrage',
      'L’aversion à la perte',
      'Les biais sociaux : conformité et autorité',
      'Décider mieux : une méthode en trois questions',
    ],
    coverTone: 'forest',
    featured: true,
  },
  {
    slug: 'lire-les-emotions',
    title: 'Lire les émotions',
    subtitle: 'Ce que le visage, la voix et les silences disent vraiment',
    author: 'Rédaction BIBLIODOR',
    category: 'psychologie',
    priceCents: 1290,
    pages: 142,
    formats: ['EPUB', 'PDF'],
    publishedAt: '2026-07-08',
    pitch: 'Un guide clair pour mieux comprendre les autres sans tomber dans les mythes du « langage du corps ».',
    takeaways: [
      'Identifier les signaux émotionnels les plus fiables, et ceux qui ne le sont pas.',
      'Poser les questions qui désamorcent un malentendu.',
      'Mieux comprendre vos propres réactions sous la pression.',
    ],
    contents: [
      'Ce que la recherche sait — et ne sait pas',
      'Le visage et la voix',
      'Les émotions difficiles : colère, honte, peur',
      'Écouter pour comprendre',
    ],
    coverTone: 'cream',
  },
  {
    slug: 'l-attention-retrouvee',
    title: 'L’attention retrouvée',
    subtitle: 'Travailler profondément dans un monde de notifications',
    author: 'Rédaction BIBLIODOR',
    category: 'developpement-personnel',
    priceCents: 1290,
    pages: 154,
    formats: ['EPUB', 'PDF'],
    publishedAt: '2026-10-06',
    pitch: 'Une méthode progressive sur quatre semaines pour reprendre la main sur votre concentration.',
    takeaways: [
      'Mesurer où part réellement votre attention dans une journée.',
      'Construire des plages de travail profond qui tiennent dans un agenda chargé.',
      'Réduire les interruptions sans vous couper des autres.',
    ],
    contents: [
      'Semaine 1 : observer',
      'Semaine 2 : protéger',
      'Semaine 3 : approfondir',
      'Semaine 4 : durer',
    ],
    coverTone: 'gold',
    featured: true,
  },
  {
    slug: 'les-habitudes-qui-tiennent',
    title: 'Les habitudes qui tiennent',
    subtitle: 'Changer une routine sans compter sur la volonté',
    author: 'Rédaction BIBLIODOR',
    category: 'developpement-personnel',
    priceCents: 990,
    pages: 118,
    formats: ['EPUB', 'PDF'],
    publishedAt: '2026-05-14',
    pitch: 'Pourquoi les bonnes résolutions échouent, et comment construire une habitude qui dure.',
    takeaways: [
      'Comprendre la boucle signal, routine, récompense.',
      'Concevoir un environnement qui rend l’habitude évidente.',
      'Reprendre après un écart sans tout abandonner.',
    ],
    contents: [
      'La mécanique d’une habitude',
      'Rendre le bon choix facile',
      'Suivre ses progrès simplement',
      'Quand ça ne marche pas',
    ],
    coverTone: 'cream',
  },
  {
    slug: 'premier-budget-premier-patrimoine',
    title: 'Premier budget, premier patrimoine',
    subtitle: 'Organiser son argent quand on part de zéro',
    author: 'Rédaction BIBLIODOR',
    category: 'argent',
    priceCents: 1490,
    pages: 176,
    formats: ['EPUB', 'PDF'],
    publishedAt: '2026-08-27',
    pitch: 'Budget, épargne de précaution, premiers placements : un parcours pas à pas adapté au contexte français.',
    takeaways: [
      'Établir un budget réaliste en une soirée.',
      'Constituer une épargne de précaution adaptée à votre situation.',
      'Comprendre les enveloppes françaises : livrets, assurance vie, PEA.',
    ],
    contents: [
      'Faire le point sans culpabiliser',
      'Le budget en quatre comptes',
      'L’épargne de précaution',
      'Les enveloppes d’investissement',
      'Les erreurs les plus coûteuses',
    ],
    coverTone: 'forest',
  },
  {
    slug: 'comprendre-les-interets-composes',
    title: 'Comprendre les intérêts composés',
    subtitle: 'Le temps, premier allié de l’épargnant',
    author: 'Rédaction BIBLIODOR',
    category: 'argent',
    priceCents: 790,
    pages: 84,
    formats: ['EPUB', 'PDF'],
    publishedAt: '2026-04-02',
    pitch: 'Un court livre pour enfin saisir pourquoi commencer tôt change tout, chiffres à l’appui.',
    takeaways: [
      'Calculer l’effet du temps sur une épargne régulière.',
      'Comprendre l’impact réel des frais sur le long terme.',
      'Lire un tableau de rendement sans se faire piéger.',
    ],
    contents: ['Le principe', 'Le rôle du temps', 'Le poids des frais', 'Exercices corrigés'],
    coverTone: 'gold',
  },
  {
    slug: 'l-art-de-negocier',
    title: 'L’art de négocier',
    subtitle: 'Obtenir un accord juste sans abîmer la relation',
    author: 'Rédaction BIBLIODOR',
    category: 'pouvoir-et-influence',
    priceCents: 1490,
    pages: 162,
    formats: ['EPUB', 'PDF'],
    publishedAt: '2026-09-30',
    pitch: 'Salaire, achat, conflit : les principes de la négociation raisonnée appliqués à des cas réels.',
    takeaways: [
      'Préparer une négociation en identifiant votre meilleure alternative.',
      'Séparer les personnes du problème.',
      'Répondre aux tactiques de pression sans céder.',
    ],
    contents: [
      'Avant la négociation',
      'Intérêts et positions',
      'Les tactiques difficiles',
      'Conclure et formaliser',
      'Cas pratiques',
    ],
    coverTone: 'cream',
    featured: true,
  },
  {
    slug: 'les-ressorts-de-la-persuasion',
    title: 'Les ressorts de la persuasion',
    subtitle: 'Comment on nous convainc, et comment convaincre honnêtement',
    author: 'Rédaction BIBLIODOR',
    category: 'pouvoir-et-influence',
    priceCents: 1290,
    pages: 138,
    formats: ['EPUB', 'PDF'],
    publishedAt: '2026-06-18',
    pitch: 'Les principes de l’influence, décortiqués pour savoir les reconnaître et les utiliser avec éthique.',
    takeaways: [
      'Reconnaître les leviers d’influence utilisés dans la publicité et la vente.',
      'Construire un argument clair et honnête.',
      'Dire non à une sollicitation insistante.',
    ],
    contents: [
      'Réciprocité et engagement',
      'Preuve sociale et autorité',
      'Rareté et urgence',
      'Persuader avec éthique',
    ],
    coverTone: 'forest',
  },
];

export const bookBySlug = (slug: string) => books.find((b) => b.slug === slug);

export const booksByCategory = (category: CategorySlug) => books.filter((b) => b.category === category);

/** Du plus récent au plus ancien. */
export const latestBooks = (limit = books.length) =>
  [...books].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, limit);

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
