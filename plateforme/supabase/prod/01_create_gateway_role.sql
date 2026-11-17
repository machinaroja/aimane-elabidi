-- =============================================================================
-- À exécuter UNE FOIS, après les migrations, dans l'éditeur SQL de Supabase (rôle postgres).
-- Rôle de connexion de la passerelle : il N'A AUCUN droit direct sur les tables. Il peut seulement
--   1) prendre l'identité « authenticated » (SET ROLE) pour exécuter les requêtes AU NOM de l'utilisateur (RLS) ;
--   2) appeler app.auth_email_allowed (décider d'envoyer un lien de connexion).
-- Remplacez le mot de passe par une longue valeur aléatoire (32 caractères minimum) et gardez-la dans DATABASE_URL.
-- =============================================================================
create role gateway login password 'REMPLACER_PAR_UN_MOT_DE_PASSE_ALEATOIRE_LONG' noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant authenticated to gateway;                                  -- autorise SET ROLE authenticated (sans hériter de ses droits : NOINHERIT)
grant usage on schema app to gateway;
grant execute on function app.auth_email_allowed(text) to gateway;
alter role gateway set statement_timeout = '30s';
alter role gateway set idle_in_transaction_session_timeout = '30s';
