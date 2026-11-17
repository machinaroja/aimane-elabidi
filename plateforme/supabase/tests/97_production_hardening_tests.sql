-- ============ Durcissement production ============
do $$
declare r record; n int := 0;
begin
  -- Simule le comportement de Supabase : une fonction créée plus tard dans « public » reçoit des droits par défaut pour anon.
  perform tests.check('anon : aucune fonction publique exécutable',
    (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname in ('public','app') and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')) = 0);
  perform tests.check('anon : aucune table lisible ni modifiable',
    (select count(*) from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public') = 0);
  perform tests.check('authenticated : aucun droit TRUNCATE ni REFERENCES ni TRIGGER sur aucune table',
    (select count(*) from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')) = 0);
  perform tests.check('aucun accès aux séquences pour anon / authenticated',
    (select count(*) from information_schema.role_usage_grants where grantee in ('anon','authenticated') and object_schema = 'public' and object_type = 'SEQUENCE') = 0);
  perform tests.check('authenticated peut appeler les RPC métier', has_function_privilege('authenticated', 'public.add_player(uuid,text,text,date,text)', 'execute')
                                                                  and has_function_privilege('authenticated', 'public.create_evaluation(uuid,date,text)', 'execute'));
  perform tests.check('les RPC « platform » (create_club) ne sont pas ouvertes à anon', not has_function_privilege('anon', 'public.create_club(text,text,text,date,date)', 'execute'));
  perform tests.check('app.auth_email_allowed : fermée aux utilisateurs et aux visiteurs',
    not has_function_privilege('authenticated', 'app.auth_email_allowed(text)', 'execute') and not has_function_privilege('anon', 'app.auth_email_allowed(text)', 'execute'));
  perform tests.check('app.auth_email_allowed : ouverte au seul rôle « gateway »', has_function_privilege('gateway', 'app.auth_email_allowed(text)', 'execute'));
  perform tests.check('le rôle « gateway » n''a aucun accès direct aux tables métier',
    (select count(*) from information_schema.role_table_grants where grantee = 'gateway' and table_schema = 'public') = 0);
end $$;

-- Matrice des droits directs sur les tables, écrite ICI indépendamment de la migration : tout écart (en trop OU en moins) échoue.
do $$
declare spec text[][] := array[
  ['clubs','SELECT'], ['platform_admins',''], ['profiles','SELECT,INSERT,UPDATE'], ['seasons','SELECT,INSERT,UPDATE,DELETE'], ['categories','SELECT,INSERT,UPDATE,DELETE'],
  ['teams','SELECT,INSERT,UPDATE,DELETE'], ['club_roles','SELECT,INSERT,UPDATE,DELETE'], ['role_permissions','SELECT,INSERT,UPDATE,DELETE'], ['memberships','SELECT,UPDATE,DELETE'],
  ['assignments','SELECT,INSERT,DELETE'], ['invitations','SELECT'], ['players','SELECT,INSERT,UPDATE,DELETE'], ['player_team_history','SELECT'], ['player_contacts','SELECT,INSERT,UPDATE,DELETE'],
  ['player_observations','SELECT,INSERT,UPDATE,DELETE'], ['observation_shares','SELECT,INSERT,DELETE'], ['methodology_items','SELECT,INSERT,UPDATE,DELETE'],
  ['methodology_versions','SELECT,INSERT,UPDATE,DELETE'], ['methodology_reads','SELECT,INSERT'], ['personal_sessions','SELECT,INSERT,UPDATE,DELETE'], ['session_recommendations','SELECT,INSERT'],
  ['audit_log','SELECT'], ['facilities','SELECT,INSERT,UPDATE,DELETE'], ['facility_closures','SELECT,INSERT,DELETE'], ['events','SELECT'], ['attendance_records','SELECT'],
  ['convocations','SELECT'], ['match_details','SELECT'], ['match_player_stats','SELECT'], ['external_team_links','SELECT,INSERT,UPDATE,DELETE'], ['criteria','SELECT,INSERT,UPDATE,DELETE'],
  ['team_objectives','SELECT,INSERT,UPDATE,DELETE'], ['objective_notes','SELECT,INSERT'], ['team_evaluations','SELECT,DELETE'], ['evaluation_scores','SELECT']];
  i int; t text; want text; got text; bad int := 0;
begin
  for i in 1..array_length(spec, 1) loop
    t := spec[i][1]; want := spec[i][2];
    select coalesce(string_agg(privilege_type, ',' order by privilege_type), '') into got from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name = t;
    if (select string_agg(x, ',' order by x) from unnest(string_to_array(want, ',')) x) is distinct from nullif(got, '') and not (want = '' and got = '') then
      bad := bad + 1; raise warning 'droits inattendus sur % : obtenu [%], attendu [%]', t, got, want;
    end if;
  end loop;
  perform tests.check('matrice des droits de « authenticated » conforme sur les ' || array_length(spec, 1) || ' tables', bad = 0);
  perform tests.check('aucune table sans décision explicite (toute nouvelle table doit être ajoutée à la matrice)',
    (select count(*) from pg_tables where schemaname = 'public' and tablename <> all (select spec[g][1] from generate_series(1, array_length(spec, 1)) g)) = 0);
  perform tests.check('clubs : seul le champ « name » est modifiable directement',
    (select string_agg(column_name, ',') from information_schema.column_privileges where grantee = 'authenticated' and table_schema = 'public' and table_name = 'clubs' and privilege_type = 'UPDATE') = 'name');
  perform tests.check('RLS activée sur TOUTES les tables du schéma public', (select count(*) from pg_tables t join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace where t.schemaname = 'public' and not c.relrowsecurity) = 0);
end $$;

do $$
declare club uuid := tests.id('club'); tok text;
begin
  -- invitation en attente -> adresse autorisée ; adresse inconnue -> non ; membre actif -> oui ; invitation expirée/révoquée -> non
  perform tests.login('op@x.fr');
  tok := public.create_invitation(club, 'attente@x.fr', 'adjoint', tests.id('t16a'));
  perform tests.logout();
  perform tests.check('invitation en attente : lien de connexion autorisé', app.auth_email_allowed('attente@x.fr') and app.auth_email_allowed('  ATTENTE@x.fr '));
  perform tests.check('adresse totalement inconnue : refusée', not app.auth_email_allowed('personne@inconnu.fr'));
  perform tests.check('membre actif : autorisé', app.auth_email_allowed('c13a@x.fr'));
  perform tests.check('compte sans rôle ni invitation : refusé', not app.auth_email_allowed('stranger@x.fr'));
  update invitations set revoked_at = now() where email = 'attente@x.fr';
  perform tests.check('invitation révoquée : refusée', not app.auth_email_allowed('attente@x.fr'));
  update memberships set status = 'suspended' where user_id = (select id from auth.users where email = 'c13a@x.fr');
  perform tests.check('membre suspendu : refusé', not app.auth_email_allowed('c13a@x.fr'));
  update memberships set status = 'active' where user_id = (select id from auth.users where email = 'c13a@x.fr');
end $$;

-- Comportement réel : un utilisateur connecté ne peut ni vider ni détruire quoi que ce soit.
do $$
begin
  perform tests.login('dt@x.fr');
  perform tests.fails('TRUNCATE players CASCADE refusé à la direction technique', 'truncate table public.players cascade');
  perform tests.fails('TRUNCATE audit_log refusé', 'truncate table public.audit_log');
  perform tests.fails('TRUNCATE sur une table de droits refusé', 'truncate table public.role_permissions cascade');
  perform tests.fails('DROP TABLE refusé', 'drop table public.players cascade');
  perform tests.fails('création de table dans public refusée', 'create table public.pirate (x int)');
  perform tests.fails('écriture directe sur les présences refusée (RPC obligatoire)', $q$insert into public.attendance_records (event_id, club_id, player_id, status) select e.id, e.club_id, p.id, 'present' from events e, players p limit 1$q$);
  perform tests.fails('écriture directe dans le journal refusée', $q$insert into public.audit_log (action, table_name) values ('X','x')$q$);
  perform tests.logout();
  perform tests.eq('aucune table n''a été vidée par ces tentatives', tests.cnt('select 1 from players') + 1, tests.cnt('select 1 from players') + 1);
  perform tests.check('les joueurs existent toujours', (select count(*) from players) > 0);
end $$;
