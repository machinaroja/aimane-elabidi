# Thème Shopify « Bibliodor »

Thème Shopify (Online Store 2.0) qui reprend la direction artistique du site BIBLIODOR (voir `../DESIGN.md`) : couvertures maison, étagère, rayons en sommaire, palette vert forêt, or et crème.

Shopify prend en charge le paiement, la TVA, les comptes clients et la livraison des fichiers. Le thème se charge uniquement de la présentation.

## Contenu

| Dossier | Rôle |
|---|---|
| `layout/` | Gabarit général (`theme.liquid`) et page protégée par mot de passe |
| `sections/` | Blocs modifiables dans l'éditeur Shopify : ouverture et étagère, rayons, livre à la une, grille de livres, étapes d'achat, fiche ebook, catalogue, panier, FAQ, contact… |
| `snippets/` | Pièces réutilisables : couverture maison, emblèmes, carte livre, prix, bouton d'achat |
| `templates/` | Composition de chaque type de page |
| `assets/` | Feuille de style, script et polices auto-hébergées |
| `locales/fr.default.json` | Tous les textes de l'interface, en français |

## Installer le thème

1. Dans l'admin Shopify, ouvrez **Boutique en ligne → Thèmes → Ajouter un thème → Importer un fichier zip**.
2. Choisissez `bibliodor-theme.zip`. Pour le régénérer : `cd shopify-theme && zip -r ../bibliodor-theme.zip . -x README.md`.
3. Vérifiez l'aperçu, puis cliquez sur **Publier**.

Pour vérifier le code avant import : `node scripts/theme-check.mjs`, depuis la racine du dépôt.

## Préparer la boutique pour le thème

Le thème s'appuie sur les éléments suivants. Les noms techniques (« handle ») doivent être identiques.

**Collections**
- `psychologie`, `developpement-personnel`, `argent`, `pouvoir-et-influence` : les quatre rayons.
- `a-la-une` : les trois livres posés sur l'étagère de l'accueil.
- `nouveautes` : collection automatique contenant tous les produits, triée du plus récent au plus ancien.

**Produits (un produit = un ebook)**
- Le **type de produit** est le nom exact du rayon, par exemple « Développement personnel ». Il choisit l'emblème de la couverture.
- Ajoutez une étiquette de ton de couverture : `ton:foret`, `ton:creme` ou `ton:or`. Sans étiquette, la couverture est vert forêt.
- Ajoutez l'étiquette `couverture:image` pour afficher l'image du produit à la place de la couverture maison.
- Le produit ne doit pas nécessiter d'expédition (décochez « Produit physique »).

**Métachamps produit** (Paramètres → Données personnalisées → Produits), espace de noms `custom` :

| Clé | Type | Exemple |
|---|---|---|
| `sous_titre` | Texte sur une ligne | Repérer les raccourcis de la pensée… |
| `points_cles` | Liste de textes sur une ligne | Ce que le lecteur saura faire |
| `sommaire` | Liste de textes sur une ligne | Titres des chapitres |
| `pages` | Nombre entier | 168 |
| `formats` | Texte sur une ligne | EPUB et PDF |

Tous sont facultatifs : le thème n'affiche que ce qui est renseigné.

**Pages** (Boutique en ligne → Pages)
- `a-propos`, avec le modèle `page`.
- `faq`, avec le modèle `page.faq`. Les questions se modifient dans l'éditeur de thème.
- `contact`, avec le modèle `page.contact`. Les messages arrivent à l'e-mail de la boutique.

**Menus** (Boutique en ligne → Navigation)
- `main-menu` : Catalogue, Rayons, La maison, Questions.
- `rayons` et `footer` : affichés dans le pied de page.

**Pages légales** (Paramètres → Politiques) : conditions de vente, remboursement, confidentialité, mentions légales. Elles s'affichent automatiquement en bas de page.

## Livraison des ebooks

Installez l'application gratuite **Digital Downloads** de Shopify, puis joignez le fichier EPUB ou PDF à chaque produit. Après paiement, le client télécharge ses fichiers depuis la page de confirmation et l'e-mail de commande. Le nombre de téléchargements autorisés se règle dans l'application, ce qui limite le partage des liens.

**Droit de rétractation (UE).** Pour un contenu numérique, le client ne perd son droit de rétractation de 14 jours que s'il a expressément accepté la fourniture immédiate et reconnu renoncer à ce droit. Ajoutez cette case à cocher au paiement et mentionnez-la dans les conditions de vente. Faites valider ces textes par un professionnel du droit.
