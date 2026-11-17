# Calendrier officiel (SportCorico → plateforme)

Les matchs officiels (championnats, coupes, critériums) des équipes de l'AS Lieusaint sont publiés sur
[SportCorico](https://www.sportcorico.com/clubs/a-s-lieusaint-football). La plateforme les importe comme événements « match »
du calendrier central, rattachés à chaque équipe.

## Instantané du 2026-11-17 — saison 2026 - 2027

| Équipe (SportCorico) | Matchs | Joués | À venir | Forfaits | Repos |
|---|---|---|---|---|---|
| SENIORS 1 | 46 | 17 | 29 | 0 | 0 |
| SENIORS 10 | 21 | 6 | 15 | 0 | 2 |
| SENIORS 2 | 23 | 7 | 16 | 0 | 0 |
| SENIORS 5 | 45 | 14 | 31 | 0 | 2 |
| SENIORS FUTSAL 1 | 20 | 5 | 13 | 2 | 0 |
| SENIORS FUTSAL 2 | 18 | 3 | 15 | 0 | 0 |
| SENIORS FÉMININES 1 | 1 | 1 | 0 | 0 | 0 |
| U11 1 | 20 | 3 | 17 | 0 | 0 |
| U12 1 | 10 | 0 | 10 | 0 | 0 |
| U13 6 | 17 | 3 | 14 | 0 | 2 |
| U14 1 | 28 | 12 | 16 | 0 | 1 |
| U14 2 | 20 | 7 | 13 | 0 | 0 |
| U14 3 | 21 | 5 | 12 | 4 | 2 |
| U16 1 | 20 | 7 | 13 | 0 | 0 |
| U16 2 | 21 | 6 | 12 | 3 | 2 |
| U18 1 | 21 | 8 | 13 | 0 | 0 |
| **Total** | **352** | **104** | **239** | **9** | **11** |

Fichier : `supabase/tests/fixtures/sportcorico_as_lieusaint.json` (aucune donnée de joueur : équipe, compétition,
adversaire, date, heure, score uniquement).

## Fonctionnement

1. `tools/sportcorico_sync.py` lit les pages publiques du club et des équipes et produit un JSON.
2. `public.import_external_calendar(club, 'sportcorico', json, create_structure)` (direction technique / administrateur)
   crée au besoin les catégories et les équipes (« U14 1 » → catégorie U14, équipe 1) et importe les matchs.
3. L'import est **idempotent** (identifiant officiel du match) : relancer met à jour, ne duplique jamais.

## Règles

- Le planning officiel (date, heure, adversaire, compétition) **appartient à la compétition** : ni un entraîneur ni la
  direction technique ne peut le déplacer ou l'annuler depuis la plateforme. Si la compétition le décale, la
  prochaine synchronisation le met à jour.
- Composition, convocations, présences, notes de l'entraîneur ne sont **jamais écrasées** par la synchronisation.
- Chaque entraîneur ne voit que les matchs de ses équipes ; la direction voit tout.
- **Heure inconnue** : SportCorico n'affiche pas l'heure des matchs déjà joués. Ils sont importés à midi (heure de
  Paris) et marqués `time_known = false` ; l'heure n'est jamais inventée. Les matchs à venir ont tous une heure.
- « Exempt » (journée de repos) n'est pas un match : non importé. « F » = forfait : importé avec le statut `forfeit`.

## Respect de la source

Seules les pages `/clubs/...` sont lues ; `robots.txt` de SportCorico interdit `/match/` aux robots, ces pages ne sont
jamais explorées. Une requête toutes les 2 secondes, User-Agent explicite, arrêt à la moindre erreur HTTP.
Il s'agit d'un site tiers sans API publique : si sa mise en page change, le parseur le signale (lignes « non reconnues »)
plutôt que d'importer des données douteuses. Pour un usage durable, demander à SportCorico une exportation officielle
(ICS / API) ou passer par le calendrier officiel de la FFF reste préférable.

## Limites

- Les équipes sont nommées comme chez SportCorico (1, 2, 3…) et non A, B, C : renommables par l'administrateur.
- Pas encore de synchronisation automatique planifiée : à lancer à la main (un hébergement serveur est nécessaire
  pour la tâche quotidienne).
- Chargé et vérifié sur la base de test locale ; à rejouer sur le projet Supabase réel une fois créé.
