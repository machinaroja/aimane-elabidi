/*
  Panier côté navigateur. Il ne contient que des identifiants d'ouvrages :
  les prix font toujours foi côté serveur au moment du paiement.
  Un ebook ne s'achète qu'une fois, donc pas de quantité.
*/
const KEY = 'bibliodor:cart:v1';
const EVENT = 'bibliodor:cart';

const read = (): string[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
};

const write = (slugs: string[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(slugs));
  } catch {
    // Stockage indisponible (navigation privée stricte) : le panier reste en mémoire pour la page.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
};

export const cart = {
  items: read,
  count: () => read().length,
  has: (slug: string) => read().includes(slug),
  add(slug: string) {
    const items = read();
    if (!items.includes(slug)) write([...items, slug]);
  },
  remove(slug: string) {
    write(read().filter((s) => s !== slug));
  },
  clear() {
    write([]);
  },
  subscribe(fn: () => void) {
    window.addEventListener(EVENT, fn);
    // Synchronise les onglets ouverts en parallèle
    window.addEventListener('storage', (e) => e.key === KEY && fn());
  },
};
