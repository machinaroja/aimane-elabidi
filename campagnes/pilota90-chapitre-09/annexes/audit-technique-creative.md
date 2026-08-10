# Annexe technique — audit de la créative (mesures réelles)

Toutes les valeurs ci-dessous ont été **mesurées sur le fichier livré**, pas estimées.
Fichier analysé : `Votre_Story_Septembre_chapitre_9_sur_12_Minimaliste_Monochrome.mp4`

## 1. Spécifications du fichier

| Paramètre | Valeur mesurée | Commentaire |
|---|---|---|
| Conteneur / codec | MP4 · H.264 Main profile · yuv420p | Conforme aux specs Meta |
| Résolution | 1080 × 1920 | 9:16, format natif Reels / Stories |
| Durée | 10,00 s exactement | Sous le seuil de 15 s |
| Cadence | 30 im/s (constante) | Conforme |
| Débit vidéo | 4 172 kb/s (4,3 Mb/s total) | Confortable, aucune recompression nécessaire |
| Espace colorimétrique | bt709, progressif | Conforme |
| Audio | AAC-LC stéréo 44,1 kHz · 124 kb/s | Piste présente |
| Niveau sonore | moyen −20,6 dBFS · crête −4,0 dBFS | Marge de crête correcte, pas de saturation |
| Date de création | 2026-07-18 | — |

**Conclusion :** le master est techniquement conforme. Aucun ré-encodage requis avant mise en ligne.

## 2. Zones de sécurité — le point bloquant

Meta recouvre le haut et le bas du cadre avec son interface en Reels et en Stories. La recommandation
usuelle est de réserver **environ 14 % en haut et 20 % en bas**, soit sur un cadre de 1920 px de haut :
**268 px en haut** et **384 px en bas**.

Positions réellement mesurées dans la vidéo (détection des pixels de texte, image par image) :

| Élément | Position verticale | Distance au bas du cadre | Verdict |
|---|---|---|---|
| Watermark logo PILOTA90 | y = 102 → 248 px | — (à 102 px du **haut**) | ❌ Entièrement dans les 268 px du haut |
| Sous-titre ligne 1 (1,0 s) | y = 1546 → 1590 | 330 → 374 px | ❌ Sous la limite des 384 px |
| Sous-titre ligne 2 (1,0 s) | y = 1615 → 1649 | 271 → 305 px | ❌ Nettement sous la limite |
| Sur-titre L1 « Vos mots construisent son mental. » | y = 1484 → 1526 | 394 → 436 px | ✅ Juste au-dessus de la limite |
| Sur-titre L2 « Ou le détruisent. » | y = 1555 → 1599 | 321 → 365 px | ❌ Sous la limite des 384 px |

**Conséquence concrète :** en placement Reels, la seconde ligne de la punchline — « Ou le détruisent. » —
et la seconde ligne des dialogues sous-titrés passent **derrière le nom du compte, la légende et la barre
d'actions**. C'est-à-dire que la moitié qui porte la charge émotionnelle du message est masquée
précisément sur le placement le moins cher et le plus regardé.

Visualisation : `../assets/audit-zones-securite.jpg`

### Correction demandée au monteur

1. Remonter l'ensemble du bloc de texte (dialogues + punchline) pour que **la ligne la plus basse se
   termine à 420 px minimum du bas** du cadre — soit une marge de sécurité de 36 px au-delà des 384 px.
2. Descendre le watermark à **300 px minimum du haut**, ou le supprimer : le logo revient de toute
   façon en grand sur le carton final, il n'apporte rien en surimpression.
3. Exporter une seconde version **4:5 (1080 × 1350)** pour le fil Facebook et Instagram, où le 9:16 est
   recadré. Le 9:16 reste le master pour Reels et Stories.

## 3. Découpage seconde par seconde

| Timecode | Plan | Texte à l'écran |
|---|---|---|
| 0,0 – 2,5 s | Adulte au bord du terrain, colère, poing serré | « Mais qu'est-ce que tu fais ? Réveille-toi ! » |
| 2,5 – 3,5 s | Gros plan enfant, regard baissé | (le sous-titre négatif reste affiché) |
| 3,5 – 5,5 s | Même adulte, posture ouverte, applaudit | « Bien tenté, continue ! » |
| 5,5 – 6,5 s | Gros plan enfant, sourire | — |
| 6,5 – 8,0 s | Plan large de dos, les enfants repartent au jeu | « Vos mots construisent son mental. Ou le détruisent. » |
| 8,0 – 10,0 s | Carton noir, logo, URL | « pilota90.com » |

**Le carton final consomme 2,0 s sur 10, soit 20 % de la durée totale, sans appel à l'action.**
Une URL affichée n'est pas cliquable : le spectateur ne peut rien en faire. Voir la proposition de
nouveau carton final dans le plan de campagne.

## 4. Ce que la durée de 10 s implique

Une vidéo de moins de 15 s est comptée en ThruPlay **lorsqu'elle est visionnée jusqu'au bout**.
Autrement dit, sur ce format, un ThruPlay équivaut à une complétion à 100 %, et il n'y a pas de
« raccourci » à 15 s. C'est exigeant, mais c'est aussi ce qui rend le signal propre : chaque ThruPlay
correspond à une personne qui a vu la punchline **et** le carton de marque.

Corollaire pour la construction d'audiences : les segments « 95 % de la vidéo » et « ThruPlay » seront
quasiment identiques sur cette créative. Ne les traitez pas comme deux paliers distincts.

---

*Mesures réalisées par extraction d'images et analyse des pixels de texte (seuil de luminance ≥ 225)
sur les images à 1,0 s / 3,0 s / 4,5 s / 7,0 s.*
