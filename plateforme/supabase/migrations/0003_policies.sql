-- =============================================================================
-- 0003 : RLS. Chaque table est verrouillée ; chaque politique appelle les
-- fonctions app.* ci-dessus. Par défaut (aucune politique) => accès refusé.
-- =============================================================================

do $$ declare t text; begin
  foreach t in array array[
    'clubs','platform_admins','profiles','seasons','categories','teams','club_roles',
    'role_permissions','memberships','assignments','invitations','players',
    'player_team_history','player_contacts','player_observations','observation_shares',
    'methodology_items','methodology_versions','methodology_reads','personal_sessions',
    'session_recommendations','audit_log']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- ---- clubs
create policy clubs_select on public.clubs for select to authenticated using (app.is_member(id));
create policy clubs_update on public.clubs for update to authenticated
  using (app.has_perm(id, null, 'club', 'edit')) with check (app.has_perm(id, null, 'club', 'edit'));
-- (création : fonction create_club réservée aux platform_admins)

-- ---- profiles
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (select 1 from memberships m
             where m.user_id = profiles.id and app.can_see_membership(m.id)));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---- saisons
create policy seasons_select on public.seasons for select to authenticated using (app.is_member(club_id));
create policy seasons_insert on public.seasons for insert to authenticated with check (app.has_perm(club_id, null, 'club', 'add'));
create policy seasons_update on public.seasons for update to authenticated
  using (app.has_perm(club_id, null, 'club', 'edit')) with check (app.has_perm(club_id, null, 'club', 'edit'));
create policy seasons_delete on public.seasons for delete to authenticated using (app.has_perm(club_id, null, 'club', 'delete'));

-- ---- catégories : un éducateur ne voit QUE ses catégories
create policy categories_select on public.categories for select to authenticated
  using (app.has_category_perm(club_id, id, 'categories', 'view'));
create policy categories_insert on public.categories for insert to authenticated
  with check (app.has_perm(club_id, null, 'categories', 'add'));
create policy categories_update on public.categories for update to authenticated
  using (app.has_perm(club_id, null, 'categories', 'edit')) with check (app.has_perm(club_id, null, 'categories', 'edit'));
create policy categories_delete on public.categories for delete to authenticated
  using (app.has_perm(club_id, null, 'categories', 'delete'));

-- ---- équipes
create policy teams_select on public.teams for select to authenticated using (app.has_perm(club_id, id, 'teams', 'view'));
create policy teams_insert on public.teams for insert to authenticated with check (app.has_perm(club_id, null, 'teams', 'add'));
create policy teams_update on public.teams for update to authenticated
  using (app.has_perm(club_id, null, 'teams', 'edit')) with check (app.has_perm(club_id, null, 'teams', 'edit'));
create policy teams_delete on public.teams for delete to authenticated using (app.has_perm(club_id, null, 'teams', 'delete'));

-- ---- rôles et permissions (lecture : membres ; écriture : administrateur)
create policy club_roles_select on public.club_roles for select to authenticated using (app.is_member(club_id));
create policy club_roles_write on public.club_roles for all to authenticated
  using (app.has_perm(club_id, null, 'roles', 'administer'))
  with check (app.has_perm(club_id, null, 'roles', 'administer'));
create policy role_permissions_select on public.role_permissions for select to authenticated using (app.is_member(club_id));
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (app.has_perm(club_id, null, 'roles', 'administer'))
  with check (app.has_perm(club_id, null, 'roles', 'administer'));

-- ---- membres et affectations
create policy memberships_select on public.memberships for select to authenticated using (app.can_see_membership(id));
create policy memberships_update on public.memberships for update to authenticated
  using (app.has_perm(club_id, null, 'members', 'edit') and app.outranks(club_id, role_key))
  with check (app.has_perm(club_id, null, 'members', 'edit') and app.outranks(club_id, role_key));
create policy memberships_delete on public.memberships for delete to authenticated
  using (app.has_perm(club_id, null, 'members', 'delete') and app.outranks(club_id, role_key));

create policy assignments_select on public.assignments for select to authenticated using (app.can_see_membership(membership_id));
create policy assignments_insert on public.assignments for insert to authenticated with check (
  (team_id is not null     and app.has_perm(club_id, team_id, 'members', 'edit'))
  or (category_id is not null and app.has_category_perm(club_id, category_id, 'members', 'edit')));
create policy assignments_delete on public.assignments for delete to authenticated using (
  (team_id is not null     and app.has_perm(club_id, team_id, 'members', 'edit'))
  or (category_id is not null and app.has_category_perm(club_id, category_id, 'members', 'edit')));

-- ---- invitations (écriture uniquement via fonctions create/accept/revoke)
create policy invitations_select on public.invitations for select to authenticated using (
  invited_by = auth.uid()
  or (team_id is not null     and app.has_perm(club_id, team_id, 'invitations', 'view'))
  or (category_id is not null and app.has_category_perm(club_id, category_id, 'invitations', 'view'))
  or app.has_perm(club_id, null, 'invitations', 'view'));

-- ---- joueurs
create policy players_select on public.players for select to authenticated using (app.can_access_player(id, 'players', 'view'));
create policy players_insert on public.players for insert to authenticated with check (app.has_perm(club_id, null, 'players', 'add'));
create policy players_update on public.players for update to authenticated
  using (app.can_access_player(id, 'players', 'edit')) with check (app.can_access_player(id, 'players', 'edit'));
create policy players_delete on public.players for delete to authenticated using (app.has_perm(club_id, null, 'players', 'delete'));

create policy pth_select on public.player_team_history for select to authenticated using (
  app.has_perm(club_id, null, 'players', 'view') or app.has_perm(club_id, team_id, 'players', 'view'));
-- écriture : fonctions add_player / transfer_player uniquement

create policy contacts_select on public.player_contacts for select to authenticated using (app.can_access_player(player_id, 'guardians', 'view'));
create policy contacts_insert on public.player_contacts for insert to authenticated with check (app.can_access_player(player_id, 'guardians', 'add'));
create policy contacts_update on public.player_contacts for update to authenticated
  using (app.can_access_player(player_id, 'guardians', 'edit')) with check (app.can_access_player(player_id, 'guardians', 'edit'));
create policy contacts_delete on public.player_contacts for delete to authenticated using (app.can_access_player(player_id, 'guardians', 'delete'));

-- ---- observations (privées par défaut ; jamais partagées automatiquement)
-- NB : « author_id = auth.uid() » est évalué en ligne (et non dans la fonction) pour que l'auteur
-- puisse relire sa ligne dans le même INSERT ... RETURNING.
create policy obs_select on public.player_observations for select to authenticated
  using (author_id = auth.uid() or app.can_see_observation(id));
create policy obs_insert on public.player_observations for insert to authenticated with check (
  author_id = auth.uid()
  and app.has_perm(club_id, team_id, 'observations', 'add')
  and exists (select 1 from player_team_history h
              where h.player_id = player_observations.player_id and h.team_id = player_observations.team_id and h.ended_on is null));
create policy obs_update on public.player_observations for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy obs_delete on public.player_observations for delete to authenticated using (author_id = auth.uid());

create policy obs_shares_select on public.observation_shares for select to authenticated using (app.can_see_observation(observation_id));
create policy obs_shares_insert on public.observation_shares for insert to authenticated
  with check (shared_by = auth.uid() and app.can_share_observation(observation_id, team_id));
create policy obs_shares_delete on public.observation_shares for delete to authenticated using (shared_by = auth.uid());

-- ---- méthodologie : les éducateurs lisent le PUBLIÉ ; la direction technique gère
create policy meth_items_select on public.methodology_items for select to authenticated using (
  (status = 'published' and app.is_member(club_id)) or app.has_perm(club_id, null, 'methodology', 'edit'));
create policy meth_items_insert on public.methodology_items for insert to authenticated with check (app.has_perm(club_id, null, 'methodology', 'add'));
create policy meth_items_update on public.methodology_items for update to authenticated
  using (app.has_perm(club_id, null, 'methodology', 'edit')) with check (app.has_perm(club_id, null, 'methodology', 'edit'));
create policy meth_items_delete on public.methodology_items for delete to authenticated using (app.has_perm(club_id, null, 'methodology', 'delete'));

create policy meth_versions_select on public.methodology_versions for select to authenticated using (
  (status = 'published' and app.is_member(club_id)) or app.has_perm(club_id, null, 'methodology', 'edit'));
create policy meth_versions_insert on public.methodology_versions for insert to authenticated
  with check (status = 'draft' and app.has_perm(club_id, null, 'methodology', 'add'));
create policy meth_versions_update on public.methodology_versions for update to authenticated
  using (status = 'draft' and app.has_perm(club_id, null, 'methodology', 'edit'))
  with check (status = 'draft' and app.has_perm(club_id, null, 'methodology', 'edit'));
create policy meth_versions_delete on public.methodology_versions for delete to authenticated
  using (status = 'draft' and app.has_perm(club_id, null, 'methodology', 'delete'));

create policy meth_reads_select on public.methodology_reads for select to authenticated
  using (user_id = auth.uid() or app.has_perm(club_id, null, 'reports', 'view'));
create policy meth_reads_insert on public.methodology_reads for insert to authenticated
  with check (user_id = auth.uid() and app.is_member(club_id));

-- ---- séances personnelles : propriétaire ; consultation par la direction technique
create policy psess_select on public.personal_sessions for select to authenticated using (
  owner_id = auth.uid()
  or (team_id is not null and app.has_perm(club_id, team_id, 'personal_sessions', 'view')));
create policy psess_insert on public.personal_sessions for insert to authenticated with check (
  owner_id = auth.uid() and app.is_member(club_id)
  and (team_id is null or app.has_perm(club_id, team_id, 'teams', 'view')));
create policy psess_update on public.personal_sessions for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (team_id is null or app.has_perm(club_id, team_id, 'teams', 'view')));
create policy psess_delete on public.personal_sessions for delete to authenticated using (owner_id = auth.uid());

create policy srec_select on public.session_recommendations for select to authenticated using (
  author_id = auth.uid()
  or exists (select 1 from personal_sessions s where s.id = session_id and s.owner_id = auth.uid()));
create policy srec_insert on public.session_recommendations for insert to authenticated with check (
  author_id = auth.uid()
  and exists (select 1 from personal_sessions s
              where s.id = session_id and s.team_id is not null
                and app.has_perm(s.club_id, s.team_id, 'personal_sessions', 'view')));

-- ---- audit : lecture réservée ; aucune écriture directe
create policy audit_select on public.audit_log for select to authenticated using (app.has_perm(club_id, null, 'audit_log', 'view'));

-- ---- privilèges SQL : la RLS filtre, les GRANT limitent les verbes
revoke all on all tables in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.platform_admins from authenticated;
revoke insert, update, delete, truncate on public.audit_log from authenticated;
revoke insert, update, delete, truncate on public.invitations from authenticated;
revoke insert, update, delete, truncate on public.player_team_history from authenticated;
revoke insert, update, delete on public.clubs from authenticated;
grant update (name) on public.clubs to authenticated;
