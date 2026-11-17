# AS Lieusaint — Plateforme de gestion sportive (socle club multi-catégories)

Un club, une méthodologie, plusieurs catégories, une seule plateforme.
Ce dossier contient le **socle de données et de sécurité** de la plateforme, écrit pour
PostgreSQL / Supabase. La séparation des données est faite **dans la base** (RLS), pas dans l'interface.

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

Crée une base PostgreSQL jetable, applique les migrations, puis exécute **168 contrôles** avec 10 comptes
(administrateur, directeur technique, responsable, 4 entraîneurs, adjoint, inconnu, deuxième club) :
isolation par catégorie/équipe/club, invitations, transferts, observations, versions, audit, garde-fous.
Le test est « strict » : un refus n'est accepté que s'il vient d'un vrai refus de droits (pas d'une erreur de syntaxe).
Des failles volontaires (RLS trop large, accès après transfert, anti-escalade retirée) sont bien détectées.

## Limites actuelles (honnêtes)

- Testé sur **PostgreSQL 16 avec une simulation de Supabase Auth** (`tests/00_auth_shim.sql`), pas sur une
  instance Supabase réelle. À rejouer sur le vrai projet avant mise en production.
- **Pas encore faits** : interface web, séances d'entraînement planifiées et microcycles (au-delà de la
  bibliothèque), tableau de bord et rapports de la direction technique, assistants IA par catégorie.
  Ils suivront l'ordre de priorité, avec le même modèle de droits (`app.has_perm`).
- Les convocations enregistrent la réponse **saisie par l'éducateur** ; une réponse directe des parents
  (lien ou application) reste à concevoir avec les règles RGPD du club.
- Les évaluations et objectifs des joueurs suivront le même schéma (fiche unique + équipe + visibilité).
- Les orientations par âge (U7-U9, U10-U13, U14-U16, U17-U18) sont créées en **brouillon** : la direction
  technique doit les valider.
- Conformité RGPD : le socle apporte la minimisation et la traçabilité ; reste à définir politique de
  conservation, droit d'accès/effacement et consentement parental avec le club.
