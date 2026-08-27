# Machina Rapport

Application de création de **rapports d'évaluation de stage** pour les stagiaires accueillis
dans la structure. Elle couvre tout le processus : recueil des informations auprès du joueur
et de sa famille, notation sur le référentiel Machina, puis génération d'un PDF détaillé.

L'application est entièrement autonome : **aucune installation, aucun serveur, aucune dépendance**.
Il suffit d'ouvrir `index.html` dans un navigateur.

---

## Démarrage sur ordinateur

1. Ouvrir `index.html` (double-clic, ou glisser le fichier dans Chrome / Edge / Firefox).
2. Cliquer sur **« + Nouveau rapport »**.
3. Parcourir les six étapes, puis générer le PDF.

---

## Installation sur téléphone et tablette

L'application est une **PWA** : une fois mise en ligne, elle s'installe sur l'écran d'accueil
comme une application classique, avec son icône, en plein écran et **sans connexion Internet**.

### Étape 1 — Mettre l'application en ligne (une seule fois)

Sur GitHub, dans le dépôt :

1. **Settings** → **Pages**
2. *Source* : **Deploy from a branch**
3. *Branch* : `claude/machina-rapport-app-qtj6vy`, dossier `/ (root)` → **Save**

Au bout d'une à deux minutes, l'adresse suivante est active :

```
https://machinaroja.github.io/aimane-elabidi/
```

L'adresse est publique : n'y publiez pas de rapports pré-remplis. Les données saisies, elles,
ne quittent jamais l'appareil.

### Étape 2 — Installer sur le téléphone

**iPhone / iPad (Safari — obligatoire, Chrome iOS ne sait pas installer)**

1. Ouvrir l'adresse dans **Safari**
2. Bouton **Partager** (carré avec la flèche vers le haut)
3. **Sur l'écran d'accueil**
4. **Ajouter**

**Android (Chrome)**

1. Ouvrir l'adresse dans **Chrome**
2. Bandeau **« Installer l'application »**, ou menu **⋮** → **Installer l'application**
3. **Installer**

L'icône apparaît sur l'écran d'accueil. L'application s'ouvre en plein écran, sans barre
d'adresse, et fonctionne ensuite **sans réseau** : terrain, vestiaire, déplacement.

### Générer le PDF depuis un téléphone

- **iOS** : bouton *Générer le PDF* → **Partager** → **Imprimer** → écarter deux doigts sur
  l'aperçu → **Partager** → *Enregistrer dans Fichiers* ou *Envoyer par mail*
- **Android** : bouton *Générer le PDF* → destination **Enregistrer au format PDF**

Pensez à activer les **graphiques d'arrière-plan** dans les options d'impression pour
conserver les couleurs des structures.

### Mettre à jour l'application

À chaque nouvelle version poussée sur la branche, incrémenter `VERSION` dans `sw.js`
(`machina-rapport-v1` → `v2`). Les téléphones récupèrent la mise à jour à la prochaine
ouverture avec du réseau ; les rapports déjà saisis sont conservés.

### Sans mise en ligne

L'application fonctionne aussi en ouvrant `index.html` depuis le stockage du téléphone, mais
l'installation sur l'écran d'accueil et le cache hors connexion nécessitent une adresse
HTTPS. Pour un usage en équipe, tout hébergement statique convient : GitHub Pages, Netlify,
ou un partage réseau interne.

---

## Les six étapes

| # | Étape | Contenu |
|---|-------|---------|
| 1 | **Fiche stagiaire** | Identité, poste, pied fort, club d'origine, période et lieu du stage, évaluateur référent. |
| 2 | **Évaluation** | 6 structures, 20 critères notés de 1 à 5, avec commentaire par critère. |
| 3 | **Questions joueur** | 62 questions réparties en 10 sections, à conduire en entretien individuel. |
| 4 | **Questions parents** | 65 questions réparties en 10 sections, dont santé, autorisations et consentements. |
| 5 | **Synthèse** | Points forts, axes de progression, objectifs, conclusion, recommandation. |
| 6 | **Rapport** | Aperçu du document final et génération du PDF. |

Chaque onglet affiche son pourcentage de complétion ; l'en-tête affiche l'avancement global.

---

## Le référentiel d'évaluation

Six structures, reprises du rapport de référence :

| Structure | Critères |
|-----------|----------|
| **Coordination** | Passes · Contrôles · Conduite |
| **Cognitif** | Gérer le temps de jeu · Équilibrer le jeu de l'équipe · Proposer des options à l'équipe |
| **Émotif - Volitif** | Montrer de la motivation pour le jeu · Volonté de participer au jeu · Gestion des émotions |
| **Créatif - Expressif** | Essayer différentes solutions · Imprévisible · S'adapte aux différentes situations |
| **Mental** | Gérer le résultat · Gérer ses propres erreurs · Gérer les erreurs des autres · Gérer les facteurs externes |
| **Socio - Affectif** | Montrer la capacité de relation · Identifie les rôles dans l'équipe · Faire preuve d'empathie pendant le jeu · Influence positive sur l'équipe |

### Notation

Chaque critère est noté de **1 à 5** sur deux colonnes, **P** et **R**.
La structure *Coordination* fait exception : elle est évaluée sur une note unique, comme dans
le rapport de référence.

| Note | Libellé |
|------|---------|
| 1 | À construire |
| 2 | En développement |
| 3 | Conforme au niveau |
| 4 | Point d'appui |
| 5 | Point fort majeur |

**Valeur d'une structure** = moyenne de toutes ses notes P et R, **arrondie au dixième supérieur**.
Cette règle reproduit à l'identique les valeurs du rapport de référence
(3,70 · 3,50 · 4,00 · 4,00 · 3,70 · 4,20).

> Les libellés des colonnes **P** et **R** sont par défaut *Potentiel* et *Rendement*.
> Ils se modifient dans **Réglages** pour coller à votre méthodologie.

### Bibliothèque de formulations

Sous chaque critère, cinq boutons numérotés de 1 à 5 insèrent une formulation professionnelle
correspondant au niveau, avec le prénom du stagiaire automatiquement inséré.
Les phrases de niveau 4 reprennent la tonalité du rapport de référence.
Le texte proposé reste entièrement modifiable.

---

## Les questionnaires

### Joueur — 62 questions

1. Identité & parcours sportif
2. Motivation, objectifs & projet
3. Auto-évaluation — Coordination
4. Auto-évaluation — Cognitif
5. Auto-évaluation — Émotif / Volitif
6. Auto-évaluation — Créatif / Expressif
7. Auto-évaluation — Mental
8. Auto-évaluation — Socio / Affectif
9. Hygiène de vie & récupération
10. Retour du joueur sur le stage

Les sections 3 à 8 sont calées sur les six structures du référentiel : elles permettent de
confronter la perception du joueur à l'observation du staff.

### Parents / responsables légaux — 65 questions

1. Identité & contacts
2. Environnement familial & scolarité
3. Santé, croissance & sécurité
4. Parcours sportif & encadrement
5. Comportement & autonomie au quotidien
6. Émotions, mental & rapport à la pression
7. Attentes & projet sportif
8. Logistique & disponibilité
9. Retour des parents sur le stage
10. Autorisations & consentements

### Version papier

Le bouton **« Imprimer le questionnaire vierge »**, en haut de chaque questionnaire, produit
une version papier prête à distribuer, avec cases à cocher et lignes de réponse.

---

## Le rapport PDF

Le document généré comprend :

1. **Couverture** — identité du stagiaire, période du stage, méthode d'évaluation et échelle.
2. **Tableau de synthèse** — les six structures avec leurs valeurs et le détail des notes,
   dans la même disposition que le rapport de référence.
3. **Profil du stagiaire** — représentation graphique des six valeurs.
4. **Analyse détaillée par structure** — le commentaire de chaque critère.
5. **Parole du joueur** — les réponses du questionnaire joueur.
6. **Regard de la famille** — les réponses du questionnaire parents.
7. **Synthèse et projet de progression** — points forts, axes, objectifs, conclusion,
   recommandation, mention légale et bloc signature.

Les sections sans donnée sont automatiquement masquées.

### Générer le PDF

Onglet **Rapport** → bouton **« Générer le PDF »**. Dans la fenêtre d'impression :

- **Destination** : *Enregistrer au format PDF*
- **Marges** : par défaut
- **Graphiques d'arrière-plan** : ☑ à cocher, pour conserver les couleurs des structures

### Aide à la rédaction

L'onglet **Synthèse** propose un bouton **« Proposer une trame »** : il compose un premier jet
à partir des notes saisies — structure la plus aboutie, structure à travailler, critères les
mieux et les moins bien notés, objectifs chiffrés. Ce texte est un point de départ à relire
et à ajuster.

---

## Données

Tout est stocké dans le **navigateur du poste** (`localStorage`). Rien n'est envoyé sur
Internet, ce qui convient au traitement de données concernant des mineurs.

Conséquence directe : **les données ne suivent pas d'un poste à l'autre** et un nettoyage du
navigateur les efface.

- **Exporter tout** — sauvegarde complète au format JSON. À faire régulièrement.
- **Exporter** (dans un rapport) — un seul rapport, pour le transmettre à un collègue.
- **Importer** — réintègre un fichier exporté, sans écraser les rapports déjà présents.
- **Dupliquer** — repart d'un rapport existant, utile pour enchaîner les stagiaires d'un même stage.

---

## Réglages

- Nom de la structure et sous-titre affichés en tête du rapport
- Nom et fonction du signataire
- Libellés des colonnes **P** et **R**
- Mention légale de bas de rapport

---

## Structure des fichiers

```
index.html                     Point d'entrée
manifest.webmanifest           Déclaration d'application installable (PWA)
sw.js                          Service worker : cache et fonctionnement hors connexion
assets/icones/                 Icônes d'écran d'accueil (192, 512, Apple 180)
assets/css/app.css             Interface
assets/css/print.css           Document et règles d'impression PDF
assets/js/referentiel.js       6 structures, 20 critères, formulations, calculs
assets/js/questionnaires.js    Questions joueur et parents
assets/js/store.js             Persistance locale, import / export
assets/js/rapport.js           Construction du document
assets/js/app.js               Navigation, formulaires, événements
```

### Adapter le référentiel

Tout se modifie dans `assets/js/referentiel.js` : ajouter un critère, changer une définition,
réécrire une formulation, ajuster une couleur de structure. Les calculs et le rapport
s'adaptent automatiquement.

Pour modifier les questionnaires, éditer `assets/js/questionnaires.js`. Les types de champ
disponibles sont : `text`, `textarea`, `date`, `tel`, `email`, `select`, `echelle`, `oui_non`.

---

## Navigateurs

Chrome, Edge, Firefox et Safari dans leurs versions récentes. Chrome et Edge donnent le
meilleur rendu à l'impression PDF.
