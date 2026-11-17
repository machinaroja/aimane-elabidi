-- =============================================================================
-- VÉRIFICATION D'UN DÉPLOIEMENT : à exécuter après les migrations et la création du rôle « gateway ».
-- Toutes les lignes doivent afficher ok = true. Une ligne fausse = ne pas ouvrir le service tant que ce n'est pas corrigé.
-- =============================================================================
with checks(name, ok) as (values
  ('RLS activée sur TOUTES les tables du schéma public',
     (select count(*) = 0 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity)),
  ('anon : aucun droit sur les tables',
     (select count(*) = 0 from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public')),
  ('anon : aucune fonction exécutable (schémas public et app)',
     (select count(*) = 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','app') and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute'))),
  ('authenticated : aucun TRUNCATE / REFERENCES / TRIGGER',
     (select count(*) = 0 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER'))),
  ('authenticated : aucune écriture directe dans le journal d''audit ni dans les invitations',
     (select count(*) = 0 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name in ('audit_log','invitations','player_team_history') and privilege_type <> 'SELECT')),
  ('platform_admins illisible par authenticated',
     (select count(*) = 0 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name = 'platform_admins')),
  ('fonction interne app.auth_email_allowed fermée à anon et authenticated',
     not has_function_privilege('anon', 'app.auth_email_allowed(text)', 'execute') and not has_function_privilege('authenticated', 'app.auth_email_allowed(text)', 'execute')),
  ('rôle gateway : existe, peut se connecter, sans privilèges dangereux',
     (select count(*) = 1 from pg_roles where rolname = 'gateway' and rolcanlogin and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolinherit)),
  ('rôle gateway : membre de authenticated (SET ROLE possible)',
     exists (select 1 from pg_auth_members m join pg_roles r on r.oid = m.roleid join pg_roles g on g.oid = m.member where r.rolname = 'authenticated' and g.rolname = 'gateway')),
  ('rôle gateway : aucun droit direct sur les tables',
     (select count(*) = 0 from information_schema.role_table_grants where grantee = 'gateway' and table_schema = 'public')),
  ('rôle gateway : ne lit pas les joueurs directement', not has_table_privilege('gateway', 'public.players', 'select')),
  ('rôle gateway : peut appeler app.auth_email_allowed', has_function_privilege('gateway', 'app.auth_email_allowed(text)', 'execute')),
  ('schéma complet : tables clés présentes',
     (select count(*) = 8 from information_schema.tables where table_schema = 'public' and table_name in ('clubs','players','events','audit_log','evaluation_scores','team_objectives','methodology_versions','external_team_links'))),
  ('journal d''audit : déclencheur d''insertion seule en place',
     exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relname = 'audit_log' and t.tgname = 'audit_log_no_update')),
  ('immutabilité : évaluations finalisées et versions publiées protégées',
     (select count(*) = 3 from pg_trigger where tgname in ('evaluations_frozen','scores_frozen','methodology_immutable'))),
  ('au moins un club et un administrateur de club',
     exists (select 1 from public.clubs) and exists (select 1 from public.memberships where role_key = 'club_admin' and status = 'active')),
  ('aucun compte de démonstration en base',
     (select count(*) = 0 from auth.users where email like '%@demo.lieusaint.local'))
)
select name as controle, ok from checks order by ok, name;
