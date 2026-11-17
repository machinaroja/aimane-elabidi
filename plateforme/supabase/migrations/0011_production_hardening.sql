-- =============================================================================
-- 0011 : durcissement pour la production (Supabase).
--  * Supabase accorde par défaut EXECUTE sur toute nouvelle fonction du schéma « public » à anon / authenticated /
--    service_role (privilèges par défaut du schéma). On referme tout, puis on ré-ouvre explicitement aux seuls
--    utilisateurs connectés les fonctions publiques (RPC), jamais à « anon ».
--  * Les tables ne sont jamais accessibles à « anon ».
--  * app.auth_email_allowed : décide si une adresse peut recevoir un lien de connexion (invitée ou déjà membre).
--    Exécutable UNIQUEMENT par le rôle de connexion de la passerelle, pas par les utilisateurs.
-- =============================================================================

-- 1) Privilèges par défaut futurs (schéma public) : plus rien pour anon / public.
do $$ begin
  begin execute 'alter default privileges in schema public revoke execute on functions from anon, public'; exception when others then null; end;
  begin execute 'alter default privileges in schema public revoke all on tables from anon';              exception when others then null; end;
  begin execute 'alter default privileges in schema public revoke all on sequences from anon';           exception when others then null; end;
end $$;

-- 2) Fonctions existantes : fermées à anon / public.
revoke execute on all functions in schema public from anon, public;

-- 2 bis) TABLES : moindre privilège EXPLICITE. Supabase accorde ALL (donc TRUNCATE, qui ignore la RLS) à « authenticated »
--        sur chaque nouvelle table : on retire tout, puis on accorde uniquement lecture (filtrée par la RLS) et les
--        écritures directes réellement prévues. Tout le reste passe par des fonctions (RPC) contrôlées.
do $$ begin
  begin execute 'alter default privileges in schema public revoke all on tables from authenticated';    exception when others then null; end;
  begin execute 'alter default privileges in schema public revoke all on sequences from authenticated'; exception when others then null; end;
end $$;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;                  -- la RLS filtre les lignes
revoke select on public.platform_admins from authenticated;                    -- jamais lisible
do $$ declare r record; begin
  for r in select * from (values
    ('profiles','insert, update'), ('seasons','insert, update, delete'), ('categories','insert, update, delete'), ('teams','insert, update, delete'),
    ('club_roles','insert, update, delete'), ('role_permissions','insert, update, delete'), ('memberships','update, delete'), ('assignments','insert, delete'),
    ('players','insert, update, delete'), ('player_contacts','insert, update, delete'), ('player_observations','insert, update, delete'), ('observation_shares','insert, delete'),
    ('methodology_items','insert, update, delete'), ('methodology_versions','insert, update, delete'), ('methodology_reads','insert'),
    ('personal_sessions','insert, update, delete'), ('session_recommendations','insert'),
    ('facilities','insert, update, delete'), ('facility_closures','insert, delete'), ('external_team_links','insert, update, delete'),
    ('criteria','insert, update, delete'), ('team_objectives','insert, update, delete'), ('objective_notes','insert'), ('team_evaluations','delete')
  ) v(t, p) loop execute format('grant %s on public.%I to authenticated', r.p, r.t); end loop;
end $$;
grant update (name) on public.clubs to authenticated;                          -- seul le nom du club est modifiable directement

-- 3) Ré-ouverture explicite aux utilisateurs connectés : uniquement les fonctions du schéma public
--    qui sont des RPC métier (SECURITY DEFINER, créées par nos migrations).
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and p.proname !~ '^(pg_|gen_|digest|hmac|crypt)' loop
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- 4) Autorisation d'envoi d'un lien de connexion (appelée par la passerelle, jamais par un navigateur).
create or replace function app.auth_email_allowed(p_email text) returns boolean
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists (select 1 from invitations i
                 where i.email = lower(trim(p_email)) and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
      or exists (select 1 from memberships m join auth.users u on u.id = m.user_id
                 where lower(u.email) = lower(trim(p_email)) and m.status = 'active');
$$;
revoke all on function app.auth_email_allowed(text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'gateway') then
    execute 'grant usage on schema app to gateway';
    execute 'grant execute on function app.auth_email_allowed(text) to gateway';
  end if;
end $$;
