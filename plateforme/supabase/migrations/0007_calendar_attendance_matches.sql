-- =============================================================================
-- 0007 : calendrier central + conflits, présences/absences/retards, convocations,
--        matchs (composition, résultat, statistiques).
-- Même modèle de droits que le socle : lecture filtrée par la RLS, écriture par RPC.
-- =============================================================================

-- ---------- Nouvelles ressources de permission ------------------------------------
alter table public.role_permissions drop constraint role_permissions_resource_check;
alter table public.role_permissions add constraint role_permissions_resource_check check (resource in (
  'club','categories','teams','members','invitations','roles','players','guardians','observations',
  'methodology','personal_sessions','audit_log','reports',
  'calendar','attendance','convocations','matches','facilities'));

create or replace function app.seed_club_v2(p_club uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into role_permissions (club_id, role_key, resource, action)
  select p_club, 'club_admin', r, a
  from unnest(array['calendar','attendance','convocations','matches','facilities']) r,
       unnest(array['view','add','edit','delete','export','administer']) a
  on conflict do nothing;

  insert into role_permissions (club_id, role_key, resource, action)
  select p_club, k, r, a from (values
    ('direction','calendar','view'),('direction','attendance','view'),('direction','convocations','view'),
    ('direction','matches','view'),('direction','facilities','view'),
    ('directeur_technique','calendar','view'),('directeur_technique','calendar','add'),
    ('directeur_technique','calendar','edit'),('directeur_technique','calendar','administer'),
    ('directeur_technique','attendance','view'),('directeur_technique','convocations','view'),
    ('directeur_technique','matches','view'),
    ('directeur_technique','facilities','view'),('directeur_technique','facilities','add'),('directeur_technique','facilities','edit'),
    ('responsable_categorie','calendar','view'),('responsable_categorie','calendar','add'),('responsable_categorie','calendar','edit'),
    ('responsable_categorie','attendance','view'),('responsable_categorie','attendance','add'),('responsable_categorie','attendance','edit'),
    ('responsable_categorie','convocations','view'),('responsable_categorie','convocations','add'),('responsable_categorie','convocations','edit'),
    ('responsable_categorie','matches','view'),('responsable_categorie','matches','add'),('responsable_categorie','matches','edit'),
    ('responsable_categorie','facilities','view'),
    ('entraineur','calendar','view'),('entraineur','calendar','add'),('entraineur','calendar','edit'),
    ('entraineur','attendance','view'),('entraineur','attendance','add'),('entraineur','attendance','edit'),
    ('entraineur','convocations','view'),('entraineur','convocations','add'),('entraineur','convocations','edit'),
    ('entraineur','matches','view'),('entraineur','matches','add'),('entraineur','matches','edit'),
    ('entraineur','facilities','view'),
    ('adjoint','calendar','view'),('adjoint','attendance','view'),('adjoint','attendance','add'),
    ('adjoint','convocations','view'),('adjoint','matches','view'),('adjoint','facilities','view')
  ) v(k, r, a)
  on conflict do nothing;
end $$;
-- clubs déjà existants
do $$ declare c uuid; begin for c in select id from public.clubs loop perform app.seed_club_v2(c); end loop; end $$;

-- ---------- Installations et calendrier ---------------------------------------------
create table public.facilities (
  id       uuid primary key default gen_random_uuid(),
  club_id  uuid not null references public.clubs(id) on delete cascade,
  name     text not null,
  kind     text not null default 'pitch' check (kind in ('pitch','room','equipment','other')),
  unique (id, club_id),
  unique (club_id, name)
);
create table public.facility_closures (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null,
  facility_id uuid not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text not null,
  check (ends_at > starts_at),
  foreign key (facility_id, club_id) references public.facilities(id, club_id) on delete cascade
);
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null,
  team_id     uuid,                                   -- NULL = événement de club (réunion, tournoi…)
  kind        text not null check (kind in ('training','match','tournament','event','meeting')),
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  facility_id uuid,
  status      text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (id, club_id),
  foreign key (team_id, club_id)     references public.teams(id, club_id)      on delete cascade,
  foreign key (facility_id, club_id) references public.facilities(id, club_id) on delete set null (facility_id)
);
create index events_time on public.events (club_id, starts_at);
create index events_facility on public.events (facility_id, starts_at) where status = 'scheduled';

-- ---------- Présences, convocations, matchs -------------------------------------------
create table public.attendance_records (
  event_id    uuid not null,
  club_id     uuid not null,
  player_id   uuid not null,
  status      text not null check (status in ('present','absent','late','excused')),
  minutes_late int check (minutes_late is null or minutes_late between 0 and 240),
  note        text,
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  primary key (event_id, player_id),
  foreign key (event_id,  club_id) references public.events(id, club_id)  on delete cascade,
  foreign key (player_id, club_id) references public.players(id, club_id) on delete cascade
);
create table public.convocations (
  event_id     uuid not null,
  club_id      uuid not null,
  player_id    uuid not null,
  status       text not null default 'pending' check (status in ('pending','accepted','declined','maybe')),
  note         text,
  convoked_by  uuid references auth.users(id),
  responded_at timestamptz,
  primary key (event_id, player_id),
  foreign key (event_id,  club_id) references public.events(id, club_id)  on delete cascade,
  foreign key (player_id, club_id) references public.players(id, club_id) on delete cascade
);
create table public.match_details (
  event_id    uuid primary key,
  club_id     uuid not null,
  opponent    text not null,
  home_away   text not null check (home_away in ('home','away','neutral')),
  competition text,
  our_score   int check (our_score >= 0),
  their_score int check (their_score >= 0),
  lineup      jsonb not null default '[]'::jsonb,        -- liste d'identifiants de joueurs (composition)
  notes       text,
  foreign key (event_id, club_id) references public.events(id, club_id) on delete cascade
);
create table public.match_player_stats (
  event_id    uuid not null,
  club_id     uuid not null,
  player_id   uuid not null,
  minutes     int not null default 0 check (minutes between 0 and 150),
  goals       int not null default 0 check (goals >= 0),
  assists     int not null default 0 check (assists >= 0),
  yellow      int not null default 0 check (yellow between 0 and 2),
  red         int not null default 0 check (red between 0 and 1),
  primary key (event_id, player_id),
  foreign key (event_id,  club_id) references public.events(id, club_id)  on delete cascade,
  foreign key (player_id, club_id) references public.players(id, club_id) on delete cascade
);

-- ---------- Fonctions d'autorisation ----------------------------------------------------
-- Droit (ressource, action) lié à un événement : sur son équipe, ou sur le club si événement de club.
create or replace function app.event_perm(p_event uuid, p_resource text, p_action text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from events e where e.id = p_event
    and ((e.team_id is not null and app.has_perm(e.club_id, e.team_id, p_resource, p_action))
      or (e.team_id is null     and app.has_perm(e.club_id, null,      p_resource, p_action))));
$$;

-- Ce joueur appartenait-il à l'équipe de cet événement à sa date ?
create or replace function app.player_in_event_team(p_event uuid, p_player uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from events e join player_team_history h on h.team_id = e.team_id and h.club_id = e.club_id
    where e.id = p_event and h.player_id = p_player
      and h.started_on <= e.starts_at::date and (h.ended_on is null or h.ended_on >= e.starts_at::date));
$$;

-- Conflits de planning. Les messages restent GÉNÉRIQUES : on ne révèle pas le contenu
-- du planning d'une équipe qu'on n'a pas le droit de voir.
create or replace function app.find_conflicts(p_club uuid, p_facility uuid, p_team uuid, p_start timestamptz, p_end timestamptz, p_exclude uuid)
returns table (kind text, detail text) language sql stable security definer set search_path = public, pg_temp as $$
  select 'facility_closed', 'Installation indisponible : ' || c.reason
    from facility_closures c
   where c.club_id = p_club and p_facility is not null and c.facility_id = p_facility
     and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_start, p_end)
  union all
  select 'team_busy', 'Cette équipe a déjà un événement sur ce créneau'
    from events e
   where e.club_id = p_club and p_team is not null and e.team_id = p_team and e.status = 'scheduled'
     and e.id is distinct from p_exclude and tstzrange(e.starts_at, e.ends_at) && tstzrange(p_start, p_end)
  union all
  select 'facility_busy', 'Cette installation est déjà réservée sur ce créneau'
    from events e
   where e.club_id = p_club and p_facility is not null and e.facility_id = p_facility and e.status = 'scheduled'
     and e.id is distinct from p_exclude and tstzrange(e.starts_at, e.ends_at) && tstzrange(p_start, p_end);
$$;

-- Utilisée par les politiques RLS : seule fonction de ce fichier à exposer.
grant execute on function app.event_perm(uuid, text, text) to authenticated;

-- ---------- Politiques (lecture seule en direct ; écriture par RPC) -----------------------
do $$ declare t text; begin
  foreach t in array array['facilities','facility_closures','events','attendance_records','convocations','match_details','match_player_stats']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

create policy facilities_select on public.facilities for select to authenticated using (app.is_member(club_id));
create policy facilities_insert on public.facilities for insert to authenticated with check (app.has_perm(club_id, null, 'facilities', 'add'));
create policy facilities_update on public.facilities for update to authenticated
  using (app.has_perm(club_id, null, 'facilities', 'edit')) with check (app.has_perm(club_id, null, 'facilities', 'edit'));
create policy facilities_delete on public.facilities for delete to authenticated using (app.has_perm(club_id, null, 'facilities', 'delete'));
create policy closures_select on public.facility_closures for select to authenticated using (app.is_member(club_id));
create policy closures_insert on public.facility_closures for insert to authenticated with check (app.has_perm(club_id, null, 'facilities', 'edit'));
create policy closures_delete on public.facility_closures for delete to authenticated using (app.has_perm(club_id, null, 'facilities', 'edit'));

create policy events_select on public.events for select to authenticated using (
  (team_id is not null and app.has_perm(club_id, team_id, 'calendar', 'view'))
  or (team_id is null and app.is_member(club_id)));
create policy attendance_select on public.attendance_records for select to authenticated using (app.event_perm(event_id, 'attendance', 'view'));
create policy convocations_select on public.convocations for select to authenticated using (app.event_perm(event_id, 'convocations', 'view'));
create policy match_details_select on public.match_details for select to authenticated using (app.event_perm(event_id, 'matches', 'view'));
create policy match_stats_select on public.match_player_stats for select to authenticated using (app.event_perm(event_id, 'matches', 'view'));

revoke all on public.facilities, public.facility_closures, public.events, public.attendance_records,
  public.convocations, public.match_details, public.match_player_stats from anon, public;
grant select on public.events, public.attendance_records, public.convocations, public.match_details, public.match_player_stats to authenticated;
grant select, insert, update, delete on public.facilities, public.facility_closures to authenticated;

-- ---------- RPC : calendrier ---------------------------------------------------------------
create or replace function public.create_event(p_club uuid, p_team uuid, p_kind text, p_title text,
  p_start timestamptz, p_end timestamptz, p_facility uuid default null, p_force boolean default false)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; c record; v_hard text := ''; v_soft text := '';
begin
  if (p_team is not null and not app.has_perm(p_club, p_team, 'calendar', 'add'))
     or (p_team is null and not app.has_perm(p_club, null, 'calendar', 'add')) then
    raise exception 'création d''événement refusée' using errcode = '42501';
  end if;
  for c in select * from app.find_conflicts(p_club, p_facility, p_team, p_start, p_end, null) loop
    if c.kind = 'facility_busy' then v_soft := v_soft || c.detail || '. '; else v_hard := v_hard || c.detail || '. '; end if;
  end loop;
  if v_hard <> '' then raise exception 'conflit : %', v_hard; end if;
  if v_soft <> '' and not (p_force and app.has_perm(p_club, null, 'calendar', 'administer')) then
    raise exception 'conflit : % (seule la direction technique peut forcer)', v_soft;
  end if;
  insert into events (club_id, team_id, kind, title, starts_at, ends_at, facility_id, created_by)
  values (p_club, p_team, p_kind, p_title, p_start, p_end, p_facility, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.reschedule_event(p_event uuid, p_start timestamptz, p_end timestamptz, p_facility uuid default null, p_force boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare e events%rowtype; c record; v_hard text := ''; v_soft text := '';
begin
  select * into e from events where id = p_event;
  if not found or not app.event_perm(p_event, 'calendar', 'edit') then raise exception 'modification refusée' using errcode = '42501'; end if;
  for c in select * from app.find_conflicts(e.club_id, p_facility, e.team_id, p_start, p_end, p_event) loop
    if c.kind = 'facility_busy' then v_soft := v_soft || c.detail || '. '; else v_hard := v_hard || c.detail || '. '; end if;
  end loop;
  if v_hard <> '' then raise exception 'conflit : %', v_hard; end if;
  if v_soft <> '' and not (p_force and app.has_perm(e.club_id, null, 'calendar', 'administer')) then
    raise exception 'conflit : % (seule la direction technique peut forcer)', v_soft;
  end if;
  update events set starts_at = p_start, ends_at = p_end, facility_id = p_facility where id = p_event;
end $$;

create or replace function public.cancel_event(p_event uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.event_perm(p_event, 'calendar', 'edit') then raise exception 'annulation refusée' using errcode = '42501'; end if;
  update events set status = 'cancelled' where id = p_event;
end $$;

-- ---------- RPC : présences ------------------------------------------------------------------
create or replace function public.record_attendance(p_event uuid, p_player uuid, p_status text, p_minutes_late int default null, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club uuid;
begin
  select club_id into v_club from events where id = p_event;
  if v_club is null or not app.event_perm(p_event, 'attendance', 'add') then
    raise exception 'saisie de présence refusée' using errcode = '42501';
  end if;
  if not app.player_in_event_team(p_event, p_player) then
    raise exception 'ce joueur n''appartient pas à l''équipe de cet événement' using errcode = '42501';
  end if;
  insert into attendance_records (event_id, club_id, player_id, status, minutes_late, note, recorded_by)
  values (p_event, v_club, p_player, p_status, case when p_status = 'late' then p_minutes_late end, p_note, auth.uid())
  on conflict (event_id, player_id) do update
    set status = excluded.status, minutes_late = excluded.minutes_late, note = excluded.note,
        recorded_by = excluded.recorded_by, recorded_at = now();
end $$;

-- ---------- RPC : convocations -----------------------------------------------------------------
create or replace function public.convoke_players(p_event uuid, p_players uuid[]) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club uuid; p uuid; n int := 0;
begin
  select club_id into v_club from events where id = p_event;
  if v_club is null or not app.event_perm(p_event, 'convocations', 'add') then
    raise exception 'convocation refusée' using errcode = '42501';
  end if;
  foreach p in array p_players loop
    if not app.player_in_event_team(p_event, p) then
      raise exception 'un joueur convoqué n''appartient pas à cette équipe' using errcode = '42501';
    end if;
    insert into convocations (event_id, club_id, player_id, convoked_by) values (p_event, v_club, p, auth.uid()) on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.set_convocation_response(p_event uuid, p_player uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.event_perm(p_event, 'convocations', 'edit') then raise exception 'réponse refusée' using errcode = '42501'; end if;
  update convocations set status = p_status, note = p_note, responded_at = now() where event_id = p_event and player_id = p_player;
  if not found then raise exception 'joueur non convoqué'; end if;
end $$;

-- ---------- RPC : matchs -------------------------------------------------------------------------
create or replace function public.save_match(p_event uuid, p_opponent text, p_home_away text, p_competition text default null,
  p_our int default null, p_their int default null, p_lineup uuid[] default '{}', p_notes text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare e events%rowtype; p uuid; v_exists boolean;
begin
  select * into e from events where id = p_event;
  if not found or e.kind <> 'match' then raise exception 'cet événement n''est pas un match'; end if;
  select exists (select 1 from match_details where event_id = p_event) into v_exists;
  if not app.event_perm(p_event, 'matches', case when v_exists then 'edit' else 'add' end) then
    raise exception 'saisie de match refusée' using errcode = '42501';
  end if;
  foreach p in array p_lineup loop
    if not app.player_in_event_team(p_event, p) then
      raise exception 'composition : un joueur n''appartient pas à cette équipe' using errcode = '42501';
    end if;
  end loop;
  insert into match_details (event_id, club_id, opponent, home_away, competition, our_score, their_score, lineup, notes)
  values (p_event, e.club_id, p_opponent, p_home_away, p_competition, p_our, p_their, to_jsonb(p_lineup), p_notes)
  on conflict (event_id) do update set opponent = excluded.opponent, home_away = excluded.home_away,
    competition = excluded.competition, our_score = excluded.our_score, their_score = excluded.their_score,
    lineup = excluded.lineup, notes = excluded.notes;
end $$;

create or replace function public.record_match_stats(p_event uuid, p_player uuid, p_minutes int, p_goals int default 0,
  p_assists int default 0, p_yellow int default 0, p_red int default 0)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club uuid;
begin
  select club_id into v_club from events where id = p_event and kind = 'match';
  if v_club is null or not app.event_perm(p_event, 'matches', 'edit') then raise exception 'statistiques refusées' using errcode = '42501'; end if;
  if not app.player_in_event_team(p_event, p_player) then raise exception 'joueur hors équipe' using errcode = '42501'; end if;
  insert into match_player_stats (event_id, club_id, player_id, minutes, goals, assists, yellow, red)
  values (p_event, v_club, p_player, p_minutes, p_goals, p_assists, p_yellow, p_red)
  on conflict (event_id, player_id) do update set minutes = excluded.minutes, goals = excluded.goals,
    assists = excluded.assists, yellow = excluded.yellow, red = excluded.red;
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'public.create_event(uuid,uuid,text,text,timestamptz,timestamptz,uuid,boolean)',
    'public.reschedule_event(uuid,timestamptz,timestamptz,uuid,boolean)','public.cancel_event(uuid)',
    'public.record_attendance(uuid,uuid,text,int,text)','public.convoke_players(uuid,uuid[])',
    'public.set_convocation_response(uuid,uuid,text,text)',
    'public.save_match(uuid,text,text,text,int,int,uuid[],text)',
    'public.record_match_stats(uuid,uuid,int,int,int,int,int)']
  loop execute format('revoke all on function %s from public, anon', f); execute format('grant execute on function %s to authenticated', f); end loop;
end $$;

-- ---------- Audit : nouvelles tables (notes de présence = données sensibles → noms de champs seulement) ----
create or replace function app.audit() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row jsonb; v_old jsonb; v_new jsonb; v_club uuid; v_id text;
  v_sensitive boolean := tg_table_name in ('players','player_contacts','player_observations','attendance_records','convocations','match_player_stats');
begin
  v_row := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_club := nullif(v_row ->> 'club_id','')::uuid;
  if tg_table_name = 'clubs' then v_club := (v_row ->> 'id')::uuid; end if;
  v_id := coalesce(v_row ->> 'id', v_row ->> 'event_id', v_row ->> 'user_id');
  if v_sensitive then
    if tg_op = 'UPDATE' then
      v_new := (select coalesce(jsonb_object_agg(k, true), '{}'::jsonb)
                from jsonb_each(to_jsonb(new)) n(k, v) where to_jsonb(old) -> k is distinct from v);
    end if;
  else
    v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
    v_new := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  end if;
  if tg_table_name = 'invitations' then v_old := v_old - 'token_hash'; v_new := v_new - 'token_hash'; end if;
  insert into audit_log (club_id, actor_id, action, table_name, row_id, old_data, new_data)
  values (v_club, auth.uid(), tg_op, tg_table_name, v_id, v_old, v_new);
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['facilities','facility_closures','events','attendance_records','convocations','match_details','match_player_stats']
  loop execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function app.audit()', t); end loop;
end $$;
