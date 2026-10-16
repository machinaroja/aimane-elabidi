# BIBLIODOR — site web

Site de la bibliothèque numérique BIBLIODOR (ebooks en français).

**État actuel : étape 2 (direction artistique et page d'accueil), en attente de validation.**
La direction artistique est décrite dans [DESIGN.md](DESIGN.md).

## Démarrer

Prérequis : Node.js 22.22 ou plus récent.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # génère le site dans dist/
npm run preview   # sert dist/ en local
npm run check     # vérification des types
```

Vérifications visuelles et fonctionnelles (le serveur de prévisualisation doit tourner) :

```bash
node scripts/screenshot.mjs ./captures   # captures ordinateur et mobile de l'accueil
node scripts/smoke.mjs                   # ajout au panier et compteur
```

Dans un environnement où Playwright ne trouve pas son navigateur, préciser son chemin avec `CHROMIUM_PATH=/chemin/vers/chrome`.

## Architecture

- **[Astro](https://astro.build)** : génère des pages HTML statiques, très rapides et bien référencées, avec un minimum de JavaScript. Seuls le panier et les boutons d'achat chargent du code.
- `src/data/` : le catalogue (`books.ts`) et les rayons (`categories.ts`). **Les titres actuels sont des exemples** à remplacer par le vrai catalogue.
- `src/components/` : composants réutilisables (couverture, emblèmes, en-tête, pied de page, bouton d'achat).
- `src/styles/tokens.css` : jetons de design (couleurs, typographie, espacements). C'est la source unique du style.
- `src/lib/cart.ts` : le panier, conservé dans le navigateur. Il ne contient que des identifiants : **les prix font toujours foi côté serveur au moment du paiement**.
- `src/config/site.ts` : nom, URL et navigation. `demoCatalog: true` affiche le bandeau « Aperçu du site » ; le passer à `false` au lancement.

Le sitemap (`/sitemap-index.xml`) et le `robots.txt` sont générés automatiquement. Le panier et le compte en sont exclus.

## Variables d'environnement

Copier `.env.example` en `.env`. Aucun secret ne doit être versionné.

| Variable | Rôle |
|---|---|
| `PUBLIC_SITE_URL` | URL de production, utilisée pour les liens canoniques et le sitemap |

Les variables du paiement et de la livraison seront ajoutées à l'étape 3, une fois la solution choisie.

## Ce qui fonctionne / ce qui reste à faire

Fonctionnel et testé :
- la page d'accueil, sur ordinateur et sur mobile ;
- le panier côté navigateur (ajout, compteur, persistance après rechargement) ;
- le sitemap et le robots.txt ;
- des titres et descriptions uniques par page, avec les métadonnées pour les réseaux sociaux.

Pages d'attente, qui seront développées après validation de l'accueil :
- le catalogue, les catégories et les fiches ebooks ;
- le panier et la commande ;
- le compte client ;
- les pages À propos, FAQ et Contact ;
- les pages légales.

Non commencé, car en attente de décisions :
- le paiement et la livraison numérique sécurisée ;
- le formulaire de contact ;
- le logo officiel (un mot-symbole provisoire est utilisé, voir `src/components/Logo.astro`).
