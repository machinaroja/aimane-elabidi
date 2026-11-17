-- =============================================================================
-- 0008 : import du calendrier OFFICIEL (matchs de championnat et coupes) depuis une source
--        externe (SportCorico). Idempotent : une synchronisation répétée met à jour, ne duplique pas.
--  * un match officiel est un événement « match » marqué (external_source, external_id) ;
--  * son planning (date, heure, adversaire, compétition) appartient à la source : un éducateur ne peut
--    ni le déplacer, ni l'annuler ;
--  * la composition, les convocations, les notes et les présences restent à l'éducateur et ne sont
--    JAMAIS écrasées par la synchronisation ;
--  * l'heure des matchs passés est inconnue de la source : time_known = false (midi, heure de Paris).
-- =============================================================================

alter table public.events
  add column external_source text,
  add column external_id     text,
  add column time_known      boolean not null default true,
  add column competition     text;
create unique index events_external_uniq on public.events (club_id, external_source, external_id) where external_id is not null;

alter table public.match_details
  add column status        text not null default 'scheduled' check (status in ('scheduled','played','forfeit')),
  add column forfeit_by_us boolean;

-- Correspondance équipe de la plateforme <-> équipe de la source
create table public.external_team_links (
  club_id      uuid not null,
  team_id      uuid not null,
  source       text not null,
  external_key text not null,
  label        text not null,
  primary key (team_id, source),
  unique (club_id, source, external_key),
  foreign key (team_id, club_id) references public.teams(id, club_id) on delete cascade
);
alter table public.external_team_links enable row level security;
create policy etl_select on public.external_team_links for select to authenticated using (app.has_perm(club_id, null, 'calendar', 'administer'));
create policy etl_write  on public.external_team_links for all to authenticated
  using (app.has_perm(club_id, null, 'calendar', 'administer')) with check (app.has_perm(club_id, null, 'calendar', 'administer'));
create trigger audit_external_team_links after insert or update or delete on public.external_team_links
  for each row execute function app.audit();

-- Le planning officiel n'est modifiable ni par déplacement ni par annulation.
create or replace function public.reschedule_event(p_event uuid, p_start timestamptz, p_end timestamptz, p_facility uuid default null, p_force boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare e events%rowtype; c record; v_hard text := ''; v_soft text := '';
begin
  select * into e from events where id = p_event;
  if not found or not app.event_perm(p_event, 'calendar', 'edit') then raise exception 'modification refusée' using errcode = '42501'; end if;
  if e.external_id is not null then raise exception 'match officiel : date et heure fixées par la compétition (non modifiables)' using errcode = '42501'; end if;
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
  if exists (select 1 from events where id = p_event and external_id is not null) then
    raise exception 'match officiel : seule la compétition peut l''annuler ou le reporter' using errcode = '42501';
  end if;
  update events set status = 'cancelled' where id = p_event;
end $$;

-- Noyau d'import (fonction interne : service / propriétaire uniquement).
create or replace function app.import_external_calendar(p_club uuid, p_source text, p_payload jsonb, p_create_structure boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_season uuid; t jsonb; m jsonb; v_team uuid; v_cat uuid; v_label text; v_words text[]; v_team_name text; v_cat_name text;
  v_start timestamptz; v_event uuid; v_ins boolean;
  r_teams_created int := 0; r_cats_created int := 0; r_ins int := 0; r_upd int := 0; r_unlinked jsonb := '[]'::jsonb; r_byes int := 0;
  v_us_score int; v_their_score int; v_home boolean;
begin
  select id into v_season from seasons where club_id = p_club and is_current;
  for t in select * from jsonb_array_elements(p_payload -> 'teams') loop
    select team_id into v_team from external_team_links where club_id = p_club and source = p_source and external_key = t ->> 'external_key';
    if v_team is null then
      if not p_create_structure or v_season is null then
        r_unlinked := r_unlinked || to_jsonb(t ->> 'label'); continue;
      end if;
      -- « U14 1 » -> catégorie « U14 », équipe « 1 » ; « SENIORS FÉMININES 1 » -> « Seniors Féminines », « 1 »
      v_label := trim(t ->> 'label'); v_words := regexp_split_to_array(v_label, '\s+');
      v_team_name := v_words[array_length(v_words, 1)];
      v_cat_name := trim(array_to_string(v_words[1:array_length(v_words, 1) - 1], ' '));
      if v_cat_name = '' then v_cat_name := v_label; v_team_name := 'A'; end if;
      v_cat_name := case when v_cat_name ~* '^u[0-9]+$' then upper(v_cat_name) else initcap(lower(v_cat_name)) end;
      select id into v_cat from categories where club_id = p_club and lower(name) = lower(v_cat_name);
      if v_cat is null then insert into categories (club_id, name) values (p_club, v_cat_name) returning id into v_cat; r_cats_created := r_cats_created + 1; end if;
      select id into v_team from teams where club_id = p_club and season_id = v_season and category_id = v_cat and name = v_team_name;
      if v_team is null then insert into teams (club_id, season_id, category_id, name) values (p_club, v_season, v_cat, v_team_name) returning id into v_team; r_teams_created := r_teams_created + 1; end if;
      insert into external_team_links (club_id, team_id, source, external_key, label) values (p_club, v_team, p_source, t ->> 'external_key', v_label);
    end if;

    r_byes := r_byes + coalesce(jsonb_array_length(t -> 'byes'), 0);
    for m in select * from jsonb_array_elements(t -> 'matches') loop
      v_home := (m ->> 'home_is_us')::boolean;
      v_start := case when m ->> 'time' is not null
                      then ((m ->> 'date') || ' ' || (m ->> 'time'))::timestamp at time zone 'Europe/Paris'
                      else ((m ->> 'date') || ' 12:00')::timestamp at time zone 'Europe/Paris' end;
      insert into events (club_id, team_id, kind, title, starts_at, ends_at, created_by, external_source, external_id, time_known, competition)
      values (p_club, v_team, 'match', (m ->> 'home') || ' – ' || (m ->> 'away'), v_start, v_start + interval '105 minutes',
              auth.uid(), p_source, m ->> 'external_id', m ->> 'time' is not null, m ->> 'competition')
      on conflict (club_id, external_source, external_id) where external_id is not null
      do update set team_id = excluded.team_id, title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
                    time_known = excluded.time_known, competition = excluded.competition
      returning id, (xmax = 0) into v_event, v_ins;
      if v_ins then r_ins := r_ins + 1; else r_upd := r_upd + 1; end if;

      v_us_score    := case when v_home then (m ->> 'score_home')::int else (m ->> 'score_away')::int end;
      v_their_score := case when v_home then (m ->> 'score_away')::int else (m ->> 'score_home')::int end;
      insert into match_details (event_id, club_id, opponent, home_away, competition, our_score, their_score, status, forfeit_by_us)
      values (v_event, p_club, m ->> 'opponent', case when v_home then 'home' else 'away' end, m ->> 'competition',
              v_us_score, v_their_score, case m ->> 'status' when 'played' then 'played' when 'forfeit' then 'forfeit' else 'scheduled' end,
              nullif(m ->> 'forfeit_by_us', '')::boolean)
      on conflict (event_id) do update set opponent = excluded.opponent, home_away = excluded.home_away, competition = excluded.competition,
        our_score = excluded.our_score, their_score = excluded.their_score, status = excluded.status, forfeit_by_us = excluded.forfeit_by_us;
        -- lineup et notes : volontairement NON modifiés
    end loop;
  end loop;
  return jsonb_build_object('categories_created', r_cats_created, 'teams_created', r_teams_created,
    'matches_inserted', r_ins, 'matches_updated', r_upd, 'rest_days_ignored', r_byes, 'teams_unlinked', r_unlinked);
end $$;

-- Point d'entrée utilisateur : direction technique / administrateur uniquement.
create or replace function public.import_external_calendar(p_club uuid, p_source text, p_payload jsonb, p_create_structure boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.has_perm(p_club, null, 'calendar', 'administer') then
    raise exception 'import du calendrier officiel réservé à la direction technique' using errcode = '42501';
  end if;
  if p_create_structure and not (app.has_perm(p_club, null, 'categories', 'add') and app.has_perm(p_club, null, 'teams', 'add')) then
    raise exception 'création automatique des catégories et équipes refusée' using errcode = '42501';
  end if;
  return app.import_external_calendar(p_club, p_source, p_payload, p_create_structure);
end $$;
revoke all on function public.import_external_calendar(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.import_external_calendar(uuid, text, jsonb, boolean) to authenticated;
revoke all on public.external_team_links from anon, public;
grant select, insert, update, delete on public.external_team_links to authenticated;
