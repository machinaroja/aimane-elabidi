# PILOTA90 — campagne Meta, chapitre 9 sur 12

Campagne publicitaire **Interactions** pour le spot de 10 s « Votre Story Septembre, chapitre 9 sur 12 ».
Marché France. Objectif réel : fabriquer un actif d'audience réutilisable, et faire parler le public
pour savoir à qui l'on s'adresse.

## Les fichiers

| Fichier | Ce qu'il contient |
|---|---|
| [`01-textes-publicitaires.md`](01-textes-publicitaires.md) | **La bande description.** Sept textes principaux prêts à copier, dix titres, six descriptions, les commentaires de marque, le plan de modération |
| [`02-plan-de-campagne.md`](02-plan-de-campagne.md) | Le plan complet : stratégie, architecture, ciblage, budgets, audiences, collecte de données, conformité, suite de la série |
| [`03-etat-du-compte.md`](03-etat-du-compte.md) | Lecture critique du rapport Meta sur la campagne Ventes en cours, et ce qu'il change ici |
| [`annexes/audit-technique-creative.md`](annexes/audit-technique-creative.md) | Les mesures faites sur le fichier vidéo lui-même : specs, position des textes, zones de sécurité |
| `assets/` | Storyboard, carton final, visuel d'audit des zones de sécurité |

## La campagne en six lignes

Objectif **Interactions**, lieu de conversion « Sur votre publicité », type **Vues de vidéo**,
optimisation **ThruPlay**. La vidéo faisant exactement 10,00 s, un ThruPlay est une vue intégrale à
100 % : on achète de la complétion réelle, et l'événement que Meta optimise est exactement celui qui
construit l'audience. Budget en ABO, quatre ensembles au lancement plus un ensemble similaire activé
en cours de vol. Placements manuels, **Audience Network décoché** — non négociable, c'est la première
cause de pollution d'une audience de vues vidéo.

## Trois choses à faire avant de lancer

1. **Remonter les textes incrustés d'au moins 420 px.** En Reels, l'interface recouvre les 35 %
   inférieurs du cadre, soit tout ce qui est sous y = 1248. Or les dialogues et la punchline du film
   sont tous sous y = 1484 : **la totalité du texte est masquée**. Sans correction, il reste un adulte
   qui s'agite et un enfant qui baisse la tête, sans la bascule ni la conclusion.

2. **Réécrire la punchline.** « Vos mots construisent son mental. Ou le détruisent. » cumule les trois
   signaux que vise la politique Meta sur les attributs personnels : adresse à la deuxième personne,
   présomption de situation familiale, et référence à la santé mentale d'un mineur. Aucun texte
   publicitaire ne rattrape un texte incrusté dans l'image. Remplacement proposé :
   *« Sur un terrain, il y a ce qui se joue. Et il y a ce qui se dit. »*

3. **Étendre le ciblage à la Belgique et à la Suisse, par la langue.** Le compte diffuse déjà sur
   France, Belgique et Suisse — le plan initial ne visait que la France. Ciblez la **langue française**
   et non les pays entiers : sans cela, le budget part sur la Flandre et la Suisse alémanique, où le
   film n'est pas compris.

> **Contexte du compte, connu depuis le rapport Meta du 10 août.** PILOTA90 vend des **guides
> numériques**, diffuse sur **FR-BE-CH**, et fait tourner une campagne Ventes (CBO 25 €/j) avec un pixel
> actif. Cela tranche le scénario d'offre laissé ouvert dans le plan, et rend les audiences site
> montables immédiatement. Voir [`03-etat-du-compte.md`](03-etat-du-compte.md) — dont les deux points
> les plus importants : l'ensemble Ventes ne peut structurellement pas sortir de la phase
> d'apprentissage à ce budget, et le ROAS affiché de 1,33 est peut-être un ROAS TTC, auquel cas la
> campagne est à l'équilibre et non rentable.

## Ce que cette campagne apprend — et ce qu'elle n'apprend pas

Elle apprend quels profils regardent ce message jusqu'au bout, y compris des poches d'audience
qu'aucun centre d'intérêt ne décrit. Elle constitue des audiences personnalisées réutilisables
365 jours, et elle donne une lecture qualitative du public réel par les commentaires.

Elle n'apprend pas qui achète : une optimisation ThruPlay entraîne le modèle à trouver des
spectateurs, pas des acheteurs, et l'apprentissage reste attaché à l'ensemble de publicités et à son
événement d'optimisation. Elle ne collecte non plus **aucune** donnée déclarative structurée :
le formulaire instantané relève de l'objectif `Prospects`, qui est une campagne distincte.

L'algorithme n'a pas de mémoire de la marque. Les audiences, si — et ce sont elles qu'on donnera à
Meta comme point de départ quand il y aura quelque chose à vendre.

## Limites méthodologiques

Tous les domaines Meta — `facebook.com`, `business.facebook.com`, `transparency.meta.com`,
`developers.facebook.com` — ainsi que `cnil.fr`, `legifrance.gouv.fr` et `fff.fr` sont **bloqués par
la politique réseau de l'environnement de travail**. Aucune affirmation portant sur le produit Meta
n'a donc pu être confirmée sur source primaire ; elles reposent sur des sources secondaires et sur
la recherche web. Les libellés d'interface, les seuils et les options sont à revérifier dans le
Gestionnaire au moment du montage — les points concernés sont signalés dans le plan.

Les chiffres de coût et de volume sont des **estimations de planification**, dérivées d'un CPM de
référence de 4,50 € (fourchette 3–6 €). Ce ne sont pas des engagements de résultat : vos propres
chiffres à J+7 les remplacent.

En revanche, tout ce qui concerne le fichier vidéo — durée, codec, niveaux audio, position des
textes au pixel près — a été **mesuré directement sur le master**, et non estimé.
