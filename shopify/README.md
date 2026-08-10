# PILOTA90 — Refonte conversion des fiches produit

Boutique : **pilota90.com** (`aqzish-wf.myshopify.com`)

Ce dossier versionne le travail de refonte des 14 fiches produit : le code ajouté au thème,
les contenus rédactionnels appliqués, et le brief qui a servi à les écrire.

---

## Le principe appliqué

Un visiteur scanne une fiche produit en 8 secondes et cherche trois réponses. Chacune a
désormais un emplacement dédié en haut de page :

| Question du visiteur | Où elle est traitée | Support |
|---|---|---|
| Ce produit est-il pour moi ? | Le titre du produit + les puces « pour qui » | `title` + `p90.pour_qui` |
| Cette personne comprend-elle mon problème ? | Le sous-titre, juste sous le titre | `p90.sous_titre` |
| Pourquoi acheter maintenant ? | L'encadré d'urgence, juste avant le bouton | `p90.urgence` (+ `p90.bonus`) |

L'urgence est toujours une **urgence de valeur** — hausse de prix réellement annoncée, économie
réelle d'un pack, bonus réel. Jamais de compte à rebours ni de « plus que 3 en stock ».

---

## Contenu du dossier

```
shopify/
├── brief-redaction.md          Le brief suivi pour écrire les 14 fiches
├── fiches-produit/             Le contenu appliqué, un fichier JSON par produit
│   └── <handle>.json           title, sous_titre, pour_qui, urgence, bénéfices,
│                               SEO et description HTML complète
└── theme/                      Les fichiers ajoutés ou modifiés dans le thème
    ├── assets/p90-conversion.css
    ├── snippets/p90-conversion.liquid      les 4 blocs de conversion
    ├── snippets/p90-avantages.liquid       extrait du bloc Liquid d'origine
    ├── snippets/p90-note-numerique.liquid  extrait du bloc Liquid d'origine
    ├── snippets/p90-badge-avis.liquid      extrait du bloc Liquid d'origine
    └── templates/product.json              nouvel ordre des blocs
```

## Les métachamps

Six champs, dans l'espace de noms `p90`, épinglés sur la fiche produit dans l'admin Shopify.
Ils s'éditent sans toucher au code, dans **Produits → un produit → Métachamps**.

| Clé | Type | Rôle |
|---|---|---|
| `sous_titre` | texte multi-ligne | La douleur du client, puis la transformation promise |
| `pour_qui` | texte | Segments séparés par ` · `, affichés en puces |
| `benefices` | liste de textes | 3 micro-bénéfices affichés sous le prix |
| `urgence` | texte | Une phrase, au-dessus du bouton d'achat |
| `bonus` | texte multi-ligne | Vide par défaut. Rempli → un encadré bonus apparaît |
| `preuve` | texte | Preuve sociale, à tenir à jour sur les ventes réelles |

Chaque bloc reste invisible tant que son métachamp est vide : un produit non renseigné
s'affiche normalement, sans encadré fantôme.

## Le thème

Les blocs sont montés dans la section produit via `templates/product.json`, dans cet ordre :

```
vendor → title → p90_sous_titre → reviews_badge → price → note produit numérique
      → p90_sous_prix → variant_picker → p90_urgence → buy_buttons
      → p90_paiement → p90_avantages
```

Chaque bloc appelle le même snippet avec une variante :

```liquid
{% render 'p90-conversion', part: 'sous_titre' %}
{% render 'p90-conversion', part: 'sous_prix' %}
{% render 'p90-conversion', part: 'urgence' %}
{% render 'p90-conversion', part: 'paiement' %}
```

Les icônes de paiement sont générées depuis `shop.enabled_payment_types` avec le filtre
`payment_type_svg_tag` : seuls les moyens de paiement **réellement activés** sur la boutique
s'affichent, avec les SVG officiels Shopify. Aucune maintenance si vous en ajoutez un.

Le CSS est mobile d'abord, sans débordement horizontal à 360 px comme à 390 px.

## Règles de contenu à respecter pour la suite

- Aucun chiffre inventé : ni avis, ni note, ni nombre d'acheteurs, ni caractéristique absente du produit.
- Le champ `preuve` ne cite le chiffre d'un produit que s'il dépasse 10 ventes ; en dessous,
  il affiche la preuve à l'échelle de la boutique.
- Le champ `bonus` ne se remplit que si le bonus est réellement livré.
- Un guide ne doit jamais être présenté comme une alternative à un pack qui ne le contient pas.
  Le **Pack Complet** contient exactement 5 guides : Motivation, Communiquer, Confiance,
  Force Mentale, Les Bases du Jeu Intelligent. Pour tous les autres guides, la seule formulation
  vraie est additive : guide + pack = 54,65 € au lieu de 94,40 € à l'unité.
