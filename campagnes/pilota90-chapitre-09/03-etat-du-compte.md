# État du compte — lecture critique du rapport Meta

Analyse de l'ensemble `PILOTA90 | Large FR-BE-CH | Advantage+ | Achats`, lancé le 8 juillet 2026,
sur les 30 derniers jours. Chiffres recalculés à partir de ceux du rapport.

## Ce que disent vraiment les chiffres

| Indicateur | Valeur | Source |
|---|---:|---|
| Dépense | 638,18 € | rapport |
| Achats | 35 | rapport |
| Coût par achat | 18,23 € | rapport |
| ROAS | 1,33 | rapport |
| **Chiffre d'affaires** | **848,78 €** | déduit |
| **Panier moyen** | **24,25 €** | déduit |
| **Marge par vente** | **6,02 €** | déduit (produit numérique, coût marginal nul) |
| **Profit sur 30 jours** | **210,60 €** | déduit |
| CPM | 4,48 € | déduit — sain |
| Clics estimés | ≈ 2 476 | déduit du CTR |
| Coût par clic | 0,26 € | déduit |
| Taux clic → achat | 1,41 % | déduit |
| **Fréquence sur 30 jours** | **3,86** | **déduit — absent du rapport** |

## Les deux points que le rapport ne dit pas

### 1. Cet ensemble ne sortira jamais de la phase d'apprentissage

Le rapport conseille de « surveiller la fin de la phase d'apprentissage ». Or elle ne viendra pas.
Meta demande environ **50 conversions par semaine et par ensemble** pour stabiliser la diffusion.

| | |
|---|---:|
| Rythme actuel | **8,2 achats/semaine** |
| Seuil requis | 50 achats/semaine |
| Budget nécessaire au CPA actuel | **130 €/jour** |
| Budget actuel | 25 €/jour |
| Facteur manquant | **× 5,2** |

Ce n'est pas un réglage à surveiller, c'est une contrainte structurelle. Trois conséquences pratiques :

- **Chaque modification coûte cher.** À 8 conversions par semaine, un ensemble remis en apprentissage
  met des semaines à se réétalonner. La stabilité est votre principal levier : ne touchez ni au budget,
  ni au ciblage, ni aux créatives de cet ensemble sans raison forte.
- **Ne fragmentez pas.** Si la campagne CBO contient plusieurs ensembles, chacun reçoit une fraction de
  ces 8 conversions. Un ensemble unique concentre le signal.
- **Envisagez d'optimiser sur un événement plus fréquent** — ajout au panier ou initiation de paiement —
  si le volume d'achats reste sous 15 par semaine. Le signal est moins pur, mais un modèle nourri sur un
  événement intermédiaire bat un modèle affamé sur l'événement final.

### 2. Le ROAS de 1,33 est probablement un ROAS TTC

Meta calcule le retour sur la valeur que votre site lui envoie. Si cette valeur est le montant payé par
le client — le cas le plus courant — elle inclut la TVA, que vous reversez.

| Hypothèse | CA hors taxes | ROAS réel | Profit sur 30 j |
|---|---:|---:|---:|
| Valeur envoyée hors taxes | 848,78 € | 1,33 | +210,60 € |
| Valeur envoyée TTC, TVA France 20 % | 707,32 € | **1,11** | **+69,14 €** |
| Valeur envoyée TTC, TVA Belgique 21 % | 701,47 € | 1,10 | +63,29 € |

**À vérifier dans le paramétrage du pixel :** la valeur transmise à l'achat est-elle le montant TTC ou
hors taxes ? Si c'est le TTC, votre marge réelle sur 30 jours est d'environ 69 €, pas 210 €. Vous êtes
alors à l'équilibre, et non rentable — ce qui change complètement les décisions à prendre.

Rappel : sur des produits numériques vendus à des particuliers, la TVA applicable est celle du pays du
client. Avec un ciblage France, Belgique et Suisse, trois taux coexistent dans le même ensemble.

## Le levier le plus rentable n'est pas dans le compte publicitaire

Le coût par achat est de 18,23 € pour un panier de 24,25 €. Tout le résultat tient dans ces 6 € d'écart.
Or le panier moyen se travaille sans toucher au média :

| Panier moyen | ROAS | Profit sur 30 jours | À média strictement constant |
|---:|---:|---:|---|
| 24,25 € | 1,33 | +210 € | situation actuelle |
| 30,00 € | 1,65 | +412 € | un guide vendu en lot de deux |
| 35,00 € | 1,92 | +587 € | offre groupée ou complément à la commande |
| 40,00 € | 2,19 | +762 € | pack complet |

**Passer le panier de 24 à 35 € multiplie le profit par 2,8 sans dépenser un euro de plus en publicité.**
Aucune optimisation de ciblage ne produit ce rendement. L'assistant de Meta ne le proposera jamais :
il ne voit que le compte publicitaire, pas votre catalogue ni vos prix.

## Ce que valent les trois recommandations du rapport

**« Ajouter une couche de reciblage » — juste, mais le pool est trop petit.**
C'est la bonne priorité média. Deux réserves. D'abord le volume : 2 476 clics sur 30 jours, dont une
fraction ajoute au panier. Un ensemble de reciblage sur les ajouts au panier des 30 derniers jours
adressera quelques centaines de personnes — trop peu pour peser sur le chiffre d'affaires total.
Ensuite l'illusion d'optique : le reciblage capte des conversions qui, en bonne partie, auraient eu lieu
sans lui. Le ROAS moyen du compte va monter, sans que le chiffre d'affaires augmente d'autant. **Jugez-le
sur le chiffre d'affaires total, pas sur le ROAS affiché.**

**« Maintenir la diversité des formats » — générique, sans contenu actionnable.**

**« Surveiller la phase d'apprentissage » — le conseil passe à côté du problème**, voir plus haut.

**Et ce que le rapport ne dit pas : la fréquence est à 3,86 sur 30 jours.** Sur de la prospection en
audience large, c'est le seuil où la lassitude s'installe. C'est cohérent avec un pool d'audience
réellement adressable plus étroit que ne le laisse croire le libellé « Large ».

## Ce que cela change dans le plan de campagne

| Point | Hypothèse initiale | Réalité | Conséquence |
|---|---|---|---|
| Offre | inconnue, trois scénarios | **guides numériques** | Scénario B tranché. Le commentaire ressource et la bascule vers la conversion sont écrits |
| Marché | France | **France, Belgique, Suisse** | Ajouter BE et CH, **en ciblant la langue française** : la Wallonie et Bruxelles, la Suisse romande. Un ciblage pays entier gaspille sur les zones néerlandophones et germanophones |
| Pixel | à vérifier | **actif** | Les audiences site sont montables immédiatement, pas en phase 2 |
| CPM de planification | 4,50 € estimé | **4,48 € mesuré** | Toutes les projections de volume du plan sont validées par vos propres chiffres |
| Reciblage | à construire | **inexistant** | C'est précisément le trou que la campagne engagement vient combler |

## Pourquoi la campagne engagement prend tout son sens ici

Votre compte n'a pas de problème de ciblage : il a un problème de **pool**. En 30 jours, la prospection a
touché 36 871 personnes et produit environ 2 476 visiteurs. C'est ce qui alimente le reciblage — et c'est
trop peu.

Une campagne engagement achète de l'attention, pas de la conversion, donc elle remplit ce pool beaucoup
plus vite par euro dépensé. À votre CPM réel de 4,48 €, **300 € produisent environ 67 000 impressions**,
dont une part significative atteint le palier de vue à 95 % : de l'ordre de plusieurs milliers de
personnes qualifiées, conservées 365 jours.

La nuance honnête : un spectateur qui a regardé dix secondes sur dix est moins chaud qu'un visiteur qui
a mis un guide au panier. Ce n'est pas la même intention, et le taux de conversion sera plus faible. Mais
c'est un pool que vous n'avez pas du tout aujourd'hui, constitué à un coût sans commune mesure avec celui
d'un clic sortant.

## Ordre de priorité recommandé

1. **Vérifier si la valeur du pixel est TTC ou hors taxes.** Cinq minutes. Cela détermine si vous êtes
   rentable ou à l'équilibre — donc tout le reste.
2. **Travailler le panier moyen.** Le levier le plus rentable, et il ne coûte rien en média.
3. **Ne rien toucher à l'ensemble Achats.** À 8 conversions par semaine, la stabilité vaut mieux que
   n'importe quelle optimisation.
4. **Monter le reciblage** recommandé par Meta, en le jugeant au chiffre d'affaires total.
5. **Lancer la campagne engagement** pour fabriquer le pool qui manque aux points 4 et suivants.
