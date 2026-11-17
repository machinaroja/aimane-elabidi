-- =============================================================================
-- DONNÉES DE DÉMONSTRATION (développement local uniquement — comptes fictifs @demo.lieusaint.local)
-- Structure réelle du club (16 équipes) + vrai calendrier officiel (instantané SportCorico).
-- À lancer APRÈS 00_auth_shim + migrations (voir ../../dev.sh). Jamais en production.
-- =============================================================================
\set payload `cat tests/fixtures/sportcorico_as_lieusaint.json`
create schema if not exists dev;
create table if not exists dev.ctx (k text primary key, v text);
insert into dev.ctx values ('payload', :'payload'::text) on conflict (k) do update set v = excluded.v;

insert into auth.users (email) values
  ('operateur@demo.lieusaint.local'), ('admin@demo.lieusaint.local'), ('dt@demo.lieusaint.local'),
  ('resp-u14@demo.lieusaint.local'), ('coach-u14@demo.lieusaint.local'), ('coach-seniors1@demo.lieusaint.local'),
  ('adjoint-u14@demo.lieusaint.local'), ('inconnu@demo.lieusaint.local')
on conflict do nothing;
insert into platform_admins select id from auth.users where email = 'operateur@demo.lieusaint.local' on conflict do nothing;

create or replace function dev.login(p_email text) returns void language plpgsql as $$
declare uid uuid; begin
  select id into uid from auth.users where email = p_email;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', p_email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated'; end $$;
create or replace function dev.logout() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', true); end $$;
grant usage on schema dev to authenticated; grant all on dev.ctx to authenticated;
grant execute on all functions in schema dev to authenticated;

do $$
declare club uuid; r jsonb; pl jsonb := (select v::jsonb from dev.ctx where k = 'payload');
  t_u14 uuid; t_s1 uuid; tok text; p uuid; e uuid; i int;
  firsts text[] := array['Adam','Lina','Hugo','Inès','Noah','Jade','Léo','Mila','Ethan','Zoé','Nolan','Alice'];
  lasts  text[] := array['Demo-A','Demo-B','Demo-C','Demo-D','Demo-E','Demo-F','Demo-G','Demo-H','Demo-I','Demo-J','Demo-K','Demo-L'];
begin
  perform dev.login('operateur@demo.lieusaint.local');
  club := public.create_club('AS Lieusaint (démo)', 'as-lieusaint-demo', '2026-2027', '2026-07-01', '2027-06-30');
  r := public.import_external_calendar(club, 'sportcorico', pl, true);
  raise notice 'Import : %', r;
  select team_id into t_u14 from external_team_links where external_key = 'lieusaint-foot-as-4';
  select team_id into t_s1  from external_team_links where external_key = 'lieusaint-foot-as-1';
  perform public.seed_methodology_defaults(club);
  -- invitations des comptes de démonstration
  insert into dev.ctx values
    ('tok_admin', public.create_invitation(club, 'admin@demo.lieusaint.local', 'direction')),
    ('tok_dt',    public.create_invitation(club, 'dt@demo.lieusaint.local', 'directeur_technique')),
    ('tok_resp',  public.create_invitation(club, 'resp-u14@demo.lieusaint.local', 'responsable_categorie', null, (select category_id from teams where id = t_u14))),
    ('tok_c14',   public.create_invitation(club, 'coach-u14@demo.lieusaint.local', 'entraineur', t_u14)),
    ('tok_adj',   public.create_invitation(club, 'adjoint-u14@demo.lieusaint.local', 'adjoint', t_u14)),
    ('tok_cs1',   public.create_invitation(club, 'coach-seniors1@demo.lieusaint.local', 'entraineur', t_s1))
  on conflict (k) do nothing;
  perform dev.logout();
  perform dev.login('admin@demo.lieusaint.local');     perform public.accept_invitation((select v from dev.ctx where k = 'tok_admin')); perform dev.logout();
  perform dev.login('dt@demo.lieusaint.local');        perform public.accept_invitation((select v from dev.ctx where k = 'tok_dt'));    perform dev.logout();
  perform dev.login('resp-u14@demo.lieusaint.local');  perform public.accept_invitation((select v from dev.ctx where k = 'tok_resp')); perform dev.logout();
  perform dev.login('coach-u14@demo.lieusaint.local'); perform public.accept_invitation((select v from dev.ctx where k = 'tok_c14'));  perform dev.logout();
  perform dev.login('adjoint-u14@demo.lieusaint.local'); perform public.accept_invitation((select v from dev.ctx where k = 'tok_adj')); perform dev.logout();
  perform dev.login('coach-seniors1@demo.lieusaint.local'); perform public.accept_invitation((select v from dev.ctx where k = 'tok_cs1')); perform dev.logout();

  -- effectif fictif de U14 1 (noms clairement fictifs)
  perform dev.login('coach-u14@demo.lieusaint.local');
  for i in 1..12 loop perform public.add_player(t_u14, firsts[i], lasts[i], date '2012-01-01' + (i * 23), null); end loop;
  perform dev.logout();
  update player_team_history set started_on = '2026-07-01' where team_id = t_u14;
end $$;
