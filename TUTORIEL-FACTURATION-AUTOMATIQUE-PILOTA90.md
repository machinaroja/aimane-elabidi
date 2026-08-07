# Facturation automatique PDF — PILOTA90 (Shopify)

Tutoriel de configuration de l'envoi automatique de factures conformes au statut
de micro-entrepreneur en franchise en base de TVA (art. 293 B du CGI).

**Boutique :** pilota90.com (Shopify, forfait Basic, devise EUR)
**Vendeur :** EL ABIDI Aimane (EI) — 47 rue Vivienne, 75002 Paris — SIREN 106 948 763

---

## Étape 0 — Supprimer toute trace de TVA dans Shopify ✅ FAIT (07/08/2026)

Les **14 produits** de la boutique étaient cochés « taxable » dans Shopify.
La case « Facturer les taxes » a été décochée sur les 14 produits via l'API
Admin le 07/08/2026, et l'état a été vérifié : **0 produit taxable sur 14**.
Les totaux sont désormais nets partout, conformément à la franchise en base.

Reste une vérification manuelle (2 clics) : **Paramètres → Taxes et frais de
douane** → si une région de collecte (France, Union européenne…) est
configurée, la supprimer. Sans région de collecte et sans produit taxable,
aucune ligne de TVA ne peut apparaître.

Pour tout nouveau produit créé à l'avenir : penser à **décocher « Facturer
les taxes »** dans la fiche produit avant publication.

---

> **Note sur LDT** : l'application LDT déjà installée gère la **livraison des
> fichiers** (liens de téléchargement). Elle ne produit pas de facture légale
> française — il faut donc bien ajouter une application de facturation dédiée
> (étapes 1 à 4 ci-dessous). Les deux apps cohabitent sans problème : LDT
> envoie le guide, l'app de facturation envoie la facture.

## Étape 1 — Installer l'application de facturation

Application recommandée : **Order Printer Pro: Invoice App** (éditeur FORSBERG+two).
Plan gratuit jusqu'à 50 commandes/mois, envoi automatique de factures PDF,
modèles personnalisables — largement suffisant pour démarrer.

1. Admin Shopify → **Applications** → **Shopify App Store**.
2. Recherchez **« Order Printer Pro »** → **Installer**.
3. Choisissez le plan **Free** (50 commandes/mois). Si vous dépassez, le plan
   payant est d'environ 10 $/mois.

*Alternative : **Sufio** (~7–9 €/mois), plus haut de gamme, modèles français
et mentions légales gérées nativement. Les étapes sont équivalentes.*

## Étape 2 — Renseigner vos informations légales sur la facture

1. Ouvrez l'application → **Manage templates** (Gérer les modèles) → modèle
   **Invoice** → **Edit**.
2. Dans la zone « Company information » / en-tête, renseignez :
   - **EL ABIDI Aimane, EI** (la mention « EI » ou « Entrepreneur individuel »
     est obligatoire depuis 2022)
   - **47 rue Vivienne, 75002 Paris, France**
   - **SIREN : 106 948 763**
   - E-mail de contact de la boutique.
3. Dans la zone pied de page (« Footer text » / « Legal text »), collez
   exactement :

   > **TVA non applicable, art. 293 B du CGI**

4. Vérifiez l'aperçu : comme les produits ne sont plus taxables (étape 0),
   aucune colonne ni ligne TVA n'apparaît — seulement le total net.
   Si le modèle affiche encore un bloc « Tax », supprimez-le dans l'éditeur
   de modèle (le support de l'app le fait gratuitement sur demande).
5. **Enregistrer**.

## Étape 3 — Numérotation des factures

La loi française impose une numérotation chronologique et continue, sans trou.

1. Dans l'application → **Settings** → section **Invoice numbers**.
2. Activez la numérotation séquentielle propre à l'app (ne pas utiliser le
   numéro de commande Shopify si vous avez déjà émis des factures ailleurs).
3. Définissez un préfixe si vous voulez, par ex. `F2026-` → `F2026-0001`, etc.

## Étape 4 — Activer l'envoi automatique après paiement

1. Dans l'application → **Settings** → **Automatic delivery** (Livraison
   automatique).
2. Activez **« Automatically email PDF invoices »** avec le déclencheur
   **« When order is paid »** (à la commande payée).
3. L'app s'appuie sur l'événement « commande payée » de Shopify : cela
   fonctionne **quel que soit le moyen de paiement — Stripe, PayPal, etc.** —
   aucune configuration séparée n'est nécessaire côté Stripe ou PayPal.
4. Option complémentaire : l'app fournit un petit code Liquid à coller dans
   **Paramètres → Notifications → Confirmation de commande** pour ajouter un
   bouton « Télécharger la facture PDF » dans l'e-mail que le client reçoit
   déjà avec son lien de téléchargement.

## Étape 5 — Tester

1. Passez une commande test (produit à 0,01 € temporaire, ou commande réelle
   remboursée ensuite).
2. Vérifiez que l'e-mail reçu contient la facture PDF et que celle-ci affiche :
   nom + « EI », adresse, SIREN, numéro de facture, date, désignation du guide,
   prix net, **aucune ligne de TVA**, et la mention « TVA non applicable,
   art. 293 B du CGI » en pied de page.

---

## Rappels de conformité (facture française)

Chaque facture doit comporter : date d'émission, numéro chronologique, identité
complète du vendeur (dont mention **EI** et SIREN), identité du client,
désignation et quantité des produits, prix unitaire et total net, la mention
**« TVA non applicable, art. 293 B du CGI »**. Conservez les factures 10 ans
(l'app archive tous les PDF).

## Points de vigilance fiscaux (Belgique / Suisse)

- **Belgique (UE)** : pour les produits numériques vendus à des particuliers
  dans l'UE, la franchise française s'applique tant que le total annuel des
  ventes transfrontalières UE reste sous **10 000 €**. Au-delà, la TVA du pays
  du client devient due (guichet unique OSS). À surveiller si les ventes
  belges décollent.
- **Suisse (hors UE)** : rien à faire en pratique — un assujettissement à la
  TVA suisse ne se déclenche qu'à partir de 100 000 CHF de chiffre d'affaires
  mondial.
- Vérifiez chaque année les seuils de la franchise en base (art. 293 B), ils
  ont fait l'objet de réformes récentes.

## Côté URSSAF — ce que la facturation ne fait PAS à votre place

L'émission des factures est une obligation, mais elle ne remplace pas vos
obligations déclaratives de micro-entrepreneur :

1. **Déclarer votre chiffre d'affaires** (mensuel ou trimestriel selon votre
   option) sur autoentrepreneur.urssaf.fr — montant encaissé, catégorie BIC
   ventes de marchandises pour les guides téléchargeables. À déclarer même si
   le CA est de 0 €.
2. **Tenir un livre des recettes** chronologique : l'export des commandes
   Shopify (Commandes → Exporter) + l'archive des factures de l'app suffisent
   à le constituer — pensez à l'exporter chaque mois et à le conserver.
3. **Compte bancaire dédié** à l'activité obligatoire si le CA dépasse
   10 000 € deux années de suite.
4. Surveiller le **plafond de CA de la micro-entreprise** (188 700 € pour la
   vente de biens — à vérifier chaque année) et les seuils de TVA.
