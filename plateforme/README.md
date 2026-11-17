# AS Lieusaint — Plateforme de gestion sportive (socle club multi-catégories)

Un club, une méthodologie, plusieurs catégories, une seule plateforme.
Ce dossier contient le **socle de données et de sécurité** de la plateforme, écrit pour
PostgreSQL / Supabase. La séparation des données est faite **dans la base** (RLS), pas dans l'interface.

## Ce qui est réalisé (priorités 1 à 6, une partie des 7, 8 et 10 du cahier des charges)

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
| 10. Sécurité | RLS sur toutes les tables, journal d'audit insertion seule, RGPD (pas de valeurs nominatives dans le journal), clés étrangères composites anti-mélange entre clubs | `0003`, `0005` |

## Rôles par défaut (modifiables par l'administrateur)

| Rôle | Portée | Droits principaux |
|---|---|---|
| `club_admin` | club | Tout, y compris rôles et permissions (immuables pour ce rôle) |
| `direction` | club | Lecture globale, rapports |
| `directeur_technique` | club | Catégories/équipes, membres, invitations, **méthodologie complète**, consultation des séances des éducateurs, rapports |
| `responsable_categorie` | sa catégorie | Équipes de la catégorie, joueurs, invitations d'éducateurs, export |
| `entraineur` | son équipe | Joueurs, contacts, observations, lecture de la méthodologie |
| `adjoint` | son équipe | Consultation, observations |

Règles clés : on n'attribue qu'un rôle de rang **strictement inférieur** au sien ; un éducateur ne voit
que ses catégories/équipes ; l'ancien entraîneur d'un joueur perd l'accès dès le transfert ; les observations
privées ne sont **jamais** partagées automatiquement (partage explicite par l'auteur uniquement).

## Tester

```bash
cd plateforme/supabase && ./run_tests.sh
```

Crée une base PostgreSQL jetable, applique les migrations, puis exécute **115 contrôles** avec 10 comptes
(administrateur, directeur technique, responsable, 4 entraîneurs, adjoint, inconnu, deuxième club) :
isolation par catégorie/équipe/club, invitations, transferts, observations, versions, audit, garde-fous.
Le test est « strict » : un refus n'est accepté que s'il vient d'un vrai refus de droits (pas d'une erreur de syntaxe).
Des failles volontaires (RLS trop large, accès après transfert, anti-escalade retirée) sont bien détectées.

## Limites actuelles (honnêtes)

- Testé sur **PostgreSQL 16 avec une simulation de Supabase Auth** (`tests/00_auth_shim.sql`), pas sur une
  instance Supabase réelle. À rejouer sur le vrai projet avant mise en production.
- **Pas encore faits** : interface web, présences/absences, convocations, matchs et statistiques,
  séances/microcycles (au-delà de la bibliothèque), calendrier central et détection de conflits,
  installations sportives, tableau de bord et rapports de la direction technique, assistants IA par catégorie.
  Ils suivront l'ordre de priorité 9 à 15, avec le même modèle de droits (`app.has_perm`).
- Les évaluations et objectifs des joueurs suivront le même schéma (fiche unique + équipe + visibilité).
- Les orientations par âge (U7-U9, U10-U13, U14-U16, U17-U18) sont créées en **brouillon** : la direction
  technique doit les valider.
- Conformité RGPD : le socle apporte la minimisation et la traçabilité ; reste à définir politique de
  conservation, droit d'accès/effacement et consentement parental avec le club.
