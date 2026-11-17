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

  -- noms d'affichage (fictifs) : chacun renseigne le sien
  perform dev.login('admin@demo.lieusaint.local');        update profiles set display_name = 'Admin Démo'               where id = auth.uid(); perform dev.logout();
  perform dev.login('dt@demo.lieusaint.local');           update profiles set display_name = 'Direction technique Démo' where id = auth.uid(); perform dev.logout();
  perform dev.login('resp-u14@demo.lieusaint.local');     update profiles set display_name = 'Responsable U14 Démo'     where id = auth.uid(); perform dev.logout();
  perform dev.login('coach-u14@demo.lieusaint.local');    update profiles set display_name = 'Coach U14 Démo'          where id = auth.uid(); perform dev.logout();
  perform dev.login('adjoint-u14@demo.lieusaint.local');  update profiles set display_name = 'Adjoint U14 Démo'        where id = auth.uid(); perform dev.logout();
  perform dev.login('coach-seniors1@demo.lieusaint.local'); update profiles set display_name = 'Coach Seniors 1 Démo'  where id = auth.uid(); perform dev.logout();

  -- entraînements des 4 dernières semaines : U14 1 (présences saisies), Seniors 1 (aucune présence saisie)
  declare d int; j int := 0; pids uuid[]; k int; st text; ev uuid;
  begin
    perform dev.login('coach-u14@demo.lieusaint.local');
    select array_agg(p.id order by p.last_name) into pids from players p join player_team_history h on h.player_id = p.id and h.team_id = t_u14 and h.ended_on is null;
    foreach d in array array[3,6,10,13,17,20,24,27] loop
      j := j + 1;
      ev := public.create_event(club, t_u14, 'training', 'Entraînement U14 1',
              ((current_date - d)::text || ' 18:30')::timestamp at time zone 'Europe/Paris', ((current_date - d)::text || ' 20:00')::timestamp at time zone 'Europe/Paris');
      for k in 1..array_length(pids, 1) loop
        st := case (k + j) % 7 when 0 then 'absent' when 1 then 'late' when 2 then 'excused' else 'present' end;
        perform public.record_attendance(ev, pids[k], st, case when st = 'late' then 10 end);
      end loop;
    end loop;
    perform dev.logout();
    perform dev.login('coach-seniors1@demo.lieusaint.local');
    foreach d in array array[2,5,9,12,16,19] loop
      perform public.create_event(club, t_s1, 'training', 'Entraînement Seniors 1',
              ((current_date - d)::text || ' 20:00')::timestamp at time zone 'Europe/Paris', ((current_date - d)::text || ' 21:30')::timestamp at time zone 'Europe/Paris');
    end loop;
    perform dev.logout();
  end;

  -- méthodologie : 3 contenus publiés ; lectures inégales ; une séance commune copiée par le coach U14
  declare it uuid; ve uuid; r record; vers uuid[] := '{}';
  begin
    perform dev.login('dt@demo.lieusaint.local');
    for r in select * from (values
        ('philosophy', 'Philosophie de jeu : Position — Possession — Pression', null::uuid, '{"Idée":"Trois piliers communs à toutes les catégories","Piliers":["Position","Possession","Pression"]}'::jsonb),
        ('principle',  'Pressing après perte', null, '{"Idée":"Presser dans les 5 secondes après la perte.","Consignes":["Fermer l''axe","Presser à deux"]}'::jsonb),
        ('reference_session', 'Séance de référence : conservation du ballon', (select category_id from teams where id = t_u14), '{"Objectif":"Conserver le ballon sous pression","Dispositif":"Jeu de position 4 contre 2 + 2 jokers"}'::jsonb)
      ) v(kind, title, cat, body)
    loop
      insert into methodology_items (club_id, kind, title, category_id, created_by) values (club, r.kind, r.title, r.cat, auth.uid()) returning id into it;
      insert into methodology_versions (club_id, item_id, body, change_note) values (club, it, r.body, 'Création') returning id into ve;
      perform public.publish_methodology_version(ve);
      vers := vers || ve;
    end loop;
    perform dev.logout();
    -- le coach U14 lit les 3 contenus et copie la séance de référence ; le coach Seniors 1 n'en lit qu'un ; l'adjoint aucun
    perform dev.login('coach-u14@demo.lieusaint.local');
    insert into methodology_reads (club_id, version_id) select club, unnest(vers);
    perform public.copy_to_personal((select item_id from methodology_versions where id = vers[3]), t_u14);
    perform dev.logout();
    perform dev.login('coach-seniors1@demo.lieusaint.local');
    insert into methodology_reads (club_id, version_id) values (club, vers[1]);
    perform dev.logout();
  end;
end $$;
