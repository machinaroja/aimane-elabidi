# Mise en ligne de la plateforme AS Lieusaint

## ⚡ Chemin rapide (3 étapes)

Tout le travail technique est automatisé. Il reste **uniquement ce que seul le club peut faire** : ouvrir ses comptes et y coller deux informations.

**Étape 1 — Supabase (base de données + connexion).** Votre jeton ne quitte jamais votre ordinateur.
1. Créez un compte sur <https://supabase.com>, puis un jeton : <https://supabase.com/dashboard/account/tokens> → « Generate new token » (il commence par `sbp_`).
2. Dans un terminal, depuis le dossier du dépôt (Node 18 ou plus récent) :
   ```bash
   export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx
   export ADMIN_EMAIL=vous@exemple.fr            # premier administrateur du club
   export SITE_URL=https://app.as-lieusaint.fr   # adresse publique (provisoire possible, à corriger ensuite)
   node plateforme/tools/deploy_supabase.mjs
   ```
   Le script crée le projet **en Europe (Paris)**, applique les 11 migrations, crée le rôle restreint de la passerelle, **ferme les inscriptions publiques**, crée votre compte
   administrateur et le club, **vérifie 17 points de sécurité**, puis écrit `gateway.env`. Il s'arrête net, avec le message à me transmettre, à la moindre erreur ; on peut le relancer sans risque.
   Pour que les liens de connexion arrivent vraiment, ajoutez un service d'e-mail (Brevo, Mailjet, Resend…) avec `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

**Étape 2 — Hébergement.** Sur <https://render.com> : *New → Blueprint* → choisissez ce dépôt (`render.yaml` est déjà prêt) → recopiez les valeurs de `gateway.env` quand Render les demande.
Les liens de connexion pointent vers `SITE_URL` : mettez l'adresse définitive (domaine du club) dans Render **et** relancez l'étape 1 avec la même `SITE_URL`.

**Étape 3 — Premier accès.** Ouvrez le site, saisissez `ADMIN_EMAIL`, cliquez sur le lien reçu : vous êtes administrateur du club. Invitez ensuite vos éducateurs depuis « Administration ».
Calendrier officiel : voir §6.

> **Honnêteté.** Le script est testé contre un faux Supabase local qui exécute réellement les migrations (24 contrôles), mais **jamais contre le vrai** : si Supabase a changé son API,
> il s'arrête avec le message exact. Le fichier `render.yaml` et l'image Docker n'ont pas été exécutés non plus. Le reste de ce document détaille chaque étape à la main.

---

> **État honnête.** Tout ce qui peut être préparé et testé sans compte externe l'est (voir §9). **Rien n'est encore déployé** : il faut un projet
> Supabase, un hébergement, un nom de domaine et un service d'envoi d'e-mails, qui sont à créer par le club. Ce guide les relie dans l'ordre.

## 1. Ce qu'il faut décider (je ne peux pas le faire à votre place)

| Décision | Recommandation | Pourquoi |
|---|---|---|
| **Région des données** | Union européenne (Paris ou Francfort) | Données de mineurs : RGPD. Choisir la région **à la création** du projet Supabase (non modifiable ensuite). |
| **Hébergement de la passerelle** | Un hébergeur qui exécute une image Docker et fournit HTTPS (Fly.io, Render, Railway, Scalingo, un VPS…) en région UE | La passerelle est un petit serveur Node (voir `Dockerfile`). Les prix et quotas changent : à vérifier chez le fournisseur. |
| **Nom de domaine** | ex. `app.as-lieusaint.fr` | Les liens de connexion envoyés par e-mail pointent vers ce domaine (HTTPS obligatoire). |
| **Envoi d'e-mails (SMTP)** | Un service dédié (ex. Brevo, Mailjet, Resend) avec le domaine du club authentifié (SPF / DKIM / DMARC) | Le service d'e-mails intégré de Supabase est limité et non prévu pour la production : sans SMTP dédié, les liens de connexion n'arriveront pas de façon fiable. |

## 2. Supabase (base de données et authentification)

> Les intitulés des menus de Supabase évoluent : si l'un d'eux a changé, cherchez l'équivalent et dites-moi lequel.

1. **Créer le projet** (région UE). Noter l'URL du projet et les clés (`anon`, `service_role`) : *Project Settings → API*.
2. **Appliquer les migrations**, dans l'ordre, dans *SQL Editor* (ou avec la CLI `supabase db push`) :
   `plateforme/supabase/migrations/0001_schema.sql` → … → `0011_production_hardening.sql`. **Ne pas** appliquer `tests/` ni `dev/`.
   Si une migration échoue, **arrêter** et me transmettre le message : ne pas continuer avec un schéma incomplet.
3. **Créer le rôle de la passerelle** : ouvrir `supabase/prod/01_create_gateway_role.sql`, remplacer le mot de passe par une valeur aléatoire de 32 caractères
   minimum, exécuter. Si Supabase refuse une des instructions (notamment `grant authenticated to gateway`), **arrêtez-vous et transmettez le message d'erreur** : je ne l'ai pas testé sur un vrai projet.
4. **Réglages d'authentification** (*Authentication*) :
   - *Sign In / Providers → Email* : **désactiver « Allow new users to sign up »** (seules les personnes invitées reçoivent un compte : c'est la passerelle qui le crée) ;
   - *URL Configuration* : **Site URL** = `https://app.as-lieusaint.fr` ; ajouter la même adresse dans **Redirect URLs** ;
   - *SMTP Settings* : renseigner le service d'e-mails choisi ; adapter le modèle d'e-mail « Magic Link » en français ;
   - *Rate limits* : laisser les limites par défaut.
5. **Désactiver l'accès direct aux données** : la plateforme n'utilise **pas** l'API REST automatique de Supabase (tout passe par la passerelle).
   *Project Settings → API (Data API)* : retirer le schéma `public` des schémas exposés, ou désactiver l'API de données. Cela réduit la surface d'attaque.
6. **Sauvegardes** : activer les sauvegardes quotidiennes (et, si le plan le permet, la restauration à un instant donné). Tester une restauration une fois.

## 3. Premier administrateur

1. *Authentication → Users → Add user* : créer le compte de l'administrateur (e-mail, **cocher « Auto Confirm User »**).
2. Ouvrir `supabase/prod/02_bootstrap_first_club.sql`, remplacer l'adresse, exécuter : le club et son premier administrateur sont créés.
3. L'administrateur ouvrira le site (§5), saisira son adresse e-mail et recevra son lien de connexion.

## 4. Vérifier le déploiement de la base

Exécuter `supabase/prod/verify_deploy.sql` : **toutes les lignes doivent afficher `ok = true`**. Une ligne fausse = ne pas ouvrir le service.
(Il contrôle la sécurité par ligne, l'absence de droits pour les visiteurs, le rôle `gateway`, les verrous d'intégrité, l'absence de comptes de démonstration.)

## 5. Passerelle et interface

1. **Construire l'image** : `docker build -t as-lieusaint plateforme/` (contexte = dossier `plateforme/`).
2. **Variables d'environnement** (voir `server/.env.example`, à saisir dans l'hébergeur, **jamais dans le dépôt**) :
   `NODE_ENV=production`, `SITE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (rôle **gateway**), `DATABASE_SSL=1`, `TRUST_PROXY=1`.
   Le serveur **refuse de démarrer** si une variable manque, si la connexion de démonstration est activée, si une adresse n'est pas en https, ou si `DATABASE_URL` utilise un rôle administrateur.
3. **Surveillance** : sonde de vivacité `GET /healthz`, sonde de disponibilité `GET /readyz` (teste la base). Les journaux sont en JSON et ne contiennent ni adresse e-mail, ni jeton.
4. Brancher le domaine (HTTPS fourni par l'hébergeur).

## 6. Calendrier officiel

```bash
python3 plateforme/tools/sportcorico_sync.py a-s-lieusaint-football > calendrier.json
ADMIN_DATABASE_URL='postgresql://postgres:…@db.….supabase.co:5432/postgres' node plateforme/tools/import_calendar.mjs calendrier.json as-lieusaint
```
Idempotent : on peut le relancer (ex. chaque semaine). L'URL d'administration n'est utilisée que pour cette commande, depuis un poste de confiance.

## 7. Essai de bout en bout (à faire par vous, avec de vraies adresses)

- [ ] L'administrateur reçoit son lien et se connecte.
- [ ] Il crée les catégories et les équipes (ou le calendrier officiel les crée), puis **invite un éducateur** avec une adresse de test.
- [ ] L'éducateur ouvre le lien d'invitation, saisit son adresse, reçoit le lien de connexion, arrive sur **sa seule équipe**.
- [ ] Un éducateur d'une autre équipe ne voit rien de la première (vérifier avec deux comptes réels).
- [ ] Une adresse **non invitée** ne reçoit **aucun** e-mail et n'obtient aucun accès.
- [ ] Le lien de connexion fonctionne sur téléphone (le cas d'usage principal au bord du terrain).

## 8. Sécurité et RGPD — liste de contrôle (à valider avec un juriste ou le DPO)

Cette plateforme traite des **données de mineurs**. Ce qui est en place techniquement : cloisonnement par équipe et par club dans la base (RLS), droits minimaux,
journal d'audit des consultations sensibles et des exports, journal sans valeurs nominatives, jetons de connexion à usage unique, aucun mot de passe stocké.
**À faire par le club (non couvert par le code)** :
- [ ] Contrat de sous-traitance (DPA) avec Supabase et avec l'hébergeur ; vérifier la localisation UE.
- [ ] Inscrire le traitement au **registre des traitements** ; mentions légales et **politique de confidentialité** (finalités, durées, droits).
- [ ] Information et, selon les cas, **consentement des représentants légaux** ; règle sur les photos (non gérées).
- [ ] **Durées de conservation** (joueurs partis, saisons passées) : aucun effacement automatique n'existe encore.
- [ ] Procédure d'**accès / rectification / effacement** : aucun outil dans l'interface ; passe par une intervention technique.
- [ ] Procédure en cas de **violation de données** (notification dans les 72 h) ; qui contacter.
- [ ] Rotation périodique des clés et du mot de passe du rôle `gateway` ; qui détient `service_role` ; accès au tableau de bord Supabase limité (authentification à deux facteurs).

## 9. Ce qui est testé, et ce qui ne l'est pas

| Élément | Statut |
|---|---|
| Base : droits, RLS, intégrité, durcissement (311 contrôles, dont la matrice exacte des droits de chacune des 34 tables) | ✅ testé sur PostgreSQL 16 (avec une simulation des réglages par défaut de Supabase) |
| Passerelle : vérification des jetons asymétriques contre les attaques classiques, configuration, limiteur, client d'authentification, résilience (44 contrôles) ; 6 affaiblissements injectés dans le vérificateur, tous détectés | ✅ testé |
| Connexion de production : lien par e-mail, invitation, prolongation et révocation de session, limitation de débit, journaux propres (42 contrôles, avec le rôle `gateway` restreint) | ✅ testé contre un **faux** Supabase Auth local |
| Parcours complets de l'application dans un vrai navigateur (159 contrôles) | ✅ testé |
| Démarrage du paquetage de production (mêmes étapes que l'image) | ✅ reproduit à la main |
| **Image Docker** | ⚠️ **non construite** (pas de Docker dans l'environnement de développement) |
| **Intégration continue** (`.github/workflows/ci.yml`) | ⚠️ **non exécutée** (syntaxe vérifiée seulement) |
| **Vrai Supabase** (migrations, rôle `gateway`, jetons réels, e-mails réels) | ⚠️ **non testé** : c'est le but du §4 (`verify_deploy.sql`, qui détecte 7 erreurs de configuration provoquées en essai) et du §7 |
| Limiteur de débit | ⚠️ en mémoire d'**une seule instance** : si plusieurs instances, le déplacer vers un stockage partagé |
| Jetons de session | ⚠️ conservés dans `sessionStorage` (effacés à la fermeture de l'onglet) ; protégés par une politique de sécurité de contenu stricte |
| Envoi automatique des invitations par e-mail | ❌ pas fait : le lien d'invitation se transmet à la main |
