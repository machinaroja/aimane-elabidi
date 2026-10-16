# BIBLIODOR — Direction artistique

## Intention

Une maison d'édition contemporaine, pas une boutique de fichiers. Tout le site part d'un objet : **le livre et son étagère**. Le livre est l'élément fort de chaque page ; le reste (navigation, textes, interface) reste calme et discipliné pour lui laisser la place.

L'élément mémorable, à ne pas diluer : **la couverture maison**. Toute la collection partage un même gabarit, comme les grandes collections papier où l'on reconnaît un éditeur à sa couverture :

- un double filet or encadre la couverture ;
- le nom de la maison apparaît en petites capitales en haut ;
- chaque rayon a son emblème géométrique (cercles concentriques pour la psychologie, escalier pour le développement personnel, pièces pour l'argent, colonnade pour le pouvoir et l'influence) ;
- il existe trois tons : vert forêt, crème et or.

Les couvertures sont dessinées en HTML/CSS : aucune image à charger, un rendu net à toutes les tailles, et un nouveau titre ne demande qu'une ligne de données. De vraies couvertures illustrées pourront les remplacer plus tard sans changer la mise en page.

## Logo

Le logo officiel (`brand/`) est utilisé tel quel, sans retouche. Il a seulement été détouré pour avoir un fond transparent. Il en existe deux versions :

- `logo-bibliodor.png` : le mot « BIBLIODOR » seul, utilisé dans l'en-tête ;
- `logo-bibliodor-signature.png` : le mot accompagné de la signature « Les idées qui valent de l'or », utilisée dans le pied de page.

Le logo est dessiné en crème et or pour un fond sombre. **On ne le pose donc que sur du vert forêt** : c'est pour cette raison que l'en-tête est vert forêt. Sur fond crème, ses lettres claires disparaîtraient. Si une version pour fond clair devient nécessaire, elle doit être fournie par la personne qui a dessiné le logo, et non recolorée ici.

La signature n'apparaît qu'une seule fois, dans le pied de page, pour ne pas multiplier les slogans.

## Couleurs

| Rôle | Valeur | Usage |
|---|---|---|
| Vert forêt | `#1F3A32` | Texte principal, fonds sombres, boutons principaux |
| Or | `#B8902F` | **Décoratif seulement sur fond clair** : filets, emblèmes, soulignements |
| Crème | `#F8F4EC` | Fond de page |
| Or clair | `#DDBB62` | Uniquement sur fond sombre : texte d'accent, bouton or |
| Or encre (dérivé) | `#7D5F17` | Texte or sur fond clair |
| Papier (dérivé) | `#FFFDF8` | Surfaces surélevées (livre à la une) |

Point d'accessibilité important : l'or `#B8902F` sur crème n'atteint que **2,7:1** de contraste, en dessous du minimum WCAG de 4,5:1 pour le texte. Il n'est donc jamais utilisé pour du texte sur fond clair. Quand il faut du texte doré sur crème, le site utilise l'or encre `#7D5F17` (5,4:1). Les autres combinaisons mesurées sont le vert forêt sur crème (11,2:1) et l'or clair sur vert forêt (6,6:1).

## Typographie

- **Literata** pour les titres. C'est une serif dessinée à l'origine pour la lecture d'ebooks (Google Play Livres), un choix qui a du sens pour une bibliothèque numérique. Son axe optique (`opsz`) affine les grands titres et renforce les petits.
- **Atkinson Hyperlegible Next** pour les textes et l'interface. Elle a été conçue par le Braille Institute pour la lisibilité, en distinguant clairement les caractères ambigus (l/I/1, 0/O).

Les deux polices sont hébergées par le site, sans appel à Google Fonts (meilleure performance, et aucune donnée envoyée à un tiers au regard du RGPD).

## Mise en page

- Les textes sont alignés à gauche, avec des lignes de 66 caractères au maximum.
- Les rayons sont présentés comme **un sommaire de livre**, avec des points de conduite jusqu'au nombre de titres, plutôt qu'en grille de cartes identiques.
- La numérotation est réservée au parcours d'achat, qui est réellement une suite d'étapes.
- Les coins arrondis sont réservés aux éléments interactifs (boutons, menus). Les livres restent droits.
- Une seule animation non déclenchée par l'utilisateur : les livres qui se posent sur l'étagère au chargement. Elle est désactivée si le visiteur a demandé de réduire les animations.

## Ce qui a été écarté, et pourquoi

- Les dégradés décoratifs, les ombres partout et les cartes « SaaS » : ils rendent le site générique.
- Le mot accentué en couleur ou en italique dans le titre, les petites étiquettes en capitales au-dessus des titres et les flèches ajoutées aux liens : ce sont les marques typiques d'un site généré automatiquement.
- Les faux avis, les faux chiffres et les badges de sécurité non vérifiés : ils sont interdits par le cahier des charges et nuisent à la confiance.
