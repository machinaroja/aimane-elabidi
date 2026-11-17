-- =============================================================================
-- 0005 : journal d'audit. Trigger générique ; pour les données personnelles des
-- joueurs mineurs (RGPD, minimisation) on journalise les NOMS des champs modifiés,
-- jamais leurs valeurs. Le journal est en insertion seule (même pour le propriétaire).
-- =============================================================================
create or replace function app.audit() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row jsonb; v_old jsonb; v_new jsonb; v_club uuid; v_id text;
  v_sensitive boolean := tg_table_name in ('players','player_contacts','player_observations');
begin
  v_row := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_club := nullif(v_row ->> 'club_id','')::uuid;
  if tg_table_name = 'clubs' then v_club := (v_row ->> 'id')::uuid; end if;
  v_id := coalesce(v_row ->> 'id', v_row ->> 'user_id');
  if v_sensitive then
    if tg_op = 'UPDATE' then
      v_new := (select coalesce(jsonb_object_agg(k, true), '{}'::jsonb)
                from jsonb_each(to_jsonb(new)) n(k, v) where to_jsonb(old) -> k is distinct from v);
    end if;
  else
    v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
    v_new := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  end if;
  if tg_table_name = 'invitations' then   -- ne jamais écrire le hash du jeton dans le journal
    v_old := v_old - 'token_hash'; v_new := v_new - 'token_hash';
  end if;
  insert into audit_log (club_id, actor_id, action, table_name, row_id, old_data, new_data)
  values (v_club, auth.uid(), tg_op, tg_table_name, v_id, v_old, v_new);
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['clubs','seasons','categories','teams','club_roles','role_permissions','memberships',
    'assignments','invitations','players','player_team_history','player_contacts','player_observations',
    'observation_shares','methodology_items','methodology_versions']
  loop execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function app.audit()', t); end loop;
end $$;

create or replace function app.audit_log_readonly() returns trigger language plpgsql as $$
begin raise exception 'audit_log est en insertion seule'; end $$;
create trigger audit_log_no_update before update or delete on public.audit_log for each row execute function app.audit_log_readonly();
create trigger audit_log_no_truncate before truncate on public.audit_log for each statement execute function app.audit_log_readonly();

-- Garde-fous : on ne retire jamais les droits de l'administrateur, ni le dernier administrateur.
create or replace function app.guard_admin() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_table_name = 'role_permissions' and old.role_key = 'club_admin' then
    if not exists (select 1 from clubs where id = old.club_id) then return old; end if;   -- suppression en cascade d'un club
    raise exception 'les permissions du rôle club_admin sont immuables';
  end if;
  if tg_table_name = 'memberships' and old.role_key = 'club_admin' and exists (select 1 from clubs where id = old.club_id) then
    if not exists (select 1 from memberships m where m.club_id = old.club_id and m.role_key = 'club_admin'
                   and m.status = 'active' and m.id <> old.id) then
      raise exception 'impossible de retirer le dernier administrateur du club';
    end if;
  end if;
  return coalesce(old, new);
end $$;
create trigger guard_admin_perm before delete or update on public.role_permissions
  for each row when (old.role_key = 'club_admin') execute function app.guard_admin();
create trigger guard_admin_member before delete on public.memberships
  for each row when (old.role_key = 'club_admin') execute function app.guard_admin();
