# Facturation automatique PDF — PILOTA90 (Shopify)

Tutoriel de configuration de l'envoi automatique de factures conformes au statut
de micro-entrepreneur en franchise en base de TVA (art. 293 B du CGI).

**Boutique :** pilota90.com (Shopify, forfait Basic, devise EUR)
**Vendeur :** EL ABIDI Aimane (EI) — 47 rue Vivienne, 75002 Paris — SIREN 106 948 763

---

## Étape 0 (indispensable) — Supprimer toute trace de TVA dans Shopify

Constat au moment de la rédaction : les 10 produits de la boutique sont cochés
« taxable » dans Shopify. Tant que c'est le cas, Shopify peut afficher une ligne
« dont TVA » sur les commandes, reçus et factures, même si le prix payé ne change pas.
Il faut donc désactiver la taxe produit par produit :

1. Admin Shopify → **Produits**.
2. Cochez la case tout en haut de la liste pour **sélectionner tous les produits**.
3. Cliquez sur **Modifier les produits** (éditeur en masse).
4. Cliquez sur **Colonnes** → ajoutez la colonne **« Facturer les taxes »**
   (Charge taxes).
5. **Décochez** la case pour chaque produit → **Enregistrer**.
6. Ensuite : **Paramètres → Taxes et frais de douane** → vérifiez qu'aucune
   région (France, Union européenne…) n'est configurée pour la collecte de taxes.
   Si une zone de collecte existe, supprimez-la.

Résultat : plus aucune ligne de TVA nulle part — les totaux sont nets, ce qui
correspond à la franchise en base.

---

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
