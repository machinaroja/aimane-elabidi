create schema tests;
create table tests.ctx (k text primary key, v text);
create table tests.results (name text, ok boolean);
grant usage on schema tests to authenticated;
grant all on tests.ctx, tests.results to authenticated;

create function tests.login(p_email text) returns void language plpgsql as $$
declare uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  if uid is null then raise exception 'utilisateur de test inconnu : %', p_email; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', p_email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function tests.logout() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', true); end $$;
create function tests.id(p_k text) returns uuid language sql as $$ select v::uuid from tests.ctx where k = p_k $$;
create function tests.put(p_k text, p_v text) returns void language sql as $$ insert into tests.ctx values (p_k, p_v) on conflict (k) do update set v = excluded.v $$;

-- ok / ko : on compte, on n'arrête qu'à la fin pour tout voir
create function tests.check(p_name text, p_cond boolean) returns void language plpgsql as $$
begin
  insert into tests.results values (p_name, coalesce(p_cond, false));
  if not coalesce(p_cond, false) then raise warning '❌ ÉCHEC : %', p_name; else raise notice '✔ %', p_name; end if;
end $$;
create function tests.eq(p_name text, p_got bigint, p_exp bigint) returns void language plpgsql as $$
begin perform tests.check(p_name || ' (obtenu ' || coalesce(p_got::text,'NULL') || ', attendu ' || p_exp || ')', p_got = p_exp); end $$;
-- l'instruction DOIT échouer (erreur de droits / contrainte)
create function tests.fails(p_name text, p_sql text) returns void language plpgsql as $$
declare ok boolean := false; st text := ''; msg text := '';
begin
  begin execute p_sql;
  exception when others then
    get stacked diagnostics st = returned_sqlstate, msg = message_text;
    -- seuls comptent les VRAIS refus : droits (42501), garde-fous métier (P0001), contraintes (23xxx).
    -- Une erreur de syntaxe / colonne inconnue (42xxx autres) ne prouve rien.
    ok := (st in ('42501','P0001') or st like '23%');
  end;
  perform tests.check(p_name || ' [refusé' || case when ok then '' else ' ? code ' || st || ' : ' || msg end || ']', ok);
end $$;
-- l'instruction ne doit toucher AUCUNE ligne (RLS filtre silencieusement)
create function tests.affects_none(p_name text, p_sql text) returns void language plpgsql as $$
declare n bigint;
begin
  begin execute p_sql; get diagnostics n = row_count; exception when others then n := 0; end;
  perform tests.check(p_name || ' [0 ligne touchée]', n = 0);
end $$;
create function tests.cnt(p_sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute 'select count(*) from (' || p_sql || ') q' into n; return n; end $$;
