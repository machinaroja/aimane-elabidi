# AS Lieusaint — Plateforme de gestion sportive

Un club, une méthodologie, plusieurs catégories, une seule plateforme.
Ce dossier contient le **socle de données et de sécurité** de la plateforme, écrit pour
PostgreSQL / Supabase. La séparation des données est faite **dans la base** (RLS), pas dans l'interface.

## Architecture

```
Navigateur (web/, React)  →  Passerelle d'API (server/, Node)  →  PostgreSQL / Supabase (supabase/)
                              ne décide d'aucun droit            RLS : toutes les règles de droits
```

La passerelle ouvre une transaction **au nom de l'utilisateur** (rôle `authenticated` + claims du jeton) : c'est PostgreSQL
qui filtre, comme dans les 206 tests. Aucun droit n'est codé dans l'interface ni dans la passerelle.

## Lancer en local (démonstration)

```bash
./dev.sh                                   # base de démonstration : 16 équipes, 352 matchs officiels, comptes fictifs
cd web && npm install && npm run build     # interface
cd ../server && npm install && DEV_AUTH=1 node index.mjs   # http://localhost:8787
```
Comptes fictifs `…@demo.lieusaint.local` : administrateur, direction technique, responsable U14, coach U14, adjoint U14, coach Seniors 1, compte sans rôle.
`DEV_AUTH=1` (connexion de démonstration) est **refusé** si `NODE_ENV=production`.

## Interface web (v1)

Le logo officiel du club (`web/public/logo.png`, recadré en rond) figure dans l'en-tête, la page de connexion et l'onglet du navigateur.

| Écran | Pour qui | Contenu |
|---|---|---|
| Accueil | tous | Mon rôle, mes équipes, prochains rendez-vous |
| Calendrier | tous (filtré par rôle) | À venir / passés, matchs officiels (badge, score V/N/D), création d'événement avec détection des conflits |
| Fiche événement | éducateurs de l'équipe | Convocations et réponses, présences (présent / retard / absent / excusé), composition, notes, résultat |
| Effectif | éducateurs de l'équipe | Liste des joueurs, ajout d'un joueur, **transfert vers une autre équipe ou catégorie** (la fiche et l'historique sont conservés), historique du joueur |
| Méthodologie | tous ; gestion par la direction technique | Lecture des contenus publiés (badge « Nouveau »), copie dans l'espace personnel (original intact) ; **la direction technique crée, modifie en brouillon, publie, crée une nouvelle version, consulte l'historique et le suivi de lecture** |
| Administration | direction | Catégories, équipes, invitations d'éducateurs (lien à usage unique) |

Tests : `cd e2e && NODE_PATH=$(npm root -g) node e2e.cjs` (62 contrôles dans un vrai Chromium : parcours entraîneur, direction technique,
invitation d'un nouvel éducateur, publication de la méthodologie en 2 versions, transferts de joueurs et droits qui suivent, compte sans rôle, jetons falsifiés) ; `cd server && npm test` (8 contrôles des jetons).

## Ce qui est réalisé (priorités 1 à 6, 8, 9, 11, 12 et une partie des 7 et 10 du cahier des charges)

| Priorité | Contenu | Fichier |
|---|---|---|
| 1. Organisation AS Lieusaint | Club, saisons, création réservée aux opérateurs plateforme | `0001`, `0004` (`create_club`) |
| 2. Catégories | Entièrement configurables (U7…Seniors, rien d'imposé) | `0001` |
| 3. Équipes | Plusieurs équipes par catégorie et par saison (A, B, C, D…) | `0001` |
| 4. Invitations | Jeton à usage unique, haché en base, expirant, lié à l'e-mail, anti-escalade de rôle | `0004` |
| 5. Accès et permissions | 6 rôles, permissions voir / ajouter / modifier / supprimer / exporter / administrer, 3 portées (club / catégorie / équipe) | `0002`, `0003`, `0004` (`seed_club`) |
| 6. Bibliothèque centrale | Contenus versionnés, brouillon → publication, versions publiées immuables, suivi de lecture | `0001`, `0004`, `0006` |
| 7. Espace de l'entraîneur | Bibliothèque personnelle, copie d'une séance commune (original intact), recommandations de la direction technique | `0001`, `0004` (`copy_to_personal`) |
| 8. Joueurs | Fiche unique par club, historique d'équipes, transfert U13→U14 sans perte, observations privées non héritées | `0001`, `0004` (`transfer_player`) |
| 9. Présences et absences | Présent / absent / en retard (minutes) / excusé ; seul un joueur de l'équipe de l'événement est acceptable ; notes jamais copiées dans le journal d'audit | `0007` (`record_attendance`) |
| 11. Calendrier partagé | Entraînements, matchs, tournois, événements, réunions ; installations et fermetures ; **détection des conflits** (équipe déjà occupée, terrain déjà réservé, installation indisponible) ; chaque coach ne voit que son planning, la direction voit tout ; seule la direction technique peut forcer un conflit de terrain | `0007` (`create_event`, `reschedule_event`, `cancel_event`) |
| 11 bis. Calendrier officiel | Import des **352 matchs officiels** de 16 équipes depuis SportCorico (voir [CALENDRIER_OFFICIEL.md](CALENDRIER_OFFICIEL.md)) : idempotent, non modifiable par les éducateurs, ne touche pas au travail de l'entraîneur | `0008`, `tools/sportcorico_sync.py` |
| 12. Matchs et convocations | Convocations et réponses, composition (joueurs de l'équipe uniquement), résultat, statistiques individuelles bornées | `0007` (`convoke_players`, `set_convocation_response`, `save_match`, `record_match_stats`) |
| 10. Sécurité | RLS sur toutes les tables, journal d'audit insertion seule, RGPD (pas de valeurs nominatives dans le journal), clés étrangères composites anti-mélange entre clubs | `0003`, `0005` |

## Rôles par défaut (modifiables par l'administrateur)

| Rôle | Portée | Droits principaux |
|---|---|---|
| `club_admin` | club | Tout, y compris rôles et permissions (immuables pour ce rôle) |
| `direction` | club | Lecture globale, rapports |
| `directeur_technique` | club | Catégories/équipes, membres, invitations, **méthodologie complète**, consultation des séances des éducateurs, installations, calendrier (peut forcer un conflit de terrain), rapports |
| `responsable_categorie` | sa catégorie | Équipes de la catégorie, joueurs, invitations d'éducateurs, export |
| `entraineur` | son équipe | Joueurs, contacts, observations, lecture de la méthodologie |
| `adjoint` | son équipe | Consultation, observations |

Sécurité des fonctions : toute fonction créée est fermée par défaut (aucun droit d'exécution pour les
utilisateurs) ; seules les RPC publiques et les fonctions utilisées par la RLS sont ouvertes explicitement,
et un test vérifie qu'aucune fonction n'est exécutable par un visiteur anonyme.

Règles clés : on n'attribue qu'un rôle de rang **strictement inférieur** au sien ; un éducateur ne voit
que ses catégories/équipes ; l'ancien entraîneur d'un joueur perd l'accès dès le transfert ; les observations
privées ne sont **jamais** partagées automatiquement (partage explicite par l'auteur uniquement).

## Tester

```bash
cd plateforme/supabase && ./run_tests.sh
```

Crée une base PostgreSQL jetable, applique les migrations, puis exécute **206 contrôles** avec 10 comptes
(administrateur, directeur technique, responsable, 4 entraîneurs, adjoint, inconnu, deuxième club) :
isolation par catégorie/équipe/club, invitations, transferts, observations, versions, audit, garde-fous.
Le test est « strict » : un refus n'est accepté que s'il vient d'un vrai refus de droits (pas d'une erreur de syntaxe).
Des failles volontaires (RLS trop large, accès après transfert, anti-escalade retirée) sont bien détectées.

## Limites actuelles (honnêtes)

- Testé sur **PostgreSQL 16 avec une simulation de Supabase Auth** (`tests/00_auth_shim.sql`), pas sur une
  instance Supabase réelle. À rejouer sur le vrai projet avant mise en production.
- **Pas encore faits** : séances d'entraînement planifiées et microcycles (au-delà de la bibliothèque), tableau de bord
  et rapports de la direction technique, assistants IA par catégorie, publication de la méthodologie depuis
  l'interface (fait), transfert d'un joueur de catégorie depuis l'interface (fait) ; restent les observations de joueurs
  dans l'interface (la base les gère déjà : privées par défaut, partage explicite), les évaluations et objectifs des joueurs. Ils suivront l'ordre de priorité, avec le même modèle de droits (`app.has_perm`).
- **Connexion** : seule la connexion de démonstration existe. En production, l'authentification passera par Supabase Auth
  (lien magique par e-mail) ; la passerelle vérifie déjà son jeton (`SUPABASE_JWT_SECRET`). Rien n'est encore déployé :
  il faut créer le projet Supabase, un rôle de connexion dédié pour la passerelle, un hébergement et le nom de domaine.
- **Pas de limitation de débit** (anti-abus) ni d'envoi automatique des invitations par e-mail : à ajouter avant l'ouverture au public.
- Les convocations enregistrent la réponse **saisie par l'éducateur** ; une réponse directe des parents
  (lien ou application) reste à concevoir avec les règles RGPD du club.
- Les évaluations et objectifs des joueurs suivront le même schéma (fiche unique + équipe + visibilité).
- Les orientations par âge (U7-U9, U10-U13, U14-U16, U17-U18) sont créées en **brouillon** : la direction
  technique doit les valider.
- Conformité RGPD : le socle apporte la minimisation et la traçabilité ; reste à définir politique de
  conservation, droit d'accès/effacement et consentement parental avec le club.
