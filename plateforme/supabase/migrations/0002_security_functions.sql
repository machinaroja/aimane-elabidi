-- =============================================================================
-- 0002 : fonctions d'autorisation (SECURITY DEFINER => lisent les tables de
-- droits sans passer par la RLS, donc aucune récursion de politiques).
-- Toutes figent search_path et ne font confiance qu'à auth.uid().
-- =============================================================================

grant usage on schema app to authenticated;

-- L'utilisateur courant est-il membre actif du club ?
create or replace function app.is_member(p_club uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from memberships m
                 where m.club_id = p_club and m.user_id = auth.uid() and m.status = 'active');
$$;

-- Permission (ressource, action) sur une ÉQUIPE donnée.
-- p_team NULL  => exige un rôle à portée « club ».
create or replace function app.has_perm(p_club uuid, p_team uuid, p_resource text, p_action text)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(auth.uid() is not null, false) and exists (
    select 1
    from memberships m
    join club_roles r        on r.club_id = m.club_id and r.key = m.role_key
    join role_permissions rp on rp.club_id = m.club_id and rp.role_key = m.role_key
                            and rp.resource = p_resource and rp.action = p_action
    where m.club_id = p_club and m.user_id = auth.uid() and m.status = 'active'
      and (
        r.scope_level = 'club'
        or (p_team is not null and r.scope_level = 'team'
            and exists (select 1 from assignments a
                        where a.membership_id = m.id and a.team_id = p_team))
        or (p_team is not null and r.scope_level = 'category'
            and exists (select 1 from assignments a join teams t on t.category_id = a.category_id
                        where a.membership_id = m.id and t.id = p_team and t.club_id = p_club))
      )
  );
$$;

-- Permission sur une CATÉGORIE donnée (p_category NULL => portée club exigée).
create or replace function app.has_category_perm(p_club uuid, p_category uuid, p_resource text, p_action text)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(auth.uid() is not null, false) and exists (
    select 1
    from memberships m
    join club_roles r        on r.club_id = m.club_id and r.key = m.role_key
    join role_permissions rp on rp.club_id = m.club_id and rp.role_key = m.role_key
                            and rp.resource = p_resource and rp.action = p_action
    where m.club_id = p_club and m.user_id = auth.uid() and m.status = 'active'
      and (
        r.scope_level = 'club'
        or (p_category is not null and r.scope_level = 'category'
            and exists (select 1 from assignments a
                        where a.membership_id = m.id and a.category_id = p_category))
        or (p_category is not null and r.scope_level = 'team'
            and exists (select 1 from assignments a join teams t on t.id = a.team_id
                        where a.membership_id = m.id and t.category_id = p_category and t.club_id = p_club))
      )
  );
$$;

-- Permission sur un JOUEUR : club-wide, ou via l'une de ses équipes ACTUELLES.
-- (Un ancien entraîneur perd donc l'accès dès le transfert.)
create or replace function app.can_access_player(p_player uuid, p_resource text, p_action text)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from players p
    where p.id = p_player
      and (
        app.has_perm(p.club_id, null, p_resource, p_action)
        or exists (select 1 from player_team_history h
                   where h.player_id = p.id and h.ended_on is null
                     and app.has_perm(p.club_id, h.team_id, p_resource, p_action))
      )
  );
$$;

-- Rang le plus élevé de l'utilisateur dans un club (pour la délégation de droits).
create or replace function app.my_max_rank(p_club uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(max(r.rank), -1)
  from memberships m join club_roles r on r.club_id = m.club_id and r.key = m.role_key
  where m.club_id = p_club and m.user_id = auth.uid() and m.status = 'active';
$$;

-- Mon rang est-il strictement supérieur à celui de ce rôle ?
create or replace function app.outranks(p_club uuid, p_role text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.my_max_rank(p_club) > coalesce((select rank from club_roles where club_id = p_club and key = p_role), 1000000);
$$;

-- Peut-on attribuer ce rôle sur ce périmètre ? Règle anti-escalade :
--  * on n'attribue qu'un rôle de rang STRICTEMENT inférieur au sien ;
--  * un rôle à portée « équipe/catégorie » exige un périmètre dont on a la maîtrise ;
--  * un rôle à portée « club » exige d'être soi-même à portée club.
create or replace function app.can_grant_role(p_club uuid, p_role text, p_team uuid, p_category uuid)
returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_target club_roles%rowtype;
begin
  select * into v_target from club_roles where club_id = p_club and key = p_role;
  if not found then return false; end if;
  if app.my_max_rank(p_club) <= v_target.rank then return false; end if;

  if v_target.scope_level = 'club' then
    return p_team is null and p_category is null and app.has_perm(p_club, null, 'members', 'edit');
  elsif v_target.scope_level = 'category' then
    return p_category is not null and p_team is null
       and app.has_category_perm(p_club, p_category, 'invitations', 'add');
  else
    return p_team is not null and p_category is null
       and app.has_perm(p_club, p_team, 'invitations', 'add');
  end if;
end $$;

-- Un membre est-il visible par l'utilisateur courant ?
create or replace function app.can_see_membership(p_membership uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from memberships m
    where m.id = p_membership
      and (
        m.user_id = auth.uid()
        or app.has_perm(m.club_id, null, 'members', 'view')
        or exists (select 1 from assignments a
                   where a.membership_id = m.id
                     and ((a.team_id is not null     and app.has_perm(m.club_id, a.team_id, 'members', 'view'))
                       or (a.category_id is not null and app.has_category_perm(m.club_id, a.category_id, 'members', 'view'))))
      )
  );
$$;

-- Peut-on voir cette observation ?
create or replace function app.can_see_observation(p_obs uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from player_observations o
    where o.id = p_obs
      and (
        o.author_id = auth.uid()
        or (o.visibility = 'team'
            and (app.has_perm(o.club_id, o.team_id, 'observations', 'view')
                 or exists (select 1 from observation_shares s
                            where s.observation_id = o.id
                              and app.has_perm(o.club_id, s.team_id, 'observations', 'view'))))
        or (o.visibility = 'technical' and app.has_perm(o.club_id, null, 'observations', 'view'))
      )
  );
$$;

-- L'auteur d'une observation « d'équipe » peut la partager avec la ÉQUIPE ACTUELLE du joueur.
create or replace function app.can_share_observation(p_obs uuid, p_team uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from player_observations o
    join player_team_history h on h.player_id = o.player_id and h.club_id = o.club_id
    where o.id = p_obs and o.author_id = auth.uid() and o.visibility = 'team'
      and h.team_id = p_team and h.ended_on is null);
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated;
