# PILOTA90 : campagne e-mail « Reprise de novembre »

Séquence de 5 e-mails sur 8 jours, envoyée à la liste PILOTA90 au moment de la reprise des matchs
après les vacances de la Toussaint.

```
Séquence      : Reprise de novembre 2026
Déclencheur   : envoi programmé à la liste des abonnés e-mail (clients + inscrits newsletter)
Objectif      : ventes, avec le Pack Mental Complet (69 €) comme offre principale
Longueur      : 5 e-mails
Calendrier    : mar. 3/11, jeu. 5/11, sam. 7/11 (jour de match), lun. 9/11, mar. 10/11
Sortie        : tout achat du Pack Mental Complet sort la personne de la séquence
Suivi         : UTM utm_source=email, utm_medium=email, utm_campaign=reprise_nov26, utm_content=eX_bouton|eX_image|eX_lien
```

## Les 5 e-mails

| # | Envoi | Rôle | Objet | Lien principal |
|---|---|---|---|---|
| 1 | Mar. 3/11, 18 h 30 | Conseil utile : la phrase du trajet retour | Ce qu'il entend dans la voiture après le match | Parent d'Athlète (39 €) |
| 2 | Jeu. 5/11, 18 h 30 | Le problème : libéré au jardin, crispé le jour J, et les 5 leviers | Libéré au jardin, crispé le jour du match | Pack Mental Complet (69 €) |
| 3 | Sam. 7/11, 8 h 00 | Le matin du match : 3 choses à faire, 3 à éviter | Ce matin, avant le match | Stress et anxiété (14,90 €) |
| 4 | Lun. 9/11, 18 h 30 | Les objections : tous sports, âge, temps de lecture, garantie | Vos questions sur les guides PILOTA90 | Pack Mental Complet |
| 5 | Mar. 10/11, 18 h 30 | Code PILOTA30 (−30 % jusqu'à 23 h 59) et aide au choix | -30 % jusqu'à ce soir minuit | Pack à 48,30 € + liens Stress et Parent |

Les textes complets (objet, prévisualisation, corps, bouton, P.-S.) sont dans `emails.json`.
Les textes prêts à coller dans Shopify Email sont dans `textes-shopify-email.txt`.
Les versions HTML prêtes à importer sont dans `html/` (largeur 600 px, adaptées au mobile).
Pour régénérer le HTML après une retouche du texte :

```bash
python3 build.py
```

## Logique de la séquence

- Les 3 premiers e-mails apportent quelque chose d'utile avant de vendre : un geste à tester samedi,
  une explication du problème, une routine du matin du match.
- Chaque e-mail a un seul bouton. L'e-mail 3 vend l'entrée de gamme (14,90 €) pour ceux qui ne sont
  pas prêts à prendre le pack.
- L'urgence est réelle : le prochain match du samedi, puis la fin du code PILOTA30 le mardi 10/11 à 23 h 59.
- Offres utilisées : les prix actuels, l'économie du pack (98,60 € → 69 €), la remise automatique
  « 2 guides achetés = le 3ᵉ offert » (e-mails 1 à 4) et le code PILOTA30 (e-mail 5 uniquement).

## Segments

- **À envoyer** : tous les contacts qui ont accepté le marketing par e-mail (consentement à vérifier
  dans Shopify > Clients ; la boutique compte 446 fiches clients).
- **À exclure** : acheteurs du Pack Mental Complet (ils ont déjà les 5 guides).
- **À adapter** :
  - acheteurs de Parent d'Athlète : leur envoyer quand même la séquence, mais changer le bouton de l'e-mail 1
    vers le Pack (« Vous avez déjà le guide Parent d'Athlète : le pack ajoute les 4 guides qui agissent sur lui ») ;
  - acheteurs du guide Stress : changer le bouton de l'e-mail 3 vers le Pack.
- **Coachs et éducateurs** (si un segment existe) : la séquence fonctionne, l'e-mail 4 leur répond déjà.

## Outil d'envoi

- **Shopify Email** (inclus dans Shopify) : créer 5 campagnes, recopier les textes de `emails.json`
  dans le modèle « texte » avec un bouton, et programmer les dates. La balise de désinscription est ajoutée
  automatiquement.
- **Klaviyo, Brevo, Mailchimp** : importer directement les fichiers `html/eX.html` comme modèle de code.
  Remplacer `{{ unsubscribe_link }}` par la balise de désinscription de l'outil.
- Expéditeur conseillé : « Aimane de PILOTA90 », adresse contact@pilota90.com. Les réponses doivent
  arriver dans une boîte lue, les e-mails 1 et 4 invitent à répondre.

## Mesures et repères

| Indicateur | Repère attendu | Remarque |
|---|---|---|
| Taux d'ouverture | 35 à 50 % | Gonflé par Apple Mail, à prendre comme tendance |
| Taux de clic | 2 à 5 % | L'indicateur le plus fiable pour comparer les e-mails |
| Chiffre d'affaires par destinataire | à relever | CA attribué ÷ e-mails délivrés, par e-mail |
| Désinscriptions | moins de 0,5 % par envoi | Au-delà, espacer les envois |

Bilan à faire le vendredi 13/11 : CA de la séquence (UTM `reprise_nov26` dans Shopify > Statistiques),
nombre de packs vendus, meilleur e-mail au clic. La gagnante sert de base aux prochaines campagnes
et aux angles des pubs Meta.

## À valider avant l'envoi

1. **Garantie 14 jours sur le Pack : confirmée par Aimane le 30/10.** Elle n'est pas encore écrite sur la
   fiche du Pack Mental Complet (seulement sur Parent d'Athlète et Stress) : à y ajouter pour rester cohérent
   avec l'e-mail 4.
2. **« Commandé plus de 50 fois »** (e-mail 3) : confirmé par Aimane le 30/10.
3. **Code PILOTA30 : fait (GO d'Aimane le 30/10).** Le code existant `PILOTA30` (−30 %, une utilisation
   par client, non cumulable avec les autres remises) devait expirer le 31/10 à 23 h 59. Sa date de fin
   a été repoussée au **mardi 10/11 à 23 h 59, heure de Paris** (2026-11-10T22:59Z), vérifiée sur la boutique.
   C'est la seule modification faite sur Shopify. Retour arrière : remettre la date de fin au 31/10 dans
   Shopify > Réductions > PILOTA30. Le code est mis en avant uniquement dans l'e-mail 5.
