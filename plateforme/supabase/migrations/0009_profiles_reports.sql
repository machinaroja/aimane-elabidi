-- =============================================================================
-- 0009 : profils identifiables (tableau de bord) + traçabilité des exports de rapports
--  * profiles.email : copié du jeton à l'acceptation d'une invitation (la table auth.users n'est pas
--    lisible par les utilisateurs) ; visible uniquement des personnes autorisées à voir ce membre ;
--  * profiles.display_name : modifiable par la personne elle-même (jamais par un tiers) ;
--  * log_report_export : tout export de rapport est journalisé, droit « reports / export » exigé.
-- =============================================================================
alter table public.profiles add column email text;

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
  insert into profiles (id, email) values (auth.uid(), v_email)
    on conflict (id) do update set email = coalesce(profiles.email, excluded.email);
  update invitations set accepted_at = now(), accepted_by = auth.uid() where id = v.id;
  return v.club_id;
end $$;

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
  insert into profiles (id, email) values (auth.uid(), lower(auth.jwt() ->> 'email'))
    on conflict (id) do update set email = coalesce(profiles.email, excluded.email);
  return v_club;
end $$;

-- Un export de rapport (CSV, impression) est un acte sensible : droit dédié + trace dans le journal.
create or replace function public.log_report_export(p_club uuid, p_label text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.has_perm(p_club, null, 'reports', 'export') then
    raise exception 'export de rapport refusé' using errcode = '42501';
  end if;
  insert into audit_log (club_id, actor_id, action, table_name, row_id)
  values (p_club, auth.uid(), 'EXPORT', 'reports', left(coalesce(p_label, ''), 120));
end $$;
revoke all on function public.log_report_export(uuid, text) from public, anon;
grant execute on function public.log_report_export(uuid, text) to authenticated;
