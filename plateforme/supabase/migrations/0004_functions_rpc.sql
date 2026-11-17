-- =============================================================================
-- 0004 : fonctions métier (RPC). Toute écriture sensible passe ici : les
-- vérifications de droits sont explicites, atomiques et journalisées.
-- =============================================================================

-- ---------- Modèle de permissions par défaut (un club neuf en reçoit une copie) ----
create or replace function app.seed_club(p_club uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into club_roles (club_id, key, label, scope_level, rank) values
    (p_club, 'club_admin',            'Administrateur du club',         'club',     100),
    (p_club, 'direction',             'Direction du club',              'club',      90),
    (p_club, 'directeur_technique',   'Direction sportive / technique', 'club',      80),
    (p_club, 'responsable_categorie', 'Responsable de catégorie',       'category',  60),
    (p_club, 'entraineur',            'Entraîneur principal',           'team',      40),
    (p_club, 'adjoint',               'Entraîneur adjoint',             'team',      20);

  -- administrateur : tout
  insert into role_permissions (club_id, role_key, resource, action)
  select p_club, 'club_admin', r, a
  from unnest(array['club','categories','teams','members','invitations','roles','players','guardians',
                    'observations','methodology','personal_sessions','audit_log','reports']) r,
       unnest(array['view','add','edit','delete','export','administer']) a;

  -- direction : lecture globale + rapports
  insert into role_permissions (club_id, role_key, resource, action)
  select p_club, 'direction', r, 'view'
  from unnest(array['club','categories','teams','members','invitations','players','observations',
                    'methodology','personal_sessions','reports']) r;
  insert into role_permissions values (p_club,'direction','reports','export');

  -- direction technique : structure sportive, méthodologie complète, suivi des éducateurs
  insert into role_permissions (club_id, role_key, resource, action)
  select p_club, 'directeur_technique', r, a from (values
    ('club','view'),
    ('categories','view'),('categories','add'),('categories','edit'),
    ('teams','view'),('teams','add'),('teams','edit'),
    ('members','view'),('members','add'),('members','edit'),
    ('invitations','view'),('invitations','add'),
    ('players','view'),('players','add'),('players','edit'),('players','export'),
    ('observations','view'),
    ('methodology','view'),('methodology','add'),('methodology','edit'),('methodology','delete'),('methodology','export'),
    ('personal_sessions','view'),
    ('reports','view'),('reports','export')) v(r,a);

  -- responsable de catégorie (portée : sa catégorie)
  insert into role_permissions (club_id, role_key, resource, action)
  select p_club, 'responsable_categorie', r, a from (values
    ('categories','view'),('teams','view'),
    ('members','view'),('invitations','view'),('invitations','add'),
    ('players','view'),('players','add'),('players','edit'),('players','export'),
    ('guardians','view'),('guardians','add'),('guardians','edit'),
    ('observations','view'),('observations','add'),
    ('methodology','view'),('personal_sessions','view'),('reports','view')) v(r,a);

  -- entraîneur principal (portée : son équipe)
  insert into role_permissions (club_id, role_key, resource, action)
  select p_club, 'entraineur', r, a from (values
    ('categories','view'),('teams','view'),('members','view'),
    ('players','view'),('players','add'),('players','edit'),
    ('guardians','view'),('guardians','add'),('guardians','edit'),
    ('observations','view'),('observations','add'),
    ('methodology','view')) v(r,a);

  -- adjoint (portée : son équipe) : consultation + observations
  insert into role_permissions (club_id, role_key, resource, action)
  select p_club, 'adjoint', r, a from (values
    ('categories','view'),('teams','view'),('members','view'),
    ('players','view'),('observations','view'),('observations','add'),
    ('methodology','view')) v(r,a);
end $$;

-- ---------- Création d'un club (réservée aux opérateurs de la plateforme) ---------
create or replace function public.create_club(p_name text, p_slug text, p_season_label text, p_season_start date, p_season_end date)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club uuid;
begin
  if auth.uid() is null or not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'create_club : réservé aux opérateurs de la plateforme' using errcode = '42501';
  end if;
  insert into clubs (name, slug) values (p_name, p_slug) returning id into v_club;
  perform app.seed_club(v_club);
  perform app.seed_club_v2(v_club);
  insert into seasons (club_id, label, starts_on, ends_on, is_current) values (v_club, p_season_label, p_season_start, p_season_end, true);
  insert into memberships (club_id, user_id, role_key) values (v_club, auth.uid(), 'club_admin');
  insert into profiles (id) values (auth.uid()) on conflict do nothing;
  return v_club;
end $$;

-- ---------- Invitations ----------------------------------------------------------
create or replace function public.create_invitation(p_club uuid, p_email text, p_role text, p_team uuid default null, p_category uuid default null, p_days int default 14)
returns text language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_token text := encode(gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null then raise exception 'non authentifié' using errcode = '42501'; end if;
  if not app.can_grant_role(p_club, p_role, p_team, p_category) then
    raise exception 'invitation refusée : droits insuffisants pour ce rôle ou ce périmètre' using errcode = '42501';
  end if;
  insert into invitations (club_id, email, role_key, team_id, category_id, token_hash, invited_by, expires_at)
  values (p_club, lower(trim(p_email)), p_role, p_team, p_category, sha256(convert_to(v_token,'UTF8')), auth.uid(), now() + make_interval(days => p_days));
  return v_token;                       -- affiché UNE seule fois ; seul le hash est conservé
end $$;

create or replace function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v invitations%rowtype; v_member uuid; v_email text := lower(coalesce(auth.jwt() ->> 'email',''));
begin
  if auth.uid() is null then raise exception 'non authentifié' using errcode = '42501'; end if;
  select * into v from invitations where token_hash = sha256(convert_to(p_token,'UTF8')) for update;
  if not found or v.accepted_at is not null or v.revoked_at is not null or v.expires_at < now() or v.email <> v_email then
    raise exception 'invitation invalide, expirée ou destinée à une autre adresse' using errcode = '42501';
  end if;
  insert into memberships (club_id, user_id, role_key) values (v.club_id, auth.uid(), v.role_key)
    on conflict (club_id, user_id, role_key) do update set status = 'active' returning id into v_member;
  if v.team_id is not null or v.category_id is not null then
    insert into assignments (club_id, membership_id, team_id, category_id) values (v.club_id, v_member, v.team_id, v.category_id)
    on conflict do nothing;
  end if;
  insert into profiles (id) values (auth.uid()) on conflict do nothing;
  update invitations set accepted_at = now(), accepted_by = auth.uid() where id = v.id;
  return v.club_id;
end $$;

create or replace function public.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v invitations%rowtype;
begin
  select * into v from invitations where id = p_invitation;
  if not found or v.accepted_at is not null then raise exception 'introuvable ou déjà acceptée'; end if;
  if not (v.invited_by = auth.uid() or app.has_perm(v.club_id, v.team_id, 'invitations', 'edit')
          or (v.team_id is null and app.has_perm(v.club_id, null, 'invitations', 'edit'))) then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;
  update invitations set revoked_at = now() where id = p_invitation;
end $$;

-- ---------- Joueurs : création, transfert de catégorie, vue et export journalisés --
create or replace function public.add_player(p_team uuid, p_first text, p_last text, p_birth date default null, p_license text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club uuid; v_player uuid;
begin
  select club_id into v_club from teams where id = p_team;
  if v_club is null or not app.has_perm(v_club, p_team, 'players', 'add') then
    raise exception 'ajout de joueur refusé pour cette équipe' using errcode = '42501';
  end if;
  insert into players (club_id, first_name, last_name, birth_date, license_no, created_by)
    values (v_club, p_first, p_last, p_birth, p_license, auth.uid()) returning id into v_player;
  insert into player_team_history (club_id, player_id, team_id) values (v_club, v_player, p_team);
  return v_player;
end $$;

-- Changement de catégorie : la fiche est CONSERVÉE, seul le rattachement change.
-- Les droits suivent automatiquement (portée calculée sur l'équipe actuelle).
-- Les observations restent attachées à l'ancienne équipe : non partagées par défaut.
create or replace function public.transfer_player(p_player uuid, p_to_team uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club uuid; v_to_club uuid; v_open record;
begin
  select club_id into v_club from players where id = p_player;
  select club_id into v_to_club from teams where id = p_to_team;
  if v_club is null or v_club <> v_to_club then raise exception 'joueur ou équipe introuvable'; end if;
  if not app.has_perm(v_club, p_to_team, 'players', 'edit') then
    raise exception 'transfert refusé : pas de droits sur l''équipe d''arrivée' using errcode = '42501';
  end if;
  for v_open in select * from player_team_history where player_id = p_player and ended_on is null loop
    if not app.has_perm(v_club, v_open.team_id, 'players', 'edit') then
      raise exception 'transfert refusé : pas de droits sur l''équipe de départ' using errcode = '42501';
    end if;
    update player_team_history set ended_on = greatest(current_date, started_on) where id = v_open.id;
  end loop;
  insert into player_team_history (club_id, player_id, team_id) values (v_club, p_player, p_to_team);
end $$;

-- Consultation d'une fiche (journalisée).
create or replace function public.view_player(p_player uuid) returns public.players
language plpgsql security definer set search_path = public, pg_temp as $$
declare v players%rowtype;
begin
  if not app.can_access_player(p_player, 'players', 'view') then
    raise exception 'accès refusé' using errcode = '42501';
  end if;
  select * into v from players where id = p_player;
  insert into audit_log (club_id, actor_id, action, table_name, row_id) values (v.club_id, auth.uid(), 'VIEW', 'players', p_player::text);
  return v;
end $$;

-- Export d'un effectif (droit « export » distinct, journalisé).
create or replace function public.export_team_players(p_team uuid)
returns table (player_id uuid, first_name text, last_name text, birth_date date, license_no text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club uuid;
begin
  select club_id into v_club from teams where id = p_team;
  if v_club is null or not app.has_perm(v_club, p_team, 'players', 'export') then
    raise exception 'export refusé' using errcode = '42501';
  end if;
  insert into audit_log (club_id, actor_id, action, table_name, row_id) values (v_club, auth.uid(), 'EXPORT', 'players', p_team::text);
  return query select p.id, p.first_name, p.last_name, p.birth_date, p.license_no
               from players p join player_team_history h on h.player_id = p.id and h.team_id = p_team and h.ended_on is null;
end $$;

-- ---------- Méthodologie : publication versionnée et copie vers l'espace personnel -----
create or replace function app.methodology_version_no() returns trigger language plpgsql as $$
begin
  select coalesce(max(version_no),0)+1 into new.version_no from public.methodology_versions where item_id = new.item_id;
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end $$;
create trigger methodology_version_no before insert on public.methodology_versions
  for each row execute function app.methodology_version_no();

-- Une version publiée est IMMUABLE (l'historique ne se réécrit pas).
create or replace function app.methodology_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and old.status = 'published' then raise exception 'version publiée : suppression interdite'; end if;
  if tg_op = 'UPDATE' and old.status = 'published' then raise exception 'version publiée : modification interdite (créer une nouvelle version)'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger methodology_immutable before update or delete on public.methodology_versions
  for each row execute function app.methodology_immutable();

create or replace function public.publish_methodology_version(p_version uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v methodology_versions%rowtype;
begin
  select * into v from methodology_versions where id = p_version;
  if not found or not app.has_perm(v.club_id, null, 'methodology', 'edit') then
    raise exception 'publication refusée' using errcode = '42501';
  end if;
  if v.status = 'published' then raise exception 'déjà publiée'; end if;
  -- le trigger d'immutabilité ne bloque que les versions DÉJÀ publiées : on passe par un UPDATE unique
  update methodology_versions set status = 'published', published_by = auth.uid(), published_at = now() where id = p_version;
  update methodology_items set current_version_id = p_version, status = 'published' where id = v.item_id;
end $$;

-- Copie d'une séance commune dans l'espace de l'entraîneur ; l'original reste intact.
create or replace function public.copy_to_personal(p_item uuid, p_team uuid default null)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_item methodology_items%rowtype; v_ver methodology_versions%rowtype; v_id uuid;
begin
  select * into v_item from methodology_items where id = p_item;           -- RLS : publié seulement
  if not found or v_item.current_version_id is null then raise exception 'séance commune introuvable'; end if;
  select * into v_ver from methodology_versions where id = v_item.current_version_id;
  insert into personal_sessions (club_id, owner_id, team_id, title, body, source_version_id)
    values (v_item.club_id, auth.uid(), p_team, v_item.title, v_ver.body, v_ver.id) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.create_club(text,text,text,date,date), public.create_invitation(uuid,text,text,uuid,uuid,int),
  public.accept_invitation(text), public.revoke_invitation(uuid), public.add_player(uuid,text,text,date,text),
  public.transfer_player(uuid,uuid), public.view_player(uuid), public.export_team_players(uuid),
  public.publish_methodology_version(uuid), public.copy_to_personal(uuid,uuid) from public, anon;
grant execute on function public.create_club(text,text,text,date,date), public.create_invitation(uuid,text,text,uuid,uuid,int),
  public.accept_invitation(text), public.revoke_invitation(uuid), public.add_player(uuid,text,text,date,text),
  public.transfer_player(uuid,uuid), public.view_player(uuid), public.export_team_players(uuid),
  public.publish_methodology_version(uuid), public.copy_to_personal(uuid,uuid) to authenticated;
