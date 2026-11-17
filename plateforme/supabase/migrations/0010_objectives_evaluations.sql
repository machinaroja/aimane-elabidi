-- =============================================================================
-- 0010 : objectifs pédagogiques par équipe + évaluations collectives sur grille définie.
--
-- Principes (cahier des charges : « jamais de conclusions automatiques non vérifiées ») :
--  * la GRILLE (critères) est définie par la direction technique : 4 niveaux, chacun décrit par un
--    comportement observable (ancres) ; un critère déjà utilisé n'est plus modifiable (on en crée un
--    nouveau et on retire l'ancien) afin que les évaluations passées restent interprétables ;
--  * un niveau n'existe jamais sans OBSERVATION écrite qui l'étaye (au moins 10 caractères) ;
--  * AUCUN score global n'est calculé ni stocké : seulement des niveaux par critère ;
--  * une évaluation FINALISÉE est figée (corrections = nouvelle observation) ; un brouillon n'est visible
--    que de son auteur ; l'auteur et son rôle sont conservés (auto-évaluation ≠ regard extérieur).
-- =============================================================================

-- ---------- nouvelles ressources de permission ------------------------------------------
alter table public.role_permissions drop constraint role_permissions_resource_check;
alter table public.role_permissions add constraint role_permissions_resource_check check (resource in (
  'club','categories','teams','members','invitations','roles','players','guardians','observations',
  'methodology','personal_sessions','audit_log','reports',
  'calendar','attendance','convocations','matches','facilities',
  'objectives','evaluations','criteria'));

create or replace function app.seed_club_v3(p_club uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into role_permissions (club_id, role_key, resource, action)
  select p_club, 'club_admin', r, a
  from unnest(array['objectives','evaluations','criteria']) r, unnest(array['view','add','edit','delete','export','administer']) a
  on conflict do nothing;
  insert into role_permissions (club_id, role_key, resource, action)
  select p_club, k, r, a from (values
    ('direction','objectives','view'),('direction','evaluations','view'),('direction','criteria','view'),
    ('directeur_technique','criteria','view'),('directeur_technique','criteria','add'),('directeur_technique','criteria','edit'),('directeur_technique','criteria','delete'),
    ('directeur_technique','objectives','view'),('directeur_technique','objectives','add'),('directeur_technique','objectives','edit'),('directeur_technique','objectives','delete'),
    ('directeur_technique','evaluations','view'),('directeur_technique','evaluations','add'),
    ('responsable_categorie','criteria','view'),('responsable_categorie','objectives','view'),('responsable_categorie','objectives','add'),('responsable_categorie','objectives','edit'),
    ('responsable_categorie','evaluations','view'),('responsable_categorie','evaluations','add'),
    ('entraineur','criteria','view'),('entraineur','objectives','view'),('entraineur','objectives','add'),('entraineur','objectives','edit'),
    ('entraineur','evaluations','view'),('entraineur','evaluations','add'),
    ('adjoint','criteria','view'),('adjoint','objectives','view'),('adjoint','evaluations','view')
  ) v(k, r, a) on conflict do nothing;
end $$;
do $$ declare c uuid; begin for c in select id from public.clubs loop perform app.seed_club_v3(c); end loop; end $$;

create or replace function public.create_club(p_name text, p_slug text, p_season_label text, p_season_start date, p_season_end date)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club uuid;
begin
  if auth.uid() is null or not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'create_club : réservé aux opérateurs de la plateforme' using errcode = '42501';
  end if;
  insert into clubs (name, slug) values (p_name, p_slug) returning id into v_club;
  perform app.seed_club(v_club); perform app.seed_club_v2(v_club); perform app.seed_club_v3(v_club);
  insert into seasons (club_id, label, starts_on, ends_on, is_current) values (v_club, p_season_label, p_season_start, p_season_end, true);
  insert into memberships (club_id, user_id, role_key) values (v_club, auth.uid(), 'club_admin');
  insert into profiles (id, email) values (auth.uid(), lower(auth.jwt() ->> 'email'))
    on conflict (id) do update set email = coalesce(profiles.email, excluded.email);
  return v_club;
end $$;

-- ---------- tables -------------------------------------------------------------------------
create table public.criteria (                       -- la grille d'évaluation du club
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  title       text not null check (length(trim(title)) between 3 and 120),
  description text,
  pillar      text not null default 'transversal' check (pillar in ('position','possession','pression','transversal')),
  anchors     jsonb not null,                            -- {"1":"…","2":"…","3":"…","4":"…"} : comportements observables
  category_id uuid,                                      -- NULL = toutes les catégories
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (id, club_id),
  foreign key (category_id, club_id) references public.categories(id, club_id) on delete set null (category_id),
  check (jsonb_typeof(anchors) = 'object' and anchors ?& array['1','2','3','4']
         and length(trim(anchors ->> '1')) >= 10 and length(trim(anchors ->> '2')) >= 10
         and length(trim(anchors ->> '3')) >= 10 and length(trim(anchors ->> '4')) >= 10)
);

create table public.team_objectives (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null,
  team_id     uuid not null,
  title       text not null check (length(trim(title)) between 3 and 160),
  description text,
  criterion_id uuid,                                     -- critère de la grille que l'objectif vise à faire progresser (facultatif)
  methodology_item_id uuid,                              -- contenu de la méthodologie du club associé (facultatif)
  status      text not null default 'planned' check (status in ('planned','in_progress','achieved','not_achieved','abandoned')),
  due_on      date,
  created_by  uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, club_id),
  foreign key (team_id, club_id)             references public.teams(id, club_id)              on delete cascade,
  foreign key (criterion_id, club_id)        references public.criteria(id, club_id)           on delete set null (criterion_id),
  foreign key (methodology_item_id, club_id) references public.methodology_items(id, club_id)  on delete set null (methodology_item_id)
);
create table public.objective_notes (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null,
  objective_id uuid not null,
  author_id    uuid not null default auth.uid() references auth.users(id),
  note         text not null check (length(trim(note)) between 3 and 2000),
  created_at   timestamptz not null default now(),
  foreign key (objective_id, club_id) references public.team_objectives(id, club_id) on delete cascade
);

create table public.team_evaluations (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null,
  team_id           uuid not null,
  evaluator_id      uuid not null references auth.users(id),
  evaluator_role    text not null,                       -- rôle de l'auteur au moment de l'observation
  evaluated_on      date not null,
  summary           text,
  status            text not null default 'draft' check (status in ('draft','final')),
  created_at        timestamptz not null default now(),
  finalized_at      timestamptz,
  unique (id, club_id),
  foreign key (team_id, club_id) references public.teams(id, club_id) on delete cascade,
  check ((status = 'final') = (finalized_at is not null))
);
create table public.evaluation_scores (                 -- AUCUN champ « total » / « note globale » : volontairement
  evaluation_id uuid not null,
  club_id       uuid not null,
  criterion_id  uuid not null,
  level         int  not null check (level between 1 and 4),
  evidence      text not null check (length(trim(evidence)) >= 10),   -- observation factuelle obligatoire
  primary key (evaluation_id, criterion_id),
  foreign key (evaluation_id, club_id) references public.team_evaluations(id, club_id) on delete cascade,
  foreign key (criterion_id, club_id)  references public.criteria(id, club_id) on delete restrict
);
create index on public.team_objectives (team_id);
create index on public.team_evaluations (team_id, evaluated_on desc);

-- ---------- règles d'intégrité --------------------------------------------------------------
create or replace function app.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger objectives_touch before update on public.team_objectives for each row execute function app.touch_updated_at();

-- Un critère déjà utilisé dans une évaluation n'est plus modifiable (sauf activation / ordre).
create or replace function app.criteria_guard() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from evaluation_scores s where s.criterion_id = old.id)
     and (new.title, new.description, new.pillar, new.anchors, new.category_id) is distinct from (old.title, old.description, old.pillar, old.anchors, old.category_id) then
    raise exception 'critère déjà utilisé dans des évaluations : non modifiable (créez un nouveau critère et retirez celui-ci)';
  end if;
  return new;
end $$;
create trigger criteria_guard before update on public.criteria for each row execute function app.criteria_guard();

-- Évaluation finalisée = figée (elle, et ses scores).
create or replace function app.evaluation_frozen() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status text;
begin
  if tg_table_name = 'team_evaluations' then
    if tg_op = 'DELETE' then
      if old.status = 'final' and exists (select 1 from clubs where id = old.club_id) then raise exception 'évaluation finalisée : suppression interdite'; end if;
      return old;
    end if;
    if old.status = 'final' then raise exception 'évaluation finalisée : modification interdite (créez une nouvelle observation)'; end if;
    return new;
  end if;
  select status into v_status from team_evaluations where id = coalesce(new.evaluation_id, old.evaluation_id);
  if v_status = 'final' then raise exception 'évaluation finalisée : ses niveaux ne sont plus modifiables'; end if;
  return coalesce(new, old);
end $$;
create trigger evaluations_frozen before update or delete on public.team_evaluations for each row execute function app.evaluation_frozen();
create trigger scores_frozen before insert or update or delete on public.evaluation_scores for each row execute function app.evaluation_frozen();

-- ---------- autorisations liées -----------------------------------------------------------
create or replace function app.objective_perm(p_objective uuid, p_action text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from team_objectives o where o.id = p_objective and app.has_perm(o.club_id, o.team_id, 'objectives', p_action));
$$;
create or replace function app.evaluation_visible(p_eval uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from team_evaluations e where e.id = p_eval
    and (e.evaluator_id = auth.uid() or (e.status = 'final' and app.has_perm(e.club_id, e.team_id, 'evaluations', 'view'))));
$$;
grant execute on function app.objective_perm(uuid, text), app.evaluation_visible(uuid) to authenticated;

-- ---------- RLS --------------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['criteria','team_objectives','objective_notes','team_evaluations','evaluation_scores']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- Les propositions non activées ne sont visibles que de la direction technique ; un critère retiré reste lisible
-- là où il a déjà servi (évaluations passées).
create policy criteria_select on public.criteria for select to authenticated using (
  app.is_member(club_id)
  and (active or app.has_perm(club_id, null, 'criteria', 'edit') or exists (select 1 from evaluation_scores s where s.criterion_id = criteria.id)));
create policy criteria_insert on public.criteria for insert to authenticated with check (app.has_perm(club_id, null, 'criteria', 'add'));
create policy criteria_update on public.criteria for update to authenticated
  using (app.has_perm(club_id, null, 'criteria', 'edit')) with check (app.has_perm(club_id, null, 'criteria', 'edit'));
create policy criteria_delete on public.criteria for delete to authenticated using (app.has_perm(club_id, null, 'criteria', 'delete'));

create policy objectives_select on public.team_objectives for select to authenticated using (app.has_perm(club_id, team_id, 'objectives', 'view'));
create policy objectives_insert on public.team_objectives for insert to authenticated
  with check (created_by = auth.uid() and app.has_perm(club_id, team_id, 'objectives', 'add'));
create policy objectives_update on public.team_objectives for update to authenticated
  using (app.has_perm(club_id, team_id, 'objectives', 'edit')) with check (app.has_perm(club_id, team_id, 'objectives', 'edit'));
create policy objectives_delete on public.team_objectives for delete to authenticated using (app.has_perm(club_id, team_id, 'objectives', 'delete'));

create policy obj_notes_select on public.objective_notes for select to authenticated using (app.objective_perm(objective_id, 'view'));
create policy obj_notes_insert on public.objective_notes for insert to authenticated
  with check (author_id = auth.uid() and app.objective_perm(objective_id, 'edit'));

-- NB : « evaluator_id = auth.uid() » en ligne pour que l'auteur relise sa ligne dans le même INSERT … RETURNING.
create policy evals_select on public.team_evaluations for select to authenticated
  using (evaluator_id = auth.uid() or (status = 'final' and app.has_perm(club_id, team_id, 'evaluations', 'view')));
create policy evals_delete on public.team_evaluations for delete to authenticated using (evaluator_id = auth.uid() and status = 'draft');
create policy scores_select on public.evaluation_scores for select to authenticated using (app.evaluation_visible(evaluation_id));
-- écriture des évaluations et des niveaux : uniquement par fonctions (create / save / finalize)

revoke all on public.criteria, public.team_objectives, public.objective_notes, public.team_evaluations, public.evaluation_scores from anon, public;
grant select, insert, update, delete on public.criteria, public.team_objectives to authenticated;
grant select, insert on public.objective_notes to authenticated;
grant select, delete on public.team_evaluations to authenticated;
grant select on public.evaluation_scores to authenticated;

-- ---------- RPC : évaluations ---------------------------------------------------------------
create or replace function public.create_evaluation(p_team uuid, p_on date, p_summary text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club uuid; v_role text; v_id uuid;
begin
  select club_id into v_club from teams where id = p_team;
  if v_club is null or not app.has_perm(v_club, p_team, 'evaluations', 'add') then
    raise exception 'création d''évaluation refusée pour cette équipe' using errcode = '42501';
  end if;
  if p_on is null or p_on > current_date + 1 then raise exception 'date d''observation invalide'; end if;
  select m.role_key into v_role from memberships m join club_roles r on r.club_id = m.club_id and r.key = m.role_key
    where m.club_id = v_club and m.user_id = auth.uid() and m.status = 'active' order by r.rank desc limit 1;
  insert into team_evaluations (club_id, team_id, evaluator_id, evaluator_role, evaluated_on, summary)
  values (v_club, p_team, auth.uid(), v_role, p_on, nullif(trim(p_summary), '')) returning id into v_id;
  return v_id;
end $$;

-- p_level NULL = « non observé » : le critère est retiré de l'évaluation (jamais de valeur par défaut).
create or replace function public.save_evaluation_score(p_eval uuid, p_criterion uuid, p_level int, p_evidence text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare e team_evaluations%rowtype; c criteria%rowtype; v_cat uuid;
begin
  select * into e from team_evaluations where id = p_eval;
  if not found or e.evaluator_id <> auth.uid() or not app.has_perm(e.club_id, e.team_id, 'evaluations', 'add') then
    raise exception 'saisie refusée : seul l''auteur du brouillon peut le compléter' using errcode = '42501';
  end if;
  if e.status <> 'draft' then raise exception 'évaluation finalisée : ses niveaux ne sont plus modifiables'; end if;
  select * into c from criteria where id = p_criterion and club_id = e.club_id;
  if not found then raise exception 'critère introuvable'; end if;
  if p_level is null then
    delete from evaluation_scores where evaluation_id = p_eval and criterion_id = p_criterion; return;
  end if;
  select category_id into v_cat from teams where id = e.team_id;
  if not c.active then raise exception 'ce critère est retiré de la grille'; end if;
  if c.category_id is not null and c.category_id <> v_cat then raise exception 'ce critère ne s''applique pas à la catégorie de cette équipe'; end if;
  if p_level not between 1 and 4 then raise exception 'niveau invalide (1 à 4)'; end if;
  if length(trim(coalesce(p_evidence, ''))) < 10 then raise exception 'une observation factuelle (10 caractères minimum) est obligatoire pour chaque niveau attribué'; end if;
  insert into evaluation_scores (evaluation_id, club_id, criterion_id, level, evidence) values (p_eval, e.club_id, p_criterion, p_level, trim(p_evidence))
  on conflict (evaluation_id, criterion_id) do update set level = excluded.level, evidence = excluded.evidence;
end $$;

create or replace function public.finalize_evaluation(p_eval uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare e team_evaluations%rowtype;
begin
  select * into e from team_evaluations where id = p_eval;
  if not found or e.evaluator_id <> auth.uid() or not app.has_perm(e.club_id, e.team_id, 'evaluations', 'add') then
    raise exception 'finalisation refusée' using errcode = '42501';
  end if;
  if e.status <> 'draft' then raise exception 'déjà finalisée'; end if;
  if not exists (select 1 from evaluation_scores where evaluation_id = p_eval) then raise exception 'aucun critère observé : une évaluation vide ne peut pas être finalisée'; end if;
  update team_evaluations set status = 'final', finalized_at = now() where id = p_eval;
end $$;

-- Propositions de critères inspirées des principes de la méthodologie : créées INACTIVES.
-- C'est la direction technique qui les relit, les ajuste puis les active : l'activation vaut validation.
create or replace function public.seed_criteria_proposals(p_club uuid) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n int := 0;
begin
  if not app.has_perm(p_club, null, 'criteria', 'add') then raise exception 'droits insuffisants' using errcode = '42501'; end if;
  for r in select * from (values
    ('Occupation des espaces', 'position', 10,
     'Les joueurs se regroupent autour du ballon ; les espaces larges et profonds restent vides.',
     'Les couloirs sont tenus, mais sans équilibre entre les lignes ni occupation des espaces profonds.',
     'Occupation rationnelle des espaces la plupart du temps ; l''équipe se réorganise après un mouvement.',
     'Occupation rationnelle et réorganisation permanente, y compris sous pression adverse.'),
    ('Circulation du ballon', 'possession', 20,
     'Le ballon circule presque uniquement entre les mêmes joueurs ou revient systématiquement en arrière.',
     'Le ballon circule, mais avec peu de changements de côté ou de rythme.',
     'Le ballon circule avec des changements de côté et de rythme réguliers.',
     'Le ballon circule en variant côtés, rythmes et profondeurs pour déséquilibrer l''adversaire.'),
    ('Lignes de passe et triangulations', 'possession', 30,
     'Le porteur est le plus souvent isolé : peu d''options de passe proposées.',
     'Une option de passe est proposée, rarement deux.',
     'Deux options ou plus sont proposées ; des triangles se forment autour du porteur.',
     'Les joueurs sans ballon anticipent et proposent des lignes de passe différentes de celles des coéquipiers.'),
    ('Pressing après perte de balle', 'pression', 40,
     'Après une perte, la plupart des joueurs s''arrêtent ou reculent sans réaction collective.',
     'Un ou deux joueurs réagissent à la perte, sans soutien des autres.',
     'Plusieurs joueurs réagissent ensemble pour récupérer le ballon rapidement.',
     'La réaction à la perte est immédiate, collective et coordonnée avec la couverture des espaces.'),
    ('Coordination de la pression', 'pression', 50,
     'Les joueurs pressent chacun de leur côté, sans déclencheur commun.',
     'Un déclencheur est reconnu par une partie de l''équipe seulement.',
     'Le déclencheur est reconnu par la plupart des joueurs et la pression est soutenue par les lignes proches.',
     'La pression est déclenchée et soutenue collectivement, avec adaptation à la réaction adverse.'),
    ('Prise d''information avant réception', 'transversal', 60,
     'Les joueurs reçoivent le ballon sans regarder autour d''eux au préalable.',
     'Quelques joueurs regardent avant de recevoir, de façon irrégulière.',
     'La plupart des joueurs regardent avant de recevoir et orientent leur corps en conséquence.',
     'Les joueurs prennent l''information de façon répétée avant, pendant et après le contact avec le ballon.')
  ) v(title, pillar, ord, a1, a2, a3, a4)
  loop
    insert into criteria (club_id, title, pillar, anchors, active, sort_order, description)
    values (p_club, r.title, r.pillar, jsonb_build_object('1', r.a1, '2', r.a2, '3', r.a3, '4', r.a4), false, r.ord,
            'Proposition à valider par la direction technique (inactive tant qu''elle n''est pas activée).');
    n := n + 1;
  end loop;
  return n;
end $$;

do $$ declare f text; begin
  foreach f in array array['public.create_evaluation(uuid,date,text)','public.save_evaluation_score(uuid,uuid,int,text)','public.finalize_evaluation(uuid)','public.seed_criteria_proposals(uuid)']
  loop execute format('revoke all on function %s from public, anon', f); execute format('grant execute on function %s to authenticated', f); end loop;
end $$;

-- ---------- audit (observations = données sensibles : noms de champs seulement) -----------------
create or replace function app.audit() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row jsonb; v_old jsonb; v_new jsonb; v_club uuid; v_id text;
  v_sensitive boolean := tg_table_name in ('players','player_contacts','player_observations','attendance_records','convocations','match_player_stats','evaluation_scores','objective_notes');
begin
  v_row := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_club := nullif(v_row ->> 'club_id','')::uuid;
  if tg_table_name = 'clubs' then v_club := (v_row ->> 'id')::uuid; end if;
  v_id := coalesce(v_row ->> 'id', v_row ->> 'event_id', v_row ->> 'evaluation_id', v_row ->> 'user_id');
  if v_sensitive then
    if tg_op = 'UPDATE' then
      v_new := (select coalesce(jsonb_object_agg(k, true), '{}'::jsonb) from jsonb_each(to_jsonb(new)) n(k, v) where to_jsonb(old) -> k is distinct from v);
    end if;
  else
    v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
    v_new := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  end if;
  if tg_table_name = 'invitations' then v_old := v_old - 'token_hash'; v_new := v_new - 'token_hash'; end if;
  insert into audit_log (club_id, actor_id, action, table_name, row_id, old_data, new_data) values (v_club, auth.uid(), tg_op, tg_table_name, v_id, v_old, v_new);
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['criteria','team_objectives','objective_notes','team_evaluations','evaluation_scores']
  loop execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function app.audit()', t); end loop;
end $$;
